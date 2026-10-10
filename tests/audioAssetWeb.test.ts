jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-file-system', () => ({}));
jest.mock('../src/services/audioService', () => ({ readAudioAsBase64: jest.fn(async () => ({ base64: 'YQ==', mimeType: 'audio/mp4' })) }));

import { saveAudioAsset, loadAudioAsset, deleteAudioAssets } from '../src/store/audioAssetStore';

describe('Browser audio evidence uses durable Blob storage', () => {
  const records = new Map<string, any>();
  let failWrites = false;
  const originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const originalFileReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
  beforeAll(() => {
    const database = {
      objectStoreNames: { contains: () => true }, close: jest.fn(), onversionchange: null,
      transaction: () => {
        const tx: any = { oncomplete: null, onabort: null, onerror: null };
        const request = (kind: string, value: any) => {
          const result: any = { result: undefined };
          Promise.resolve().then(() => {
            if (kind === 'add' && failWrites) { tx.onabort?.(); return; }
            if (kind === 'get') result.result = records.get(value);
            if (kind === 'add') records.set(value.id, value);
            if (kind === 'delete') records.delete(value);
            tx.oncomplete?.();
          });
          return result;
        };
        tx.objectStore = () => ({ get: (id: string) => request('get', id),
          add: (value: any) => request('add', value), delete: (id: string) => request('delete', id) });
        return tx;
      },
    };
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
      open: jest.fn(() => {
        const request: any = { result: database };
        Promise.resolve().then(() => request.onsuccess?.()); return request;
      }),
    } });
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
      result: string | null = null; onload: (() => void) | null = null;
      async readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;
        this.onload?.();
      }
    } });
  });
  beforeEach(() => { records.clear(); failWrites = false; });
  afterAll(() => {
    if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
    else delete (globalThis as any).indexedDB;
    if (originalFileReader) Object.defineProperty(globalThis, 'FileReader', originalFileReader);
    else delete (globalThis as any).FileReader;
  });
  it('writes a Blob with its actual audio MIME type and reads its original bytes', async () => {
    await saveAudioAsset('phone-recording', { base64: 'YQ==', mimeType: 'audio/mp4' });
    expect(records.get('phone-recording').blob).toBeInstanceOf(Blob);
    expect(records.get('phone-recording').blob.type).toBe('audio/mp4');
    expect(records.get('phone-recording').base64).toBeUndefined();
    expect(await loadAudioAsset('phone-recording')).toEqual({ base64: 'YQ==', mimeType: 'audio/mp4' });
  });
  it('retains evidence when the JavaScript store is recreated after reload', async () => {
    await saveAudioAsset('reload', { base64: 'YQ==', mimeType: 'audio/wav' });
    let reopened: typeof import('../src/store/audioAssetStore');
    jest.isolateModules(() => { reopened = require('../src/store/audioAssetStore'); });
    expect(await reopened!.loadAudioAsset('reload')).toEqual({ base64: 'YQ==', mimeType: 'audio/wav' });
  });
  it('deletes only selected evidence and tolerates repeated deletion', async () => {
    await saveAudioAsset('one', { base64: 'YQ==', mimeType: 'audio/webm' });
    await saveAudioAsset('two', { base64: 'Yg==', mimeType: 'audio/webm' });
    await deleteAudioAssets(['one']); await deleteAudioAssets(['one']);
    expect(await loadAudioAsset('one')).toBeNull(); expect(await loadAudioAsset('two')).not.toBeNull();
  });
  it('surfaces quota/transaction failures without creating an asset and allows retry', async () => {
    failWrites = true;
    await expect(saveAudioAsset('quota', { base64: 'YQ==', mimeType: 'audio/wav' })).rejects.toThrow('Browser audio storage failed');
    expect(await loadAudioAsset('quota')).toBeNull();
    failWrites = false; await saveAudioAsset('quota', { base64: 'YQ==', mimeType: 'audio/wav' });
    expect(await loadAudioAsset('quota')).not.toBeNull();
  });
});
