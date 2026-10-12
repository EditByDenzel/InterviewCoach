import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

export const profilePath = fileURLToPath(new URL('./private/voices.json', import.meta.url));
export const model = 'gemini-3.8-flash-tts';
export function apiKey() {
  const key = (process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('Set GEMINI_API_KEY in the server environment or local .env.');
  return key;
}
export function createClient() {
  return new GoogleGenAI({ apiKey: apiKey(), httpOptions: { timeout: 120000 } });
}
