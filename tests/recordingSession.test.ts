import { createRecordingSession, RecordingAdapter } from '../src/services/recordingSession';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture() {
  const adapter = {
    requestPermission: jest.fn(async (): Promise<boolean> => true),
    start: jest.fn(async (_silence: () => void, _idle: () => void) => {}),
    stop: jest.fn(async (): Promise<string | null> => 'recording.m4a'),
    pause: jest.fn(async () => {}), resume: jest.fn(async () => {}),
    canAccept: jest.fn(() => true),
    onFinalized: jest.fn(async (_uri: string, _seconds: number) => {}),
    onError: jest.fn(), onChange: jest.fn(),
  } satisfies RecordingAdapter;
  return { adapter, session: createRecordingSession(adapter) };
}

it('silence finalizes current capture once with current elapsed time', async () => {
  const { adapter, session } = fixture();
  await session.start();
  session.tick(17);
  const silence = adapter.start.mock.calls[0][0];
  silence(); silence();
  await flush();
  expect(adapter.start).toHaveBeenCalledTimes(1);
  expect(adapter.stop).toHaveBeenCalledTimes(1);
  expect(adapter.onFinalized).toHaveBeenCalledWith('recording.m4a', 17);
  expect(session.getSnapshot()).toMatchObject({ recording: false, busy: false, pendingUri: null });
});

it('does not pause an actively speaking answer at eight seconds', async () => {
  const { adapter, session } = fixture();
  await session.start();
  for (let i = 0; i < 20; i++) session.tick();
  expect(session.getSnapshot()).toMatchObject({ recording: true, paused: false, elapsedSeconds: 20 });
  expect(adapter.pause).not.toHaveBeenCalled();
});

it('idle pauses, resume retains capture and elapsed time, and replay preserves the answer', async () => {
  const { adapter, session } = fixture();
  await session.start(); session.tick(4);
  adapter.start.mock.calls[0][1]();
  await flush();
  session.tick(20);
  expect(session.getSnapshot()).toMatchObject({ recording: true, paused: true, elapsedSeconds: 4 });
  await session.resume(); session.tick(3);
  expect(await session.prepareForReplay()).toBe(true);
  expect(session.getSnapshot()).toMatchObject({ recording: true, paused: true, elapsedSeconds: 7 });
  await session.resume(); await session.end();
  expect(adapter.start).toHaveBeenCalledTimes(1);
  expect(adapter.onFinalized).toHaveBeenCalledWith('recording.m4a', 7);
});

it('ignores callbacks from earlier recordings', async () => {
  const { adapter, session } = fixture();
  await session.start();
  const [oldSilence, oldIdle] = adapter.start.mock.calls[0];
  await session.end(); await session.start();
  oldSilence(); oldIdle(); await flush();
  expect(adapter.stop).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot()).toMatchObject({ recording: true, paused: false });
});

it('retains failed-finalization audio for retry and reports the error', async () => {
  const { adapter, session } = fixture();
  adapter.onFinalized.mockRejectedValueOnce(new Error('Transcription failed'));
  await session.start(); session.tick(12);
  expect(await session.end()).toBe(false);
  expect(session.getSnapshot()).toMatchObject({ recording: false, busy: false, pendingUri: 'recording.m4a', elapsedSeconds: 12 });
  expect(adapter.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Transcription failed' }));
});

it('lets finalization start the next capture without the old action unlocking new work', async () => {
  const { adapter, session } = fixture();
  adapter.onFinalized.mockImplementationOnce(async () => {
    expect(session.getSnapshot().busy).toBe(false);
    expect(await session.start()).toBe(true);
  });
  await session.start();
  expect(await session.end()).toBe(true);
  expect(adapter.start).toHaveBeenCalledTimes(2);
  expect(session.getSnapshot()).toMatchObject({ recording: true, busy: false, elapsedSeconds: 0 });
});

it('reports denied permission and permits a later attempt', async () => {
  const { adapter, session } = fixture();
  adapter.requestPermission.mockResolvedValueOnce(false);
  expect(await session.start()).toBe(false);
  expect(adapter.start).not.toHaveBeenCalled();
  expect(adapter.onError).toHaveBeenCalledTimes(1);
  expect(await session.start()).toBe(true);
});

it('does not acquire microphone if closed while awaiting permission', async () => {
  const { adapter, session } = fixture();
  const permission = deferred<boolean>();
  adapter.requestPermission.mockReturnValueOnce(permission.promise);
  const starting = session.start();
  await session.dispose();
  permission.resolve(true);
  expect(await starting).toBe(false);
  expect(adapter.start).not.toHaveBeenCalled();
});

it('stops a recorder that finishes preparing after disposal', async () => {
  const { adapter, session } = fixture();
  const ready = deferred<void>();
  adapter.start.mockReturnValueOnce(ready.promise);
  const starting = session.start(); await flush();
  await session.dispose();
  const notifications = adapter.onChange.mock.calls.length;
  ready.resolve();
  expect(await starting).toBe(false);
  expect(adapter.stop).toHaveBeenCalledTimes(2);
  expect(adapter.onChange).toHaveBeenCalledTimes(notifications);
  expect(adapter.onFinalized).not.toHaveBeenCalled();
});

it('uses current acceptance state after asynchronous preparation', async () => {
  const { adapter, session } = fixture();
  const ready = deferred<void>();
  adapter.start.mockReturnValueOnce(ready.promise);
  const starting = session.start(); await flush();
  adapter.canAccept.mockReturnValue(false);
  ready.resolve(); await starting;
  expect(adapter.stop).toHaveBeenCalledTimes(1);
  expect(session.getSnapshot().recording).toBe(false);
});

it('reports recording failures and releases the operation guard', async () => {
  const { adapter, session } = fixture();
  adapter.start.mockRejectedValueOnce(new Error('Device busy'));
  expect(await session.start()).toBe(false);
  expect(adapter.stop).toHaveBeenCalledTimes(1);
  expect(adapter.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Device busy' }));
  expect(await session.start()).toBe(true);
  adapter.stop.mockResolvedValueOnce(null);
  expect(await session.end()).toBe(false);
  expect(session.getSnapshot()).toMatchObject({ recording: false, busy: false });
});
