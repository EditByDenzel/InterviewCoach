import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { readAudioAsBase64 } from '../services/audioService';

export interface AudioAsset { base64: string; mimeType: string }
export interface AudioAssetAdapter {
  read(id: string): Promise<AudioAsset | null>;
  write(id: string, asset: AudioAsset): Promise<void>;
  remove(id: string): Promise<void>;
}

const extensions: Record<string, string> = {
  'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a',
  'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/ogg': 'ogg',
  'audio/x-caf': 'caf',
};

function fileKey(id: string): string {
  const key = encodeURIComponent(id).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16)}`);
  if (!id.trim() || key.length > 180) throw new Error('Audio asset ID is empty or too long.');
  return key;
}

function normalizeAsset(asset: AudioAsset): AudioAsset {
  const mimeType = asset.mimeType.split(';')[0].trim().toLowerCase();
  if (!extensions[mimeType]) throw new Error('This recording has an unsupported audio format.');
  const base64 = asset.base64.replace(/\s/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error('Audio data is empty or is not valid base64.');
  }
  return { base64, mimeType };
}

/** Injectable adapter keeps persistence/race tests independent of microphone hardware. */
export function createAudioAssetStore(adapter: AudioAssetAdapter) {
  let pending: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.catch(() => {});
    return result;
  }
  return {
    saveAudioAsset(id: string, input: AudioAsset): Promise<string> {
      return serialize(async () => {
        fileKey(id);
        const asset = normalizeAsset(input);
        const existing = await adapter.read(id);
        if (existing) {
          if (existing.base64 === asset.base64 && existing.mimeType === asset.mimeType) return id;
          throw new Error('An audio asset already exists with this ID. Use a new ID for a different clip.');
        }
        await adapter.write(id, asset);
        return id;
      });
    },
    loadAudioAsset(id: string): Promise<AudioAsset | null> {
      return serialize(async () => { fileKey(id); return adapter.read(id); });
    },
    deleteAudioAssets(ids: string[]): Promise<void> {
      return serialize(async () => {
        const unique = [...new Set(ids)];
        unique.forEach(fileKey);
        const results = await Promise.allSettled(unique.map(id => adapter.remove(id)));
        if (results.some(result => result.status === 'rejected')) {
          throw new Error('Some saved recordings could not be deleted. Please retry deleting this conversation.');
        }
      });
    },
  };
}

function nativeAdapter(): AudioAssetAdapter {
  const root = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}coachie-audio-v1/` : null;
  let directoryReady: Promise<void> | null = null;
  async function directory(): Promise<string> {
    if (!root) throw new Error('Permanent audio storage is unavailable on this device.');
    if (!directoryReady) {
      directoryReady = FileSystem.makeDirectoryAsync(root, { intermediates: true }).catch(error => {
        directoryReady = null;
        throw error;
      });
    }
    await directoryReady;
    return root;
  }
  async function metadata(id: string): Promise<{ mimeType: string; fileName: string } | null> {
    const path = `${await directory()}${fileKey(id)}.json`;
    if (!(await FileSystem.getInfoAsync(path)).exists) return null;
    const data = JSON.parse(await FileSystem.readAsStringAsync(path));
    const extension = extensions[data.mimeType];
    if (data.id !== id || !extension || data.fileName !== `${fileKey(id)}.${extension}`) {
      throw new Error('Saved recording metadata is damaged.');
    }
    return data;
  }
  return {
    async read(id) {
      const data = await metadata(id);
      if (!data) return null;
      const uri = `${await directory()}${data.fileName}`;
      if (!(await FileSystem.getInfoAsync(uri)).exists) throw new Error('This saved recording is missing from device storage.');
      return { base64: await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }), mimeType: data.mimeType };
    },
    async write(id, asset) {
      const dir = await directory();
      const fileName = `${fileKey(id)}.${extensions[asset.mimeType]}`;
      const uri = `${dir}${fileName}`;
      const metaUri = `${dir}${fileKey(id)}.json`;
      try {
        await FileSystem.writeAsStringAsync(uri, asset.base64, { encoding: FileSystem.EncodingType.Base64 });
        // Publish metadata last: a failed binary write never looks like a saved asset.
        await FileSystem.writeAsStringAsync(metaUri, JSON.stringify({ id, mimeType: asset.mimeType, fileName }));
      } catch (_) {
        await Promise.allSettled([FileSystem.deleteAsync(uri, { idempotent: true }), FileSystem.deleteAsync(metaUri, { idempotent: true })]);
        throw new Error('The recording could not be saved permanently. Check available device storage and retry.');
      }
    },
    async remove(id) {
      const dir = await directory();
      // Remove known binary variants too, including an orphan from an interrupted write.
      const results = await Promise.allSettled([...new Set(Object.values(extensions))].map(extension =>
        FileSystem.deleteAsync(`${dir}${fileKey(id)}.${extension}`, { idempotent: true })));
      if (results.some(result => result.status === 'rejected')) throw new Error('Could not remove recording audio.');
      // Keep metadata on failure so a conversation deletion can retry cleanup.
      await FileSystem.deleteAsync(`${dir}${fileKey(id)}.json`, { idempotent: true });
    },
  };
}

