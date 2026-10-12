jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { createTimingBacklog, TimingEvent } from '../src/services/conversationTelemetry';
const event = (id: string): TimingEvent => ({ id, sessionId: 'session-1', run: 'A', stage: 'transcription', at: new Date().toISOString(), durationMs: 30000, outcome: 'ok' });
function storage() {
  let raw: string | null = null;
  return { getItem: jest.fn(async () => raw), setItem: jest.fn(async (_: string, next: string) => { raw = next; }) };
}
it('persists timing events through an offline failure and retries after restart', async () => {
  const disk = storage(); const failed = jest.fn(async () => { throw new Error('Offline'); });
  const first = createTimingBacklog(disk, failed); const saved = event('one'); await first.record(saved); await first.flush();
  expect(JSON.parse((await disk.getItem())!)).toHaveLength(1);
  const send = jest.fn(async () => {}); const restarted = createTimingBacklog(disk, send); await restarted.flush();
  expect(send).toHaveBeenCalledWith([saved]);
  expect(JSON.parse((await disk.getItem())!)).toEqual([]);
});
it('orders concurrent record and flush operations and batches large backlogs', async () => {
  const disk = storage(); const send = jest.fn(async () => {}); const log = createTimingBacklog(disk, send);
  await Promise.all(Array.from({ length: 105 }, (_, i) => log.record(event(`e${i}`)))); await log.flush();
  expect(send.mock.calls.map(args => (args as any)[0].length)).toEqual([100, 5]);
  expect((send.mock.calls[0] as any)[0].map((e: TimingEvent) => e.id)).toEqual(Array.from({length:100}, (_,i) => `e${i}`));
});
