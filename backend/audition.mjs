import { mkdir, writeFile } from 'node:fs/promises';
import { apiKey } from './config.mjs';

// Generates short private previews through the same endpoint used by the app.
// No voice keys, credentials or source recordings are printed.
await mkdir(new URL('./private/', import.meta.url), { recursive: true });
for (const voice of (process.argv.length > 2 ? process.argv.slice(2) : ['Onyi', 'Denzel'])) {
  if (!['Onyi', 'Chidera', 'Denzel'].includes(voice)) throw new Error('Choose Onyi or Denzel.');
  const response = await fetch('http://127.0.0.1:8787/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify({ voice, text: 'Hello! I am ready for our next conversation.', style: 'Warm and natural, with a comfortable conversational pace.' }),
    signal: AbortSignal.timeout(150000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${voice}: endpoint returned ${response.status}: ${result.error}`);
  const wav = Buffer.from(result.audio, 'base64');
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${voice}: Invalid WAV.`);
  await writeFile(new URL(`./private/${voice}-preview.wav`, import.meta.url), wav);
  console.log(`${voice}: endpoint generated a valid WAV (${wav.length} bytes), saved to backend/private/${voice}-preview.wav.`);
}
