import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorage } from '../storage.mjs';
import { createSpeechServer } from '../server.mjs';

const asset = { base64: 'YWJjZA==', mimeType: 'audio/wav', waveform: [0, 0.5, 1] };
const session = (id, assetId) => ({ id, turns: assetId ? [{ audioAssetId: assetId }] : [] });
async function temporary(run) {
  const root = await mkdtemp(join(tmpdir(), 'coachie-history-'));
  try { await run(root, createStorage(root)); } finally { await rm(root, { recursive: true, force: true }); }
}
test('durable history/audio survive new storage instances and compare-and-swap serializes devices', async () => temporary(async (root, storage) => {
  await storage.putAsset('shared', { asset });
  await storage.put('ab', 'chat', { value: session('chat', 'shared'), expectedRevision: 0 });
  const restarted = createStorage(root);
  assert.equal((await restarted.list('ab')).records[0].revision, 1);
  assert.deepEqual((await restarted.readAsset('shared')).asset, asset);
  const writes = await Promise.allSettled([storage.put('ab', 'chat', { value: { ...session('chat', 'shared'), topic: 'one' }, expectedRevision: 1 }), restarted.put('ab', 'chat', { value: { ...session('chat', 'shared'), topic: 'two' }, expectedRevision: 1 })]);
  assert.equal(writes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(writes.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal((await restarted.list('ab')).records[0].revision, 2);
}));
test('lost successful PUT response permits only an identical immediate-revision retry', async () => temporary(async (_, storage) => {
  const payload = { value: session('chat'), expectedRevision: 0 };
  assert.deepEqual(await storage.put('ab', 'chat', payload), { revision: 1 });
  assert.deepEqual(await storage.put('ab', 'chat', payload), { revision: 1 });
  await assert.rejects(storage.put('ab', 'chat', { ...payload, value: { ...payload.value, topic: 'changed' } }), error => error.status === 409);
  await storage.put('ab', 'chat', { value: payload.value, expectedRevision: 1 });
  await assert.rejects(storage.put('ab', 'chat', payload), error => error.status === 409);
}));
test('own-property checks import prototype-named identifiers as ordinary data', async () => temporary(async (_, storage) => {
  await storage.import('legacy', { records: [{ id: 'toString', value: { id: 'toString' } }, { id: 'hasOwnProperty', value: { id: 'hasOwnProperty' } }] });
  assert.deepEqual((await storage.list('legacy')).records.map(record => record.id), ['toString', 'hasOwnProperty']);
  await storage.delete('legacy', 'toString', { expectedRevision: 1 });
  await storage.import('legacy', { records: [{ id: 'toString', value: { id: 'toString' } }] });
  assert.deepEqual((await storage.list('legacy')).deleted, ['toString']);
}));
test('deletion persists retryable recording cleanup through failure and restart', async () => temporary(async (root, storage) => {
  await storage.putAsset('private', { asset });
  await storage.put('ab', 'chat', { value: session('chat', 'private'), expectedRevision: 0 });
  let failed = false;
  const unreliable = createStorage(root, { removeAsset: async path => { failed = true; const error = new Error('Simulated disk lock'); error.code = 'EPERM'; throw error; } });
  assert.deepEqual(await unreliable.delete('ab', 'chat', { expectedRevision: 1 }), { revision: 2 });
  assert.equal(failed, true);
  const persisted = JSON.parse(await readFile(join(root, 'ab.json'), 'utf8'));
  assert.deepEqual(persisted.cleanup.chat, ['private']); assert.deepEqual(persisted.records, {});
  assert.ok((await storage.readAsset('private')).asset);
  // Reads on a new instance recover cleanup even though no live record remains.
  const restarted = createStorage(root);
  assert.deepEqual(await restarted.list('ab'), { records: [], deleted: ['chat'] });
  assert.equal((await restarted.readAsset('private')).asset, null);
  assert.deepEqual(JSON.parse(await readFile(join(root, 'ab.json'), 'utf8')).cleanup, {});
  assert.deepEqual(await restarted.delete('ab', 'chat', { expectedRevision: 1 }), { revision: 2 });
  await storage.putAsset('retry-delete', { asset });
  await storage.put('ab', 'other', { value: session('other', 'retry-delete'), expectedRevision: 0 });
  await unreliable.delete('ab', 'other', { expectedRevision: 1 });
  assert.ok((await storage.readAsset('retry-delete')).asset);
  await restarted.delete('ab', 'other', { expectedRevision: 1 });
  assert.equal((await storage.readAsset('retry-delete')).asset, null);
}));
test('migration imports only absent records and deletion tombstones prevent resurrection', async () => temporary(async (_, storage) => {
  await storage.import('legacy', { records: [{ id: 'old', value: { id: 'old', topic: 'original' } }] });
  await storage.import('legacy', { records: [{ id: 'old', value: { id: 'old', topic: 'stale' } }], deleted: ['old'] });
  assert.equal((await storage.list('legacy')).records[0].value.topic, 'original');
  await storage.delete('legacy', 'old', { expectedRevision: 1 });
  await storage.import('legacy', { records: [{ id: 'old', value: { id: 'old' } }] });
  assert.deepEqual(await storage.list('legacy'), { records: [], deleted: ['old'] });
  await assert.rejects(storage.put('legacy', 'old', { value: { id: 'old' }, expectedRevision: 0 }), error => error.status === 409);
  await storage.import('samples', { records: [], deleted: ['sample-architecture'] });
  assert.deepEqual((await storage.list('samples')).deleted, ['sample-architecture']);
}));
test('shared recordings survive until all chat, pending and capture references are deleted', async () => temporary(async (_, storage) => {
  await storage.putAsset('shared', { asset });
  await storage.put('ab', 'one', { value: session('one', 'shared'), expectedRevision: 0 });
  await storage.put('ab', 'two', { value: { ...session('two'), pendingReply: { audioAssetId: 'shared' }, captureIssues: [{ audioAssetId: 'shared' }] }, expectedRevision: 0 });
  await storage.delete('ab', 'one', { expectedRevision: 1 });
  assert.deepEqual(await storage.deleteAsset('shared'), { deleted: false, retained: true });
  await storage.delete('ab', 'two', { expectedRevision: 1 });
  assert.equal((await storage.readAsset('shared')).asset, null);
  assert.deepEqual(await storage.deleteAsset('shared'), { deleted: true });
  assert.equal((await storage.readAsset('shared')).asset, null);
}));
test('immutable audio and migration integrity reject conflicts without modifying original data', async () => temporary(async (_, storage) => {
  await storage.putAsset('clip', { asset });
  await storage.putAsset('clip', { asset });
  await assert.rejects(storage.putAsset('clip', { asset: { ...asset, base64: 'eHl6' } }), error => error.status === 409);
  await assert.rejects(storage.import('ab', { records: [{ id: 'chat', value: session('chat', 'missing') }] }), error => error.status === 409);
  assert.equal((await storage.list('ab')).records.length, 0);
  // New captures can reserve ownership before an audio upload finishes.
  await storage.put('ab', 'chat', { value: session('chat', 'pending'), expectedRevision: 0 });
  assert.equal((await storage.list('ab')).records.length, 1);
  assert.deepEqual((await storage.readAsset('clip')).asset, asset);
}));
test('rejects path and prototype identifiers and preserves corrupted history for recovery', async () => temporary(async (root, storage) => {
  for (const id of ['../outside', '..', 'x/y', '__proto__', 'constructor']) await assert.rejects(storage.putAsset(id, { asset }), error => error.status === 400);
  await assert.rejects(storage.list('../outside'), error => error.status === 400);
  await storage.list('ab');
  await writeFile(join(root, 'ab.json'), '{broken');
  await assert.rejects(storage.put('ab', 'chat', { value: session('chat'), expectedRevision: 0 }));
  assert.equal(await readFile(join(root, 'ab.json'), 'utf8'), '{broken');
}));
test('storage routes require owner auth/allowed origin and expose durable JSON contract', async () => temporary(async (_, storage) => {
  const server = createSpeechServer({ client: {}, token: 'owner', origins: ['http://localhost:8083'], storage });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json', Origin: 'http://localhost:8083' };
    assert.equal((await fetch(`${base}/api/storage/ab`)).status, 401);
    assert.equal((await fetch(`${base}/api/storage/ab`, { headers: { ...headers, Origin: 'https://bad.test' } })).status, 403);
    assert.equal((await fetch(`${base}/api/assets/clip`, { method: 'PUT', headers, body: JSON.stringify({ asset }) })).status, 200);
    const created = await fetch(`${base}/api/storage/ab/chat`, { method: 'PUT', headers, body: JSON.stringify({ value: session('chat', 'clip'), expectedRevision: 0 }) });
    assert.deepEqual(await created.json(), { revision: 1 });
    assert.equal((await fetch(`${base}/api/storage/ab/chat`, { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: 0 }) })).status, 409);
    assert.equal((await fetch(`${base}/api/storage/ab/chat`, { method: 'DELETE', headers, body: JSON.stringify({ expectedRevision: 1 }) })).status, 200);
    assert.deepEqual(await (await fetch(`${base}/api/storage/ab`, { headers })).json(), { records: [], deleted: ['chat'] });
    assert.equal((await fetch(`${base}/api/assets/..%2fsecret`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/api/storage/ab/chat`, { method: 'PUT', headers, body: 'null' })).status, 400);
    const preflight = await fetch(`${base}/api/storage/ab`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8083' } });
    assert.equal(preflight.status, 204); assert.match(preflight.headers.get('access-control-allow-methods'), /GET/);
  } finally { await new Promise(resolve => server.close(resolve)); }
}));
