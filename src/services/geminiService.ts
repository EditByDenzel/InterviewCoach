// ============================================================
// src/services/geminiService.ts
// Handles all Gemini API interactions:
//   1. Text generation  (gemini-3.8-flash)
//   2. TTS              (gemini-3.8-flash-tts)
//   3. Audio transcription via gemini-3.8-flash
// ============================================================

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
import { designPreviewFetch } from '../dev/designPreview';

// --------------- Model identifiers -------------------------
// Confirmed from ai.google.dev/gemini-api/docs/models (9 Oct 2026)
const TEXT_MODEL = 'gemini-3.8-flash';      // Latest stable Flash — long-horizon, agentic
const TTS_MODEL = 'gemini-3.8-flash-tts';   // Flagship TTS — studio-grade voice fidelity
const TRANSCRIBE_MODEL = 'gemini-3.8-flash'; // Flash handles audio understanding + transcription

// --------------- Conversation message type -----------------
export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

// ===========================================================
// 1. Generate interview question / closing message
// ===========================================================

/**
 * Call Gemini text model to generate the next interview question
 * or closing summary.
 *
 * @param apiKey    Gemini API key
 * @param topic     The interview topic (used in system instruction)
 * @param history   Full conversation history so far
 * @param prompt    The user-role prompt to send (e.g. "Ask the next question.")
 */
export async function generateInterviewText(
  apiKey: string,
  topic: string,
  history: GeminiMessage[],
  prompt: string,
  language: string = 'English',
): Promise<string> {
  const url = `${GEMINI_BASE}/${TEXT_MODEL}:generateContent?key=${apiKey}`;

  const systemInstruction = {
    parts: [
      {
        text: `You are a professional interviewer conducting a screening assessment for the topic: ${topic}. Speak and write all questions and feedback in ${language}. Ask one clear, realistic interview question at a time. Keep each question concise (2-3 sentences max). Sound natural and human. Do not number questions. After 5 questions, when given the signal, provide a warm, constructive closing summary of the candidate's performance based on their answers.`,
      },
    ],
  };

  // Append the new user prompt to history
  const contents: GeminiMessage[] = [
    ...history,
    { role: 'user', parts: [{ text: prompt }] },
  ];

  const body = {
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 300,
    },
  };

  const res = await designPreviewFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini text API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text) throw new Error('Gemini returned empty text response');
  return text.trim();
}

// ===========================================================
// 2. Gemini TTS — returns base64-encoded PCM/WAV audio
// ===========================================================

/**
 * Convert text to speech using Gemini TTS model.
 * Returns a base64 string of the audio data (WAV/PCM).
 *
 * @param apiKey  Gemini API key
 * @param text    Text to speak
 */
export async function generateGeminiTTS(
  apiKey: string,
  text: string,
  voiceName: string = 'Kore',
): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const body = {
    model: TTS_MODEL,
    input: [{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style:'Speak clearly and naturally at a comfortable conversational pace.'}]}]}],
    response_format: {type:'audio'},
    generation_config: {speech_config:[{voice:voiceName}]},
  };
  const res = await designPreviewFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini TTS API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const audioParts = (json.steps ?? []).filter((step:any)=>step.type==='model_output').flatMap((step:any)=>step.content ?? []).filter((part:any)=>part.type==='audio');
  const base64Audio: string | undefined = audioParts[audioParts.length-1]?.data;

  if (!base64Audio) {
    throw new Error('Gemini TTS returned no audio data');
  }

  return base64Audio; // caller writes this to a temp file
}

// ===========================================================
// 3. Transcribe audio using Gemini Flash (audio understanding)
// ===========================================================

/**
 * Transcribe recorded audio by sending it inline to Gemini Flash.
 *
 * @param apiKey    Gemini API key
 * @param base64Audio  Base64-encoded audio
 * @param mimeType  MIME type of the audio (e.g. 'audio/m4a', 'audio/wav')
 */
export async function transcribeAudio(
  apiKey: string,
  base64Audio: string,
  mimeType: string = 'audio/m4a',
): Promise<string> {
  const url = `${GEMINI_BASE}/${TRANSCRIBE_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Transcribe this audio accurately. Return only the spoken words, no labels or formatting.',
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
    },
  };

  const res = await designPreviewFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini transcribe API error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const transcript: string =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!transcript) throw new Error('Gemini transcription returned empty result');
  return transcript.trim();
}
