const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage[key] = value; }),
}));
jest.mock('../src/store/audioAssetStore', () => ({ deleteAudioAssets: jest.fn(async () => {}) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createABSession, startA, appendTurn, ABSession } from '../src/domain/abSession';
import { deleteAudioAssets } from '../src/store/audioAssetStore';
import { deleteABSession, listABSessions, loadABSession, saveABSession } from '../src/store/abSessionStore';

const fresh = (id: string, assets: string[] = []): ABSession => {
  let session = startA(createABSession({
    id: 'scenario', title: 'Trip', objective: 'Plan trip', role: 'Traveller', facts: [], constraints: [],
    language: 'Thai', minMinutes: 1, maxMinutes: 5,
  }, { voice: 'Kore', style: 'Ordinary adult' }));
  session = { ...session, id };
  for (let index = 0; index < assets.length; index++) session = appendTurn(session, {
    id: `${id}-turn-${index}`, run: 'A', speaker: 'model', sourceText: 'ภาษาไทย', englishText: 'English',
    audioAssetId: assets[index], createdAt: '2026-10-10T12:00:00Z',
  });
  return session;
};
beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  jest.clearAllMocks();
});

it('saves original and English text plus audio references until explicitly deleted', async () => {
  await saveABSession(fresh('one', ['evidence']));
  const loaded = await loadABSession('one');
  expect(loaded?.turns[0]).toMatchObject({ sourceText: 'ภาษาไทย', englishText: 'English', audioAssetId: 'evidence' });
  expect(deleteAudioAssets).not.toHaveBeenCalled();
  expect((await listABSessions()).map(session => session.id)).toEqual(['one']);
});

it('serializes concurrent saves, snapshots caller data, and makes reads await writes', async () => {
  const first = fresh('first');
  const saving = saveABSession(first);
  first.scenario.title = 'Changed later';
  const second = saveABSession({ ...fresh('second'), updatedAt: '2030-01-01T00:00:00Z' });
  const loaded = await listABSessions();
  await Promise.all([saving, second]);
  expect(loaded.map(session => session.id)).toEqual(['second', 'first']);
  expect(loaded[1].scenario.title).toBe('Trip');
});

it('deletes owned assets once but preserves recordings referenced by another session', async () => {
  mockStorage['@coachie_conversations_v1'] = 'legacy untouched';
  await saveABSession(fresh('first', ['private', 'shared', 'private']));
  await saveABSession(fresh('second', ['shared']));
  await deleteABSession('first');
  expect(deleteAudioAssets).toHaveBeenLastCalledWith(['private']);
  expect(await loadABSession('first')).toBeNull();
  expect(await loadABSession('second')).not.toBeNull();
  expect(mockStorage['@coachie_conversations_v1']).toBe('legacy untouched');
  await deleteABSession('second');
  expect(deleteAudioAssets).toHaveBeenLastCalledWith(['shared']);
  await deleteABSession('second');
  expect(deleteAudioAssets).toHaveBeenCalledTimes(2);
});

it('keeps metadata available for retry when audio deletion fails', async () => {
  await saveABSession(fresh('one', ['audio']));
  (deleteAudioAssets as jest.Mock).mockRejectedValueOnce(new Error('Disk unavailable'));
  await expect(deleteABSession('one')).rejects.toThrow('Disk unavailable');
  expect(await loadABSession('one')).not.toBeNull();
  await deleteABSession('one');
  expect(await loadABSession('one')).toBeNull();
});

it('persists and deletes pending untranslated recording evidence', async () => {
  const session = { ...fresh('one'), pendingReply: { id: 'pending', run: 'A' as const, audioAssetId: 'pending-audio', sourceText: 'ต้นฉบับ' } };
  await saveABSession(session);
  expect((await loadABSession('one'))?.pendingReply).toEqual(session.pendingReply);
  await deleteABSession('one');
  expect(deleteAudioAssets).toHaveBeenCalledWith(['pending-audio']);
});

it('does not destroy corrupt sessions while saving or deleting another session', async () => {
  const bad = fresh('broken', ['asset']);
  (bad.turns[0] as any).englishText = null;
  const original = JSON.stringify([fresh('valid'), bad]);
  mockStorage['@coachie_ab_sessions_v1'] = original;
  await expect(listABSessions()).rejects.toThrow('preserved');
  await expect(saveABSession(fresh('new'))).rejects.toThrow('preserved');
  await expect(deleteABSession('valid')).rejects.toThrow('preserved');
  expect(mockStorage['@coachie_ab_sessions_v1']).toBe(original);
  expect(deleteAudioAssets).not.toHaveBeenCalled();
});

it('recovers queued storage writes after failure without changing legacy history', async () => {
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));
  await expect(saveABSession(fresh('failed'))).rejects.toThrow('Storage full');
  await saveABSession(fresh('saved'));
  expect((await listABSessions()).map(session => session.id)).toEqual(['saved']);
});
