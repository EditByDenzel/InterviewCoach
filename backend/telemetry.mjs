import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const allowed = new Set(['id', 'sessionId', 'run', 'turnId', 'stage', 'at', 'durationMs', 'outcome', 'reused', 'audioSeconds', 'voice', 'language']);
export function validateTimingEvents(payload) {
  if (!Array.isArray(payload?.events) || !payload.events.length || payload.events.length > 100) throw new Error('Invalid timing batch');
  return payload.events.map(event => {
    if (!event || Object.keys(event).some(key => !allowed.has(key))) throw new Error('Unexpected timing field');
    for (const field of ['id', 'sessionId', 'stage']) if (typeof event[field] !== 'string' || !/^[a-zA-Z0-9_.-]{1,160}$/.test(event[field])) throw new Error('Invalid timing identifier');
    if (!['A', 'B'].includes(event.run) || typeof event.at !== 'string' || event.at.length > 40 || !Number.isFinite(Date.parse(event.at))) throw new Error('Invalid timing timestamp');
    if (event.turnId !== undefined && (typeof event.turnId !== 'string' || !/^[a-zA-Z0-9_.-]{1,160}$/.test(event.turnId))) throw new Error('Invalid turn ID');
    for (const field of ['durationMs', 'audioSeconds']) if (event[field] !== undefined && (!Number.isFinite(event[field]) || event[field] < 0)) throw new Error('Invalid duration');
    for (const field of ['voice', 'language']) if (event[field] !== undefined && (typeof event[field] !== 'string' || event[field].length > 100)) throw new Error('Invalid timing label');
    if (event.outcome !== undefined && !['ok', 'error'].includes(event.outcome)) throw new Error('Invalid outcome');
    if (event.reused !== undefined && typeof event.reused !== 'boolean') throw new Error('Invalid reuse flag');
    return { ...event, receivedAt: new Date().toISOString() };
  });
}
export async function saveTimingEvents(payload, directory = fileURLToPath(new URL('./private/conversation-timings/', import.meta.url))) {
  const events = validateTimingEvents(payload);
  await mkdir(directory, { recursive: true });
  const sessions = new Map();
  for (const event of events) {
    const lines = sessions.get(event.sessionId) || []; lines.push(JSON.stringify(event)); sessions.set(event.sessionId, lines);
  }
  for (const [sessionId, lines] of sessions) await appendFile(join(directory, `${sessionId}.jsonl`), `${lines.join('\n')}\n`, 'utf8');
}
