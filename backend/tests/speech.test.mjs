import test from 'node:test';
import assert from 'node:assert/strict';
import { synthesize, resolveVoiceProfile } from '../speech.mjs';
import { createSpeechServer } from '../server.mjs';

const wav = Buffer.alloc(46);
wav.write('RIFF'); wav.writeUInt32LE(38, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(2, 40);
const audio = wav.toString('base64');
test('prefers persistent IDs regardless of stale metadata and rejects expired migration keys', () => {
  const expires_at = new Date(Date.now() + 86400000).toISOString();
  assert.equal(resolveVoiceProfile({ voice_id: 'voice_persistent', voice_key: 'voicekey_old', expires_at }, 'Onyi'), 'voice_persistent');
  assert.equal(resolveVoiceProfile({ voice_key: 'voicekey_old', expires_at }, 'Onyi'), 'voicekey_old');
  assert.equal(resolveVoiceProfile({ voice_id: 'voice_persistent', expires_at: '2020-01-01' }, 'Onyi'), 'voice_persistent');
  assert.throws(() => resolveVoiceProfile({ voice_key: 'voicekey_expired', expires_at: '2020-01-01' }, 'Onyi'), /expired/);
  assert.throws(() => resolveVoiceProfile(undefined, 'Chidera'), /not been initialized/);
});
test('preserves multilingual transcript and uses private voice key without exposing it', async () => {
  let request;
  const result = await synthesize({ interactions: { create: async body => { request = body; return { output_audio: { data: audio } }; } } }, { voice: 'Onyi', text: 'สวัสดี 123!', style: 'Warm' }, async () => 'voicekey_private');
  assert.equal(request.input[0].content[0].text, 'สวัสดี 123!');
  assert.equal(request.generation_config.speech_config[0].voice, 'voicekey_private');
  assert.equal(result.audio, audio);
  assert.ok(!JSON.stringify(result).includes('voicekey_private'));
});
test('audio-only transcribes before speaking and preserves the original language', async () => {
  const stages = [];
  const result = await synthesize({
    models: { generateContent: async () => { stages.push('transcribe'); return { text: 'Bonjour!', candidates: [{ finishReason: 'STOP' }] }; } },
    interactions: { create: async body => { stages.push(body.input[0].content[0].text); return { output_audio: { data: audio } }; } },
  }, { voice: 'Chidera', audio: { data: audio, mimeType: 'audio/wav' } }, async () => 'voicekey_private');
  assert.deepEqual(stages, ['transcribe', 'Bonjour!']); assert.equal(result.text, 'Bonjour!');
});
test('rejects truncated transcription and unexpected audio format', async () => {
  await assert.rejects(synthesize({ models: { generateContent: async () => ({ text: 'partial', candidates: [{ finishReason: 'MAX_TOKENS' }] }) } }, { voice: 'Onyi', audio: { data: audio, mimeType: 'audio/wav' } }, async () => 'key'), /not completed/);
  await assert.rejects(synthesize({ interactions: { create: async () => ({ output_audio: { data: 'YWJjZA==' } }) } }, { voice: 'Onyi', text: 'Hi' }, async () => 'key'), /unexpected audio format/);
});
test('validates null payload and malformed audio without provider requests', async () => {
  await assert.rejects(synthesize({}, null), /JSON object/);
  await assert.rejects(synthesize({}, { voice: 'Onyi', audio: { data: '!', mimeType: 'audio/wav' } }, async () => 'key'), /base64/);
});
test('endpoint authenticates, restricts origins, supports JSON and binary, and hides provider errors', async () => {
  let calls = 0;
  const server = createSpeechServer({ client: {}, token: 'test-account-key', origins: ['http://localhost:8083'], speak: async (_, body) => { calls++; if (body.text === 'fail') throw new Error('voicekey_secret'); return { audio, mimeType: 'audio/wav' }; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/tts`;
    const headers = { Authorization: 'Bearer test-account-key', 'Content-Type': 'application/json' };
    assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, Origin: 'https://untrusted.test' }, body: '{}' })).status, 403);
    assert.equal(calls, 0);
    const json = await fetch(url, { method: 'POST', headers, body: '{}' });
    assert.equal((await json.json()).audio, audio);
    const binary = await fetch(url, { method: 'POST', headers: { ...headers, Accept: 'audio/wav' }, body: '{}' });
    assert.deepEqual(Buffer.from(await binary.arrayBuffer()), wav);
    const failure = await fetch(url, { method: 'POST', headers, body: '{"text":"fail"}' });
    assert.equal(failure.status, 502); assert.ok(!(await failure.text()).includes('voicekey_secret'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
