import { SavedConversation } from '../types';

const sampleLabels: Record<string, string> = {
  'sample-mock-interview': 'Deploy Autonomous\nAI Agent',
  'sample-architecture': 'System\nArchitecture\nReview',
  'sample-behavioral': 'Behavioral STAR\nFramework',
};

/** Home and the sidebar share the same persisted library, including deletions. */
export function homeConversationCards(conversations: SavedConversation[]) {
  return [...conversations]
    .sort((a, b) => Number(!!a.isSample) - Number(!!b.isSample) || b.updatedAt.localeCompare(a.updatedAt))
    .map(conversation => ({
      id: conversation.id,
      label: conversation.isSample ? sampleLabels[conversation.id] || conversation.topic : conversation.topic,
      topic: conversation.topic,
      rounds: conversation.rounds.length,
      status: conversation.status === 'completed' ? 'Completed' : 'In progress',
      isRecent: !conversation.isSample,
      isAB: !!conversation.isAB,
      icon: conversation.isSample && conversation.id !== 'sample-mock-interview' ? 'architecture' as const : 'interview' as const,
    }));
}
