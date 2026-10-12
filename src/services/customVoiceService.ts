import { requestJson } from './geminiService';
import { appBackendUrl } from './backendUrl';

export const CUSTOM_VOICES = ['Onyi', 'Chidera', 'Denzel'] as const;
export type CustomVoice = typeof CUSTOM_VOICES[number];
export const customVoiceBackendUrl = appBackendUrl;
export const isCustomVoice = (voice: string): voice is CustomVoice => CUSTOM_VOICES.some(name => name === voice);

export async function generateCustomVoiceAudio(
  apiKey: string,
  payload: { voice: CustomVoice; text?: string; style?: string; audio?: { data: string; mimeType: string } },
): Promise<string> {
  const base = customVoiceBackendUrl();
  if (!base) throw new Error('Custom voice service is not configured. Set EXPO_PUBLIC_TTS_BACKEND_URL and restart the app.');
  const response = await requestJson(`${base}/api/tts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  }, 'custom voice', 240000);
  if (response.mimeType !== 'audio/wav' || typeof response.audio !== 'string' || !response.audio) throw new Error('Custom voice service returned invalid audio.');
  return response.audio;
}
