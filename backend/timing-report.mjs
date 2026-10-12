import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const directory = fileURLToPath(new URL('./private/conversation-timings/', import.meta.url));
const selected = process.argv[2];
if (selected && !/^[a-zA-Z0-9_.-]{1,160}$/.test(selected)) throw new Error('Invalid session ID');
const files = selected ? [`${selected}.jsonl`] : (await readdir(directory)).filter(file => file.endsWith('.jsonl') && !file.startsWith('diagnostic-'));
for (const file of files) {
  const raw = (await readFile(join(directory, file), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  // Delivery is at least once: deduplicate a retried batch by event ID.
  const events = [...new Map(raw.map(event => [event.id, event])).values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const stages = new Map();
  for (const event of events) {
    if (event.durationMs === undefined) continue;
    const label = `${event.run} ${event.stage}`;
    const group = stages.get(label) || []; group.push(event); stages.set(label, group);
  }
  console.log(`\nConversation ${file.replace(/\.jsonl$/, '')}: ${events.length} events`);
  for (const [label, group] of stages) {
    const values = group.map(event => event.durationMs).sort((a, b) => a - b);
    const percentile = fraction => Math.round(values[Math.max(0, Math.ceil(values.length * fraction) - 1)]);
    console.log(`${label}: n=${values.length}, p50=${percentile(.5)}ms, p95=${percentile(.95)}ms, errors=${group.filter(event => event.outcome === 'error').length}`);
  }
  let reply;
  for (const event of events) {
    if (event.stage === 'capture.finalized') reply = event;
    if (event.stage === 'audio.firstProgress' && reply && reply.run === event.run) {
      console.log(`${event.run} reply end -> next playback status: ${Date.parse(event.at) - Date.parse(reply.at)}ms`);
      reply = undefined;
    }
  }
}