function webAdapter(): AudioAssetAdapter {
  let connection: Promise<IDBDatabase> | null = null;
  async function database(): Promise<IDBDatabase> {
    if (!connection) {
      connection = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('Permanent audio storage is unavailable in this browser.')); return; }
        const request = indexedDB.open('coachie_audio_v1', 1);
        let abandoned = false;
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains('assets')) request.result.createObjectStore('assets', { keyPath: 'id' });
        };
        request.onblocked = () => { abandoned = true; reject(new Error('Close other Coachie tabs and retry saving the recording.')); };
        request.onerror = () => reject(new Error('Browser audio storage could not be opened.'));
        request.onsuccess = () => {
          const db = request.result;
          if (abandoned) { db.close(); return; }
          db.onversionchange = () => { db.close(); connection = null; };
          resolve(db);
        };
      }).catch(error => { connection = null; throw error; });
    }
    return connection;
  }
  async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await database();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('assets', mode);
      const request = operation(tx.objectStore('assets'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('Browser audio storage failed. Check available space and retry.'));
    });
  }
  return {
    async read(id) {
      const data = await transaction('readonly', store => store.get(id)) as { blob: Blob; mimeType: string } | undefined;
      if (!data) return null;
      return { base64: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
          if (!base64) reject(new Error('Saved recording data is damaged.')); else resolve(base64);
        };
        reader.onerror = () => reject(new Error('Saved recording could not be read.'));
        reader.readAsDataURL(data.blob);
      }), mimeType: data.mimeType };
    },
    async write(id, asset) {
      const binary = atob(asset.base64);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      await transaction('readwrite', store => store.add({ id, mimeType: asset.mimeType, blob: new Blob([bytes], { type: asset.mimeType }) }));
    },
    async remove(id) { await transaction('readwrite', store => store.delete(id)); },
  };
}

let defaultStore: ReturnType<typeof createAudioAssetStore> | null = null;
function store() { return defaultStore ??= createAudioAssetStore(Platform.OS === 'web' ? webAdapter() : nativeAdapter()); }

export const saveAudioAsset = (id: string, asset: AudioAsset): Promise<string> => store().saveAudioAsset(id, asset);
export const loadAudioAsset = (id: string): Promise<AudioAsset | null> => store().loadAudioAsset(id);
export const deleteAudioAssets = (ids: string[]): Promise<void> => store().deleteAudioAssets(ids);
export async function saveRecordedAudioAsset(id: string, uri: string): Promise<string> {
  return saveAudioAsset(id, await readAudioAsBase64(uri));
}
