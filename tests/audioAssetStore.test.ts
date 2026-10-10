const mockFiles = new Map<string, string>();
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///documents/', EncodingType: { Base64: 'base64' },
  makeDirectoryAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockFiles.has(uri) })),
  writeAsStringAsync: jest.fn(async (uri: string, text: string) => { mockFiles.set(uri, text); }),
  readAsStringAsync: jest.fn(async (uri: string) => mockFiles.get(uri)),
  deleteAsync: jest.fn(async (uri: string) => { mockFiles.delete(uri); }),
}));
jest.mock('../src/services/audioService', () => ({ readAudioAsBase64: jest.fn(async () => ({ base64: 'YQ==', mimeType: 'audio/m4a' })) }));

import * as FileSystem from 'expo-file-system';
import { createAudioAssetStore, saveAudioAsset, loadAudioAsset, saveRecordedAudioAsset, deleteAudioAssets, AudioAsset } from '../src/store/audioAssetStore';
import { readAudioAsBase64 } from '../src/services/audioService';

describe('Permanent recording evidence on native devices', () => {
  beforeEach(() => { mockFiles.clear(); jest.clearAllMocks(); });
  it('stores binary evidence under documentDirectory with metadata containing no base64', async () => {
    expect(await saveAudioAsset('session:turn-1', { base64: 'YQ==', mimeType: 'audio/wav' })).toBe('session:turn-1');
    expect(mockFiles.get('file:///documents/coachie-audio-v1/session%3Aturn-1.wav')).toBe('YQ==');
    expect(JSON.parse(mockFiles.get('file:///documents/coachie-audio-v1/session%3Aturn-1.json')!)).toEqual({
      id: 'session:turn-1', mimeType: 'audio/wav', fileName: 'session%3Aturn-1.wav',
    });
    expect(await loadAudioAsset('session:turn-1')).toEqual({ base64: 'YQ==', mimeType: 'audio/wav' });
  });
  it('copies temporary captured evidence into durable storage before its source disappears', async () => {
    await saveRecordedAudioAsset('recorded', 'file:///cache/recording.m4a');
    expect(readAudioAsBase64).toHaveBeenCalledWith('file:///cache/recording.m4a');
    expect(await loadAudioAsset('recorded')).toEqual({ base64: 'YQ==', mimeType: 'audio/m4a' });
  });
  it('allows an idempotent save without overwriting a different clip', async () => {
    const asset = { base64: 'YQ==', mimeType: 'audio/wav' };
    await saveAudioAsset('same', asset); await saveAudioAsset('same', asset);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledTimes(2);
    await expect(saveAudioAsset('same', { base64: 'Yg==', mimeType: 'audio/wav' })).rejects.toThrow('already exists');
    expect(await loadAudioAsset('same')).toEqual(asset);
  });
  it('deletes explicitly requested IDs and preserves other session audio', async () => {
    await saveAudioAsset('a', { base64: 'YQ==', mimeType: 'audio/wav' });
    await saveAudioAsset('b', { base64: 'Yg==', mimeType: 'audio/mpeg' });
    await deleteAudioAssets(['a', 'a']); await deleteAudioAssets(['a']);
    expect(await loadAudioAsset('a')).toBeNull();
    expect(await loadAudioAsset('b')).toEqual({ base64: 'Yg==', mimeType: 'audio/mpeg' });
  });
  it('cleans partial files and reports storage failures without publishing an asset', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockImplementationOnce(async (uri: string) => {
      mockFiles.set(uri, 'partial'); throw new Error('Disk full');
    });
    await expect(saveAudioAsset('failure', { base64: 'YQ==', mimeType: 'audio/wav' })).rejects.toThrow('could not be saved permanently');
    expect(await loadAudioAsset('failure')).toBeNull(); expect(mockFiles.size).toBe(0);
  });
  it('reports missing binary evidence rather than silently losing it', async () => {
    await saveAudioAsset('missing', { base64: 'YQ==', mimeType: 'audio/wav' });
    mockFiles.delete('file:///documents/coachie-audio-v1/missing.wav');
    await expect(loadAudioAsset('missing')).rejects.toThrow('missing from device storage');
    await deleteAudioAssets(['missing']); expect(await loadAudioAsset('missing')).toBeNull();
  });
  it('does not follow a corrupted metadata path outside audio storage', async () => {
    mockFiles.set('file:///documents/coachie-audio-v1/corrupt.json', JSON.stringify({
      id: 'corrupt', mimeType: 'audio/wav', fileName: '../private.wav',
    }));
    await expect(loadAudioAsset('corrupt')).rejects.toThrow('metadata is damaged');
    await deleteAudioAssets(['corrupt']); expect(mockFiles.size).toBe(0);
  });
  it('preserves metadata for retry if audio deletion fails', async () => {
    await saveAudioAsset('retry', { base64: 'YQ==', mimeType: 'audio/wav' });
    (FileSystem.deleteAsync as jest.Mock).mockRejectedValueOnce(new Error('Device locked'));
    await expect(deleteAudioAssets(['retry'])).rejects.toThrow('retry deleting');
    expect(await loadAudioAsset('retry')).toEqual({ base64: 'YQ==', mimeType: 'audio/wav' });
    await deleteAudioAssets(['retry']); expect(await loadAudioAsset('retry')).toBeNull();
  });
  it.each([
    { base64: '', mimeType: 'audio/wav' }, { base64: 'not-base64!', mimeType: 'audio/wav' },
    { base64: 'YQ==', mimeType: 'image/png' },
  ])('rejects invalid input without creating storage files', async asset => {
    await expect(saveAudioAsset('invalid', asset)).rejects.toThrow(); expect(mockFiles.size).toBe(0);
  });
});

describe('Audio evidence persistence ordering', () => {
  it('finishes saving before a simultaneous deletion and recovers after an adapter error', async () => {
    const files = new Map<string, AudioAsset>();
    let release: () => void = () => {};
    const store = createAudioAssetStore({
      read: async id => files.get(id) ?? null,
      write: async (id, asset) => { await new Promise<void>(resolve => { release = resolve; }); files.set(id, asset); },
      remove: async id => { files.delete(id); },
    });
    const saving = store.saveAudioAsset('ordered', { base64: 'YQ==', mimeType: 'audio/wav' });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    const deleting = store.deleteAudioAssets(['ordered']);
    release(); await saving; await deleting;
    expect(await store.loadAudioAsset('ordered')).toBeNull();
    await expect(store.saveAudioAsset('', { base64: 'YQ==', mimeType: 'audio/wav' })).rejects.toThrow();
    expect(await store.loadAudioAsset('ordered')).toBeNull();
  });
});
