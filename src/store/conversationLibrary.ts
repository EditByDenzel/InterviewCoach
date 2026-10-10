import { SavedConversation } from '../types';
import { loadConversationLibrary as loadLegacy, deleteConversation as deleteLegacy } from './conversationStore';
import { listABSessions, deleteABSession } from './abSessionStore';

export async function loadConversationLibrary(): Promise<SavedConversation[]> {
  const [legacy, sessions] = await Promise.all([loadLegacy(), listABSessions()]);
  const ab: SavedConversation[] = sessions.map(session => ({
    isAB: true, id: session.id, topic: session.scenario.title, createdAt: session.createdAt, updatedAt: session.updatedAt,
    status: session.status === 'completed' ? 'completed' : 'in_progress', language: session.scenario.language, voice: session.persona.voice,
    currentQuestion: '', closingMessage: session.comparison?.summary || '',
    rounds: session.turns.filter(t => t.speaker === 'model').map((t, i) => ({ roundNumber: i + 1,
      question: session.turns.slice(0, session.turns.indexOf(t)).filter(previous => previous.run === t.run && previous.speaker === 'tasker').at(-1)?.englishText || '', answer: t.englishText })),
  }));
  return [...ab, ...legacy].sort((a, b) => Number(!!a.isSample) - Number(!!b.isSample) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteConversation(id: string): Promise<void> {
  const sessions = await listABSessions();
  if (sessions.some(s => s.id === id)) await deleteABSession(id);
  else await deleteLegacy(id);
}
