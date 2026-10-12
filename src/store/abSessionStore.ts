import AsyncStorage from '@react-native-async-storage/async-storage';
import { ABSession, isABSession } from '../domain/abSession';
import { deleteAudioAssets, migrateAudioAssets } from './audioAssetStore';
import { backendHistory, historyBackendEnabled } from '../services/historyBackend';

const KEY = '@coachie_ab_sessions_v1';
let queue: Promise<void> = Promise.resolve();
const corrupt = () => new Error('Your saved A/B sessions could not be read. Stored data has been preserved.');
const assetsFor = (session: ABSession): string[] => [
  ...session.turns.flatMap(turn => turn.audioAssetId ? [turn.audioAssetId] : []),
  ...(session.pendingReply ? [session.pendingReply.audioAssetId] : []),
  ...(session.captureIssues || []).map(issue => issue.audioAssetId),
];

async function readLocalSessions(): Promise<ABSession[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  let values: unknown;
  try { values = JSON.parse(raw); } catch { throw corrupt(); }
  if (!Array.isArray(values) || !values.every(isABSession)) throw corrupt();
  if (new Set(values.map(session => session.id)).size !== values.length) throw corrupt();
  return values.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
let migration: Promise<void> | null = null;
async function readSessions(): Promise<ABSession[]> {
  if (!historyBackendEnabled()) return readLocalSessions();
  if (!migration) migration = (async()=>{
    const local = await readLocalSessions();
    const remote = await backendHistory.list('ab');
    const known = new Set([...remote.deleted, ...remote.records.map(record=>record.id)]);
    const missing = local.filter(session=>!known.has(session.id));
    // Never publish metadata until all of its recordings are durable on the PC.
    await migrateAudioAssets(missing.flatMap(assetsFor));
    await backendHistory.migrate('ab', missing.map(value=>({id:value.id,value})));
  })().catch(error=>{migration=null;throw error;});
  await migration;
  const library = await backendHistory.list('ab');
  const values = library.records.map(record=>record.value);
  if (!values.every(isABSession)) throw corrupt();
  return values.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function enqueue(action: () => Promise<void>): Promise<void> {
  const operation = queue.catch(() => {}).then(action);
  queue = operation;
  return operation;
}
export async function listABSessions(): Promise<ABSession[]> {
  // Reads issued after a save/delete see its completed state.
  await queue.catch(() => {});
  return readSessions();
}
export async function loadABSession(id: string): Promise<ABSession | null> {
  return (await listABSessions()).find(session => session.id === id) ?? null;
}
export function saveABSession(session: ABSession): Promise<void> {
  if (!isABSession(session)) return Promise.reject(new Error('This A/B session is incomplete and could not be saved.'));
  const snapshot: ABSession = JSON.parse(JSON.stringify(session));
  return enqueue(async () => {
    if (historyBackendEnabled()) {
      // First save may be a brand-new session; migrate existing data without
      // refreshing revisions of a session already open on this device.
      if (!migration) await readSessions(); else await migration;
      await backendHistory.save('ab', snapshot.id, snapshot);
      return;
    }
    const existing = await readLocalSessions();
    await AsyncStorage.setItem(KEY, JSON.stringify([snapshot, ...existing.filter(item => item.id !== snapshot.id)]));
  });
}
export function deleteABSession(id: string): Promise<void> {
  return enqueue(async () => {
    const existing = await readSessions();
    const removed = existing.find(session => session.id === id);
    if (!removed) return;
    if (historyBackendEnabled()) {
      // The server persists cleanup intent with the tombstone and protects
      // cross-device references, including retries after interrupted deletion.
      await backendHistory.remove('ab',id);
      return;
    }
    const retained = existing.filter(session => session.id !== id);
    const shared = new Set(retained.flatMap(assetsFor));
    const ownedAssets = [...new Set(assetsFor(removed).filter(id => !shared.has(id)))];
    // Keep metadata until cleanup succeeds. A failed cleanup can then be retried
    // with the same IDs; the asset adapter's deletion is idempotent.
    await deleteAudioAssets(ownedAssets);
    await AsyncStorage.setItem(KEY, JSON.stringify(retained));
  });
}
