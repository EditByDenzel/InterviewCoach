import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestError } from './speech.mjs';

const queues = new Map();
const namespaces = new Set(['ab', 'legacy', 'samples']);
const formats = new Set(['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/webm', 'audio/ogg', 'audio/x-caf']);
const fail = (status, message) => { throw new RequestError(status, message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
function identifier(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_.:-]{1,180}$/.test(id) || ['.', '..', '__proto__', 'constructor', 'prototype'].includes(id)) fail(400, 'Invalid storage identifier.');
  return id;
}
function namespace(name) { if (!namespaces.has(name)) fail(400, 'Invalid storage namespace.'); return name; }
const assetRefs = value => [...new Set([...(value.turns || []).map(turn => turn.audioAssetId), value.pendingReply?.audioAssetId, ...(value.captureIssues || []).map(issue => issue.audioAssetId)].filter(Boolean))];
function recordValue(name, id, value) {
  if (!object(value) || value.id !== id) fail(400, 'Record ID must match its value.');
  if (name === 'ab' && (!Array.isArray(value.turns) || (value.pendingReply !== undefined && !object(value.pendingReply)) || (value.captureIssues !== undefined && !Array.isArray(value.captureIssues)) || value.turns.some(turn => !object(turn)) || value.captureIssues?.some(issue => !object(issue)))) fail(400, 'Invalid conversation record.');
  if (name === 'ab') assetRefs(value).forEach(identifier);
  return value;
}
async function readJSON(path, missing) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return missing; throw error; }
}
async function atomicJSON(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

// One serialized transaction queue per directory protects references and CAS across
// all namespaces/assets in this process. Files remain authoritative after restart.
export function createStorage(directory = fileURLToPath(new URL('./private/history/', import.meta.url)), { removeAsset = unlink } = {}) {
  const root = resolve(directory);
  const transaction = operation => {
    const next = (queues.get(root) || Promise.resolve()).catch(() => {}).then(async () => {
      await mkdir(join(root, 'assets'), { recursive: true });
      return operation();
    });
    // Do not retain a potentially large last-read recording in the queue map.
    queues.set(root, next.then(() => undefined, () => undefined)); return next;
  };
  const statePath = name => join(root, `${namespace(name)}.json`);
  const state = async name => {
    const data = await readJSON(statePath(name), { records: {}, deleted: {} });
    if (!object(data.records) || !object(data.deleted) || (data.cleanup !== undefined && (!object(data.cleanup) || Object.values(data.cleanup).some(ids => !Array.isArray(ids) || ids.some(id => typeof id !== 'string'))))) throw new Error('Stored history is corrupt.');
    data.cleanup ||= {};
    return data;
  };
  const assetPath = id => join(root, 'assets', `${createHash('sha256').update(identifier(id)).digest('hex')}.json`);
  const listing = data => ({ records: Object.values(data.records), deleted: Object.keys(data.deleted) });
  const validateAssets = async (name, value) => {
    if (name !== 'ab') return;
    for (const id of assetRefs(value)) if (!(await readJSON(assetPath(id), null))) fail(409, 'Upload referenced recordings before saving this conversation.');
  };
  const retryCleanup = async (name, data) => {
    if (name !== 'ab' || !Object.keys(data.cleanup).length) return;
    const referenced = new Set(Object.values(data.records).flatMap(record => assetRefs(record.value)));
    for (const [id, ids] of Object.entries(data.cleanup)) {
      const remaining = [];
      for (const assetId of ids) {
        if (referenced.has(assetId)) { remaining.push(assetId); continue; }
        try { await removeAsset(assetPath(assetId)); }
        catch (error) { if (error.code !== 'ENOENT') remaining.push(assetId); }
      }
      if (remaining.length) data.cleanup[id] = remaining;
      else delete data.cleanup[id];
    }
    // The original tombstone+cleanup list already exists on disk. If this write
    // fails, a later list/delete repeats safe unlink operations, never resurrects.
    await atomicJSON(statePath(name), data);
  };
  return {
    list: name => transaction(async () => { const data = await state(name); await retryCleanup(name, data); return listing(data); }),
    import: (name, payload) => transaction(async () => {
      namespace(name);
      if (!object(payload) || !Array.isArray(payload.records) || payload.records.length > 1000 || (payload.deleted !== undefined && (!Array.isArray(payload.deleted) || payload.deleted.length > 1000))) fail(400, 'Invalid history import.');
      const data = await state(name);
      for (const entry of payload.records) {
        if (!object(entry)) fail(400, 'Invalid history entry.');
        const id = identifier(entry.id); recordValue(name, id, entry.value);
        if (name !== 'samples' && !own(data.records, id) && !own(data.deleted, id) && !payload.deleted?.includes(id)) {
          await validateAssets(name, entry.value);
          data.records[id] = { id, value: entry.value, revision: 1 };
        }
      }
      for (const id of payload.deleted || []) {
        identifier(id);
        // A stale browser migration cannot erase an existing server conversation.
        if (!own(data.records, id) && !own(data.deleted, id)) data.deleted[id] = 1;
      }
      await atomicJSON(statePath(name), data); return listing(data);
    }),
    put: (name, id, payload) => transaction(async () => {
      identifier(id); namespace(name);
      if (name === 'samples') fail(400, 'Samples only support deletion.');
      if (!object(payload) || !Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0) fail(400, 'Provide an expected revision.');
      const data = await state(name);
      // Capture reserves ownership before writing audio; incomplete reservations
      // are intentionally retained so a failed upload can be retried safely.
      recordValue(name, id, payload.value);
      const existing = own(data.records, id) ? data.records[id] : undefined;
      if (!own(data.deleted, id) && existing?.revision === payload.expectedRevision + 1 && JSON.stringify(existing.value) === JSON.stringify(payload.value)) return { revision: existing.revision };
      if (own(data.deleted, id) || (existing?.revision || 0) !== payload.expectedRevision) fail(409, 'History changed on another device. Reload before saving.');
      const revision = payload.expectedRevision + 1;
      data.records[id] = { id, value: payload.value, revision };
      await atomicJSON(statePath(name), data); return { revision };
    }),
    delete: (name, id, payload) => transaction(async () => {
      identifier(id); const data = await state(name);
      if (!object(payload) || !Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0) fail(400, 'Provide an expected revision.');
      const current = own(data.records, id) ? data.records[id].revision : own(data.deleted, id) ? data.deleted[id] : 0;
      if (own(data.deleted, id) && (current === payload.expectedRevision || current === payload.expectedRevision + 1)) { await retryCleanup(name, data); return { revision: current }; }
      if (current !== payload.expectedRevision) fail(409, 'History changed on another device. Reload before deleting.');
      if (name === 'ab' && own(data.records, id)) data.cleanup[id] = assetRefs(data.records[id].value);
      delete data.records[id]; data.deleted[id] = current + 1;
      // Persist the tombstone and cleanup intent together before removing audio.
      await atomicJSON(statePath(name), data); await retryCleanup(name, data); return { revision: current + 1 };
    }),
    readAsset: id => transaction(async () => ({ asset: await readJSON(assetPath(id), null) })),
    putAsset: (id, payload) => transaction(async () => {
      const asset = payload?.asset;
      if (!object(asset) || typeof asset.base64 !== 'string' || !asset.base64 || asset.base64.length > 48 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.base64) || asset.base64.length % 4 === 1 || !formats.has(asset.mimeType) || (asset.waveform !== undefined && (!Array.isArray(asset.waveform) || !asset.waveform.length || asset.waveform.length > 128 || asset.waveform.some(value => !Number.isFinite(value) || value < 0 || value > 1)))) fail(400, 'Invalid audio asset.');
      const normalized = { base64: asset.base64, mimeType: asset.mimeType, ...(asset.waveform ? { waveform: asset.waveform } : {}) };
      const path = assetPath(id); const existing = await readJSON(path, null);
      if (existing && (existing.base64 !== normalized.base64 || existing.mimeType !== normalized.mimeType)) fail(409, 'Recording IDs are immutable.');
      if (!existing) await atomicJSON(path, normalized);
      return { saved: true };
    }),
    deleteAsset: id => transaction(async () => {
      identifier(id); const data = await state('ab');
      if (Object.values(data.records).some(record => assetRefs(record.value).includes(id))) return { deleted: false, retained: true };
      await removeAsset(assetPath(id)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      return { deleted: true };
    }),
  };
}
