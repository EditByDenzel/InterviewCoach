import AsyncStorage from '@react-native-async-storage/async-storage';
import { ABSession, isABSession } from '../domain/abSession';
import { SavedConversation } from '../types';
import { loadConversations as loadLegacyConversations, saveConversation as saveLegacyConversation } from '../store/conversationStore';
import { listABSessions, saveABSession } from '../store/abSessionStore';

export interface CoachieExportBundle {
  version: 1;
  exportedAt: string;
  abSessions: ABSession[];
  legacyConversations: SavedConversation[];
}

/** Export all locally stored conversations into a portable JSON object */
export async function exportCoachieData(): Promise<CoachieExportBundle> {
  const [abSessions, legacyConversations] = await Promise.all([
    listABSessions(),
    loadLegacyConversations(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    abSessions,
    legacyConversations: legacyConversations.filter((c: SavedConversation) => !c.isSample),
  };
}

/** Import conversations from a parsed JSON export bundle */
export async function importCoachieData(bundle: unknown): Promise<{ abCount: number; legacyCount: number }> {
  if (!bundle || typeof bundle !== 'object') {
    throw new Error('Invalid export bundle: expected a JSON object.');
  }

  const data = bundle as Partial<CoachieExportBundle>;
  if (data.version !== 1 || !Array.isArray(data.abSessions) || !Array.isArray(data.legacyConversations)) {
    throw new Error('Invalid Coachie backup file format.');
  }

  let abCount = 0;
  for (const session of data.abSessions) {
    if (isABSession(session)) {
      await saveABSession(session);
      abCount++;
    }
  }

  let legacyCount = 0;
  for (const legacy of data.legacyConversations) {
    if (legacy && typeof legacy.id === 'string' && Array.isArray(legacy.rounds)) {
      await saveLegacyConversation(legacy);
      legacyCount++;
    }
  }

  return { abCount, legacyCount };
}
