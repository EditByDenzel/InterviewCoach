import { requestJson } from './geminiService';
import { appBackendUrl, backendAuthHeaders } from './backendUrl';
import { historyBackendEnabled } from './historyBackend';

export const CUSTOM_VOICES = ['Onyi', 'Chidera', 'Denzel'] as const;
export type CustomVoice = typeof CUSTOM_VOICES[number];
export const customVoiceBackendUrl = appBackendUrl;
export const isCustomVoice = (voice: string): voice is CustomVoice => CUSTOM_VOICES.some(name => name === voice);

/** Known persistent Google Voice IDs for cloned studio voices. */
export const CUSTOM_VOICE_IDS: Partial<Record<CustomVoice, string>> = {
  Onyi: 'voice_uu52ugbuzjxe',
};

export async function generateCustomVoiceAudio(
  apiKey: string,
  payload: { voice: CustomVoice; text?: string; style?: string; audio?: { data: string; mimeType: string } },
): Promise<string> {
  const base = customVoiceBackendUrl();
  // When a configured backend is available and usable on this device, route through the backend proxy.
  if (base && historyBackendEnabled()) {
    try {
      const response = await requestJson(base + '/api/tts', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...backendAuthHeaders(apiKey) },
        body: JSON.stringify(payload),
      }, 'custom voice', 240000);
      if (response.mimeType !== 'audio/wav' || typeof response.audio !== 'string' || !response.audio) throw new Error('Custom voice service returned invalid audio.');
      return response.audio;
    } catch (err) {
      // If direct ID exists, fall back rather than failing
      if (!CUSTOM_VOICE_IDS[payload.voice]) throw err;
    }
  }

  // Standalone mobile fallback: speak directly with Google using persistent Voice ID if known.
  const directId = CUSTOM_VOICE_IDS[payload.voice];
  if (directId && payload.text) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
    const body = {
      model: 'gemini-3.8-flash-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text: payload.text, annotations: [{ type: 'speech_metadata', style: payload.style || 'Speak clearly and naturally at a comfortable conversational pace.' }] }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: directId }] },
    };
    const json = await requestJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    }, 'TTS', 120000);
    const audioParts = (json.steps ?? []).filter((step: any) => step.type === 'model_output').flatMap((step: any) => step.content ?? []).filter((part: any) => part.type === 'audio');
    const base64Audio: string | undefined = audioParts[audioParts.length - 1]?.data;
    if (base64Audio) return base64Audio;
  }

  throw new Error('Custom voice service is not configured for ' + payload.voice + '. Set EXPO_PUBLIC_TTS_BACKEND_URL and restart the app.');
}
