// ============================================================
// src/services/elevenLabsService.ts
// ElevenLabs TTS fallback — returns binary audio (mp3) as base64
// ============================================================

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
import { designPreviewEnabled } from '../dev/designPreview';

/** Default voice: Rachel (natural female) */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

/**
 * Generate TTS audio via ElevenLabs.
 * Returns base64-encoded MP3 audio.
 *
 * @param apiKey  ElevenLabs API key
 * @param text    Text to convert to speech
 * @param voiceId Optional voice ID (defaults to Rachel)
 */
export async function generateElevenLabsTTS(
  apiKey: string,
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<string> {
  if (designPreviewEnabled) throw new Error('This design demo supports Gemini voices only. Use the normal app to test ElevenLabs.');
  const url = `${ELEVEN_BASE}/${voiceId}`;

  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API error ${res.status}: ${errText}`);
  }

  // Convert binary response → base64
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64;
}
