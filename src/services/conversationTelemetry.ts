import AsyncStorage from '@react-native-async-storage/async-storage';
import { appBackendUrl, backendAuthHeaders } from './backendUrl';
import { historyBackendEnabled } from './historyBackend';

export interface TimingEvent {
  id: string; sessionId: string; run: 'A' | 'B'; turnId?: string; voice?: string; language?: string;
  stage: string; at: string; durationMs?: number;
  outcome?: 'ok' | 'error'; reused?: boolean; audioSeconds?: number;
}
const storageKey = '@coachie_timing_outbox_v1';
/** Durable, ordered outbox. Timing never blocks recording or response generation. */
export function createTimingBacklog(storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>, send: (events: TimingEvent[]) => Promise<void>) {
  let chain: Promise<unknown> = Promise.resolve();
  const serial = (work: () => Promise<void>) => {
    chain = chain.then(work).catch(() => {});
    return chain as Promise<void>;
  };
  const read = async (): Promise<TimingEvent[]> => {
    const raw = await storage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  };
  return {
    record: (event: TimingEvent) => serial(async () => {
      const events = await read(); events.push(event);
      await storage.setItem(storageKey, JSON.stringify(events));
    }),
    flush: () => serial(async () => {
      let events = await read();
      while (events.length) {
        const batch = events.slice(0, 100);
        await send(batch); // Failure retains the entire unsent batch for next flush.
        events = events.slice(batch.length);
        await storage.setItem(storageKey, JSON.stringify(events));
      }
    }),
  };
}
let key = () => '';
export function configureTimingBacklog(getKey: () => string) { key = getKey; }
const backlog = createTimingBacklog(AsyncStorage, async events => {
  if (!historyBackendEnabled()) return;
  const base = appBackendUrl();
  if (!base || !key()) throw new Error('Timing backend not available');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base}/api/telemetry`, {
      method: 'POST', signal: controller.signal, credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...backendAuthHeaders(key()) },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) throw new Error('Timing upload failed');
  } finally { clearTimeout(timeout); }
});
let flushTimer: ReturnType<typeof setTimeout> | undefined;
export function recordTiming(context: Pick<TimingEvent, 'sessionId' | 'run' | 'turnId' | 'voice' | 'language'>, stage: string, details: Pick<TimingEvent, 'durationMs' | 'outcome' | 'reused' | 'audioSeconds'> = {}) {
  // Only these fields cross the network: no transcript, topic, audio, key or error body.
  void backlog.record({ ...context, ...details, stage, at: new Date().toISOString(), id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` });
  if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = undefined; void backlog.flush(); }, 1000);
}
export async function timeConversationStage<T>(context: Pick<TimingEvent, 'sessionId' | 'run' | 'turnId' | 'voice' | 'language'>, stage: string, work: () => Promise<T>): Promise<T> {
  const now = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
  const started = now();
  recordTiming(context, `${stage}.start`);
  try {
    const result = await work();
    recordTiming(context, stage, { outcome: 'ok', durationMs: Math.max(0, now() - started) });
    return result;
  } catch (error) {
    recordTiming(context, stage, { outcome: 'error', durationMs: Math.max(0, now() - started) });
    throw error;
  }
}
