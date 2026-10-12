import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { apiKey, createClient } from './config.mjs';
import { RequestError, synthesize } from './speech.mjs';
import { saveTimingEvents, validateTimingEvents } from './telemetry.mjs';

export function createSpeechServer({ client, token, origins, speak = synthesize, saveTimings = saveTimingEvents }) {
  let activeRequests = 0;
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
    if (origin && !origins.includes(origin)) return reply(403, { error: 'Origin is not allowed.' });
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    if (!['/api/tts', '/api/telemetry'].includes(request.url)) return reply(404, { error: 'Not found.' });
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'POST');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.writeHead(204); response.end(); return;
    }
    if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });
    // Single-owner app: authenticate with the existing locally saved Gemini key.
    // A multi-user deployment must replace this with verified user-session auth.
    const supplied = Buffer.from((request.headers.authorization || '').replace(/^Bearer /, ''));
    const expected = Buffer.from(token);
    if (!supplied.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, { error: 'Custom voice backend requires the configured Gemini account key.' });
    if (!(request.headers['content-type'] || '').startsWith('application/json')) return reply(415, { error: 'Send application/json.' });
    const telemetry = request.url === '/api/telemetry';
    if (!telemetry && activeRequests >= 2) return reply(429, { error: 'Speech service is busy. Please retry.' });
    if (!telemetry) activeRequests++;
    try {
      let length = 0; const chunks = [];
      for await (const chunk of request) {
        length += chunk.length;
        if (length > (telemetry ? 128 * 1024 : 12 * 1024 * 1024)) throw new RequestError(413, 'Request is too large.');
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new RequestError(400, 'Invalid JSON.'); }
      if (telemetry) {
        try { validateTimingEvents(payload); } catch { throw new RequestError(400, 'Invalid timing events.'); }
        await saveTimings(payload);
        return reply(200, { saved: payload.events.length });
      }
      const result = await speak(client, payload);
      if (request.headers.accept === 'audio/wav') {
        response.writeHead(200, { 'Content-Type': 'audio/wav' }); response.end(Buffer.from(result.audio, 'base64'));
      } else reply(200, result);
    } catch (error) {
      // Provider error bodies can include request data; never expose or log keys.
      reply(error instanceof RequestError ? error.status : 502, { error: error instanceof RequestError ? error.message : 'Google speech request failed. Check account access and voice consent, then retry.' });
    } finally { if (!telemetry) activeRequests--; }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createSpeechServer({ client: createClient(), token: apiKey(), origins: (process.env.TTS_ALLOWED_ORIGINS || 'http://localhost:8083,http://127.0.0.1:8083').split(',').map(value => value.trim()) });
  server.requestTimeout = 30000;
  server.listen(Number(process.env.TTS_PORT || 8787), process.env.TTS_HOST || '127.0.0.1', () => console.log('Coachie voice backend listening on port ' + (process.env.TTS_PORT || 8787)));
}
