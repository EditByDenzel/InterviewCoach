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
  Home: undefined;
  Interview: { topic: string };
  Summary: { rounds: InterviewRound[]; closingMessage: string; topic: string };
  Settings: undefined;
};
