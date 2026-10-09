// ============================================================
// src/types/index.ts — Shared TypeScript types
// ============================================================

/** TTS provider option */
export type TTSProvider = 'gemini' | 'elevenlabs';

/** App settings stored in AsyncStorage */
export interface AppSettings {
  geminiApiKey: string;
  elevenLabsApiKey: string;
  ttsProvider: TTSProvider;
  language?: string;
  geminiVoice?: string;
  elevenLabsVoiceId?: string;
}

/** A single conversational turn */
export interface ConversationTurn {
  role: 'interviewer' | 'candidate';
  text: string;
}

/** One Q&A round stored for summary */
export interface InterviewRound {
  question: string;
  answer: string;
  roundNumber: number;
}

export interface SavedConversation {
  isSample?: boolean;
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  rounds: InterviewRound[];
  currentQuestion: string;
  closingMessage: string;
  status: 'in_progress' | 'completed';
  language: string;
  voice: string;
}

/** State phases of the interview */
export type InterviewPhase =
  | 'idle'
  | 'generating_question'
  | 'speaking'
  | 'recording'
  | 'transcribing'
  | 'closing'
  | 'done';

/** Navigation param list */
export type RootStackParamList = {
  Home: { topic?: string } | undefined;
  Interview: { topic: string };
  Summary: { rounds: InterviewRound[]; closingMessage: string; topic: string; saveWarning?: string };
  Settings: undefined;
  Preferences: { page: 'language' | 'voice' | 'keys' | 'about' };
  Conversation: { id: string };
};
