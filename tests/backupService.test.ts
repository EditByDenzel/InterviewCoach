const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage[key] = value; }),
  clear: jest.fn(async () => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  }),
}));
jest.mock('../src/store/audioAssetStore', () => ({
  deleteAudioAssets: jest.fn(async () => {}),
  migrateAudioAssets: jest.fn(async () => {}),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportCoachieData, importCoachieData } from '../src/services/backupService';
import { createABSession, startA, appendTurn, ABSession } from '../src/domain/abSession';
import { saveABSession, listABSessions } from '../src/store/abSessionStore';
import { saveConversation, loadConversations } from '../src/store/conversationStore';
import { SavedConversation } from '../src/types';

describe('backupService', () => {
  beforeEach(async () => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    jest.clearAllMocks();
  });

  const createSampleSession = (id: string): ABSession => {
    let session = startA(createABSession({
      id: 'sc-1',
      title: 'Coding Interview Prep',
      objective: 'System design question',
      role: 'Interviewer',
      facts: [],
      constraints: [],
      language: 'English',
      minMinutes: 1,
      maxMinutes: 5,
    }, { voice: 'Kore', style: 'Professional' }));
    session = { ...session, id };
    session = appendTurn(session, {
      id: `${id}-turn-1`,
      run: 'A',
      speaker: 'model',
      sourceText: 'How would you scale a cache?',
      englishText: 'How would you scale a cache?',
      createdAt: '2026-10-12T10:00:00.000Z',
    });
    return session;
  };

  const sampleLegacy: SavedConversation = {
    id: 'legacy-test-1',
    topic: 'Behavioral Prep',
    createdAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-10-12T09:30:00.000Z',
    status: 'completed',
    language: 'English',
    voice: 'Kore',
    currentQuestion: 'Tell me about yourself',
    closingMessage: 'Well done',
    rounds: [
      {
        roundNumber: 1,
        question: 'Tell me about yourself',
        answer: 'I am a software engineer.',
      },
    ],
  };

  test('exports and imports A/B sessions and legacy conversations correctly', async () => {
    const session = createSampleSession('session-test-1');
    await saveABSession(session);
    await saveConversation(sampleLegacy);

    const bundle = await exportCoachieData();
    expect(bundle.version).toBe(1);
    expect(bundle.abSessions.length).toBeGreaterThanOrEqual(1);
    expect(bundle.legacyConversations.length).toBeGreaterThanOrEqual(1);

    // Clear local storage to simulate a new device or backup restore
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];

    const emptyABSessions = await listABSessions();
    expect(emptyABSessions.find(s => s.id === session.id)).toBeUndefined();

    // Import the bundle
    const result = await importCoachieData(bundle);
    expect(result.abCount).toBeGreaterThanOrEqual(1);
    expect(result.legacyCount).toBeGreaterThanOrEqual(1);

    // Verify data restored
    const restoredABSessions = await listABSessions();
    const restoredLegacy = await loadConversations();

    expect(restoredABSessions.some(s => s.id === session.id)).toBe(true);
    expect(restoredLegacy.some(l => l.id === sampleLegacy.id)).toBe(true);
  });

  test('rejects invalid backup format', async () => {
    await expect(importCoachieData(null)).rejects.toThrow('Invalid export bundle');
    await expect(importCoachieData({ version: 2 })).rejects.toThrow('Invalid Coachie backup file format');
    await expect(importCoachieData({ version: 1, abSessions: 'not-array' })).rejects.toThrow('Invalid Coachie backup file format');
  });
});
