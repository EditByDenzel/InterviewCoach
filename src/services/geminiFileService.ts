import { audioBytes } from './audioWaveform';

const origin = 'https://generativelanguage.googleapis.com';
interface GeminiFile { name: string; uri: string; mimeType: string; state?: string }
export interface UploadedAudio { fileData: { fileUri: string; mimeType: string }; remove: () => Promise<void> }

// Bound response bodies as well as fetch. Never expose keys, signed upload URLs
// or provider bodies through errors/logs.
async function fileRequest<T>(url: string, init: RequestInit, read: (response: Response) => Promise<T>, timeoutMs = 240000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new Error('Gemini audio file request timed out. Please retry the comparison.')); controller.abort(); }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`Gemini audio file request failed (HTTP ${response.status}). Please retry the comparison.`);
      return read(response);
    })(), deadline]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

function validName(name: unknown): name is string {
  return typeof name === 'string' && /^files\/[\w-]+$/.test(name);
}
function googleUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== origin || url.username || url.password) throw new Error('Gemini returned an invalid audio upload address.');
  return url.href;
}

/** Upload original bytes unchanged. Each reference belongs only to this comparison. */
export async function uploadComparisonAudio(apiKey: string, audio: { base64: string; mimeType: string }): Promise<UploadedAudio> {
  const data = audioBytes(audio.base64);
  if (!data.length || !audio.mimeType.startsWith('audio/')) throw new Error('The saved audio cannot be uploaded for comparison.');
  const key = encodeURIComponent(apiKey);
  let file: GeminiFile | undefined;
  const remove = async () => {
    if (file && validName(file.name)) await fileRequest(`${origin}/v1beta/${file.name}?key=${key}`,
      { method: 'DELETE' }, async () => undefined, 10000);
  };
  try {
    const uploadUrl = await fileRequest(`${origin}/upload/v1beta/files?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(data.byteLength),
        'X-Goog-Upload-Header-Content-Type': audio.mimeType },
      body: JSON.stringify({ file: { display_name: 'Coachie comparison audio' } }),
    }, async response => {
      const address = response.headers.get('x-goog-upload-url');
      if (!address) throw new Error('Gemini did not provide an audio upload address. Please retry the comparison.');
      return googleUrl(address);
    });
    const uploaded = await fileRequest<{ file: GeminiFile }>(uploadUrl, {
      method: 'POST', headers: { 'Content-Type': audio.mimeType, 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' },
      body: data.buffer as ArrayBuffer,
    }, response => response.json());
    file = uploaded.file;
    if (!file || !validName(file.name)) throw new Error('Gemini returned invalid uploaded audio. Please retry the comparison.');
    let current: GeminiFile = file;
    const until = Date.now() + 120000;
    while (current.state === 'PROCESSING' && Date.now() < until) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const next: GeminiFile = await fileRequest<GeminiFile>(`${origin}/v1beta/${current.name}?key=${key}`, { method: 'GET' }, response => response.json(), 10000);
      if (next.name !== current.name) throw new Error('Gemini returned a different uploaded audio reference.');
      current = next;
      file = current;
    }
    if (current.state !== 'ACTIVE' || current.mimeType !== audio.mimeType || typeof current.uri !== 'string') {
      throw new Error('Gemini could not prepare the original audio. Please retry the comparison.');
    }
    return { fileData: { fileUri: googleUrl(current.uri), mimeType: current.mimeType }, remove };
  } catch (error) {
    await remove().catch(() => {});
    throw error;
  }
}
