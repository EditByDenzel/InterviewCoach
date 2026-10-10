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

// Cover both the request and response body. Some runtimes or interrupted
// connections do not settle fetch promptly after abort, so also race a deadline.
export async function requestJson(url: string, init: RequestInit, stage: string, timeoutMs = 60000): Promise<any> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`Gemini ${stage} request timed out. Please try again.`));
      controller.abort();
    }, timeoutMs);
  });
  const request = async () => {
    const response = await designPreviewFetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Gemini ${stage} API error ${response.status}: ${message}`);
    }
    return response.json();
  };
  try {
    return await Promise.race([request(), deadline]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function readCompleteText(json: any, stage: 'text' | 'transcription'): string {
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error(`Gemini ${stage} was cut short. Please try again; the partial response was not accepted.`);
  }
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini ${stage} could not be completed (${candidate.finishReason}). Please try again.`);
  }
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.filter((part: any) => typeof part?.text === 'string' && !part.thought).map((part: any) => part.text).join('').trim()
    : '';
  if (!text) throw new Error(`Gemini returned empty ${stage} response`);
  return text;
}

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
        text: `You are a professional interviewer conducting a screening assessment for the topic: ${topic}. Speak and write all questions and feedback in ${language}. Ask one clear, realistic interview question at a time. Keep each question concise (2-3 sentences max). Sound natural and human. Do NOT start with greetings, pleasantries, small talk, or introductions (such as "Hello", "Hi", "Welcome to the interview", "Good morning", or "Nice to meet you"). Jump directly into your first interview question immediately. Do not number questions. After 5 questions, when given the signal, provide a warm, constructive closing summary of the candidate's performance based on their answers.`,
      },
    ],
  };

  // Append the new user prompt to history
  const contents: GeminiMessage[] = [
    ...history,
    { role: 'user', parts: [{ text: prompt }] },
  ];

  const isClosing = prompt.toLowerCase().includes('closing') || prompt.toLowerCase().includes('summary');
  const body = {
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: isClosing ? 260 : 120,
    },
  };

  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 'text');

  return readCompleteText(json, 'text');
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
  style: string = 'Speak clearly and naturally at a comfortable conversational pace.',
): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const body = {
    model: TTS_MODEL,
    input: [{type:'user_input',content:[{type:'text',text,annotations:[{type:'speech_metadata',style}]}]}],
    response_format: {type:'audio'},
    generation_config: {speech_config:[{voice:voiceName}]},
  };
  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  }, 'TTS', 120000);
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
      maxOutputTokens: 8192,
    },
  };

  const json = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 'transcribe');

  return readCompleteText(json, 'transcription');
}
