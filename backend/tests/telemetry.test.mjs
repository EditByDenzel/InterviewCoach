import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveTimingEvents, validateTimingEvents } from '../telemetry.mjs';
import { createSpeechServer } from '../server.mjs';
const event = { id: 'event-1', sessionId: 'session-1', run: 'B', stage: 'tts.generate', at: new Date().toISOString(), durationMs: 1234, reused: false };
test('writes a separate append-only timeline for each conversation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'coachie-timing-'));
  try {
    await saveTimingEvents({ events: [event] }, dir); await saveTimingEvents({ events: [{ ...event, id: 'event-2' }] }, dir);
    const lines = (await readFile(join(dir, 'session-1.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(lines.length, 2); assert.equal(lines[1].durationMs, 1234); assert.ok(lines[0].receivedAt);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('rejects path traversal, invalid values, content and secret fields', () => {
  for (const patch of [{ sessionId: '../secret' }, { transcript: 'private words' }, { apiKey: 'secret' }, { durationMs: -1 }, { run: 'C' }, { at: 'invalid' }]) {
    assert.throws(() => validateTimingEvents({ events: [{ ...event, ...patch }] }));
  }
  assert.throws(() => validateTimingEvents({ events: Array(101).fill(event) }));
});
test('timing endpoint shares account authentication and never calls speech', async () => {
  let saved = 0;
  const server = createSpeechServer({ client: {}, token: 'test-key', origins: ['http://localhost:8083'], speak: async () => { throw new Error('Speech must not run'); }, saveTimings: async payload => { saved += payload.events.length; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/telemetry`;
    const headers = { Authorization:'Bearer test-key', 'Content-Type':'application/json', Origin:'http://localhost:8083' };
    assert.equal((await fetch(url, { method:'POST', body:JSON.stringify({events:[event]}) })).status, 401);
    assert.equal((await fetch(url, { method:'POST', headers, body:JSON.stringify({events:[{...event, transcript:'reject'}]}) })).status, 400);
    assert.equal((await fetch(url, { method:'POST', headers, body:JSON.stringify({events:[event]}) })).status, 200);
    assert.equal(saved, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
