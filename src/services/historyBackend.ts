import { loadSettings } from '../store/settingsStore';
import { designPreviewEnabled } from '../dev/designPreview';
import { appBackendUrl } from './backendUrl';

type Namespace = 'ab' | 'legacy' | 'samples';
interface BackendRecord { id: string; value: unknown; revision: number }
interface Library { records: BackendRecord[]; deleted: string[] }
export const historyBackendEnabled = () => !designPreviewEnabled && !!(process.env.EXPO_PUBLIC_TTS_BACKEND_URL || '').trim();

export async function historyRequest(path: string, method = 'GET', body?: unknown): Promise<any> {
  const base = appBackendUrl();
  const { geminiApiKey } = await loadSettings();
  if (!base || !geminiApiKey) throw new Error('Conversation backend is not configured. Your existing data has been preserved.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${base}${path}`, { method, signal: controller.signal,
      headers: { Authorization: `Bearer ${geminiApiKey}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (response.status === 409) throw new Error('This chat changed on another device or conflicts with saved data. Reopen it before continuing.');
    if (!response.ok) throw new Error('Conversation backend could not save or load your data. Check the PC connection and retry.');
    return await response.json();
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new Error('Conversation backend timed out. Your existing data has been preserved; retry when the PC is reachable.');
    throw error;
  } finally { clearTimeout(timer); }
}

/** Backend is authoritative. Local records are imported once, never replayed as updates. */
export function createBackendHistory(request: typeof historyRequest) {
  const migrations = new Map<Namespace, Promise<Library>>();
  const revisions = new Map<string, number>();
  const remember = (namespace: Namespace, library: Library) => {
    if (!library || !Array.isArray(library.records) || !Array.isArray(library.deleted) ||
      library.deleted.some(id=>typeof id !== 'string') ||
      library.records.some(record=>!record || typeof record.id !== 'string' || !Number.isInteger(record.revision) || record.revision < 1)) throw new Error('Conversation backend returned invalid history.');
    for (const record of library.records) revisions.set(`${namespace}:${record.id}`, record.revision);
    return library;
  };
  return {
    async migrate(namespace: Namespace, records: { id: string; value: unknown }[], deleted: string[] = []) {
      let operation = migrations.get(namespace);
      if (!operation) {
        operation = request(`/api/storage/${namespace}/import`, 'POST', { records, deleted })
          .then(result => remember(namespace, result)).catch(error => { migrations.delete(namespace); throw error; });
        migrations.set(namespace, operation);
      }
      await operation;
    },
    async list(namespace: Namespace): Promise<Library> {
      return remember(namespace, await request(`/api/storage/${namespace}`));
    },
    async save(namespace: Namespace, id: string, value: unknown) {
      const key = `${namespace}:${id}`;
      const result = await request(`/api/storage/${namespace}/${encodeURIComponent(id)}`, 'PUT', { value, expectedRevision: revisions.get(key) || 0 });
      revisions.set(key, result.revision);
    },
    async remove(namespace: Namespace, id: string) {
      const key = `${namespace}:${id}`;
      const result = await request(`/api/storage/${namespace}/${encodeURIComponent(id)}`, 'DELETE', { expectedRevision: revisions.get(key) || 0 });
      revisions.set(key, result.revision);
    },
  };
}
export const backendHistory = createBackendHistory(historyRequest);
