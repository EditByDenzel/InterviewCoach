import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, model, profilePath } from './config.mjs';

// Private development inputs are ignored by Git and never bundled as app assets.
const recordingPath = name => fileURLToPath(new URL(`./private/recordings/${name}`, import.meta.url));
const pairs = [
  { name: 'Onyi', source: recordingPath('Onyi-reference.m4a'), consent: recordingPath('Onyi-consent.m4a') },
  { name: 'Denzel', source: recordingPath('Denzel-reference.m4a'), consent: recordingPath('Denzel-consent.m4a') },
];
// Optional portable JSON manifest: [{name,source,consent}].
const manifest = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : pairs;
const client = createClient();
await mkdir(path.dirname(profilePath), { recursive: true });
let profiles = {};
try { profiles = JSON.parse(await readFile(profilePath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'coachie-voices-'));
try {
  for (const pair of manifest) {
    try {
    if (!['Onyi', 'Chidera', 'Denzel'].includes(pair.name)) throw new Error('Unknown voice name.');
    const clips = {};
    for (const kind of ['source', 'consent']) {
      const output = path.join(temporaryDirectory, `${pair.name}-${kind}.wav`);
      if (kind === 'source') console.log(`${pair.name}: using up to the first 30 seconds of reference audio; original file is unchanged.`);
      execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', pair[kind], ...(kind === 'source' ? ['-t', '30'] : []), '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', output]);
      const wav = await readFile(output);
      // FFmpeg can emit metadata chunks, so find data rather than assuming a 44-byte header.
      let size = 0;
      for (let offset = 12; offset + 8 <= wav.length;) {
        const length = wav.readUInt32LE(offset + 4);
        if (wav.toString('ascii', offset, offset + 4) === 'data') { size = length; break; }
        offset += 8 + length + (length % 2);
      }
      const duration = size / (24000 * 2);
      if (!size || (kind === 'source' && (duration < 10 || duration > 30.5))) {
        throw new Error(`${pair.name} ${kind}: reference must contain 10–30 seconds of audio (got ${duration.toFixed(1)}s).`);
      }
      clips[kind] = { mime_type: 'audio/wav', data: wav.toString('base64') };
    }
    const voice = await client.voices.create({ store: true, voice: {
      model, type: 'replicated', display_name: pair.name,
      replicated: { source_audio: clips.source, consent_audio: clips.consent },
    } }, undefined, { timeout_ms: 120000 });
    if (!voice.id?.startsWith('voice_')) throw new Error(`${pair.name}: Google did not return a persistent voice ID.`);
    const expiry = new Date();
    expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
    profiles[pair.name] = { voice_id: voice.id, storage: 'stateful', created_at: new Date().toISOString(), expires_at: voice.expire_time || expiry.toISOString() };
    // Save each success so a failure on the second voice never loses the first key.
    const temporaryProfile = `${profilePath}.tmp`;
    await writeFile(temporaryProfile, JSON.stringify(profiles, null, 2), { mode: 0o600 });
    await rename(temporaryProfile, profilePath);
    console.log(`${pair.name}: persistent voice ID saved in backend/private/voices.json; one-year retention, ${voice.expire_time ? 'provider' : 'estimated'} expiry ${profiles[pair.name].expires_at}.`);
    } catch (error) {
      process.exitCode = 1;
      const consentFailed = /recorded phrase|Consent flow failed/i.test(error.message || '');
      console.error(`${pair.name}: ${consentFailed ? 'Google reported a consent phrase mismatch. The underlying cause has not been independently verified.' : error.status ? `Google voice creation failed (HTTP ${error.status}). Check account access and consent requirements.` : error.message}`);
    }
  }
} finally { await rm(temporaryDirectory, { recursive: true, force: true }); }
