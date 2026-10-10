/** Coordinates one capture without closing over React render state. */
export interface RecordingSnapshot {
  recording: boolean;
  paused: boolean;
  elapsedSeconds: number;
  busy: boolean;
  /** Retained after a failed finalization, allowing the screen to retry it. */
  pendingUri: string | null;
}

export interface RecordingAdapter {
  requestPermission(): Promise<boolean>;
  start(onSilence: () => void, onIdle: () => void): Promise<unknown>;
  stop(): Promise<string | null>;
  pause(): Promise<unknown>;
  resume(): Promise<unknown>;
  canAccept(): boolean;
  onFinalized(uri: string, elapsedSeconds: number): Promise<void>;
  onError(error: Error): void;
  onChange?(snapshot: RecordingSnapshot): void;
}

export function createRecordingSession(adapter: RecordingAdapter) {
  let state: RecordingSnapshot = {
    recording: false, paused: false, elapsedSeconds: 0, busy: false, pendingUri: null,
  };
  let disposed = false;
  let captureId = 0;
  let operationId = 0;
  let disposal: Promise<void> | null = null;
  const active = () => !disposed && adapter.canAccept();
  const getSnapshot = (): RecordingSnapshot => ({ ...state });
  const change = (patch: Partial<RecordingSnapshot>) => {
    state = { ...state, ...patch };
    if (!disposed) adapter.onChange?.(getSnapshot());
  };
  const report = (error: unknown) => {
    adapter.onError(error instanceof Error ? error : new Error(String(error)));
  };
  // Public operations report errors and return false instead of creating
  // unhandled rejections when triggered by audio status callbacks.
  const run = async (action: (release: () => void) => Promise<boolean>): Promise<boolean> => {
    if (!active() || state.busy) return false;
    const id = ++operationId;
    const release = () => { if (id === operationId) change({ busy: false }); };
    change({ busy: true });
    try {
      return await action(release);
    } catch (error) {
      report(error);
      return false;
    } finally {
      release();
    }
  };

  const end = () => run(async release => {
    if (!state.recording) return false;
    // Stop callbacks from this capture before awaiting native finalization.
    const finalizedCapture = ++captureId;
    const seconds = state.elapsedSeconds;
    const uri = await adapter.stop();
    if (!active()) return false;
    change({ recording: false, paused: false, pendingUri: uri });
    if (!uri) throw new Error('Recording was not saved. Please record again.');
    // The screen's finalization can generate/play the next question and start
    // the next capture. Native stop is complete; do not lock that next turn.
    release();
    await adapter.onFinalized(uri, seconds);
    if (!active()) return false;
    if (captureId === finalizedCapture) change({ pendingUri: null });
    return true;
  });

  const pause = () => run(async () => {
    if (!state.recording) return false;
    if (state.paused) return true;
    await adapter.pause();
    if (!active()) return false;
    change({ paused: true });
    return true;
  });

  const resume = () => run(async () => {
    if (!state.recording) return false;
    if (!state.paused) return true;
    await adapter.resume();
    if (!active()) return false;
    change({ paused: false });
    return true;
  });

  const start = () => run(async () => {
    if (state.recording) return false;
    const id = ++captureId;
    if (!(await adapter.requestPermission())) {
      if (!active()) return false;
      throw new Error('Microphone access is required. Allow it in your device settings or type an answer.');
    }
    if (!active() || id !== captureId) return false;
    try {
      await adapter.start(
        () => {
          if (active() && id === captureId && state.recording && !state.paused) void end();
        },
        () => {
          if (active() && id === captureId && state.recording && !state.paused) void pause();
        },
      );
    } catch (error) {
      // Preparation can fail after the native recorder acquired the microphone.
      try { await adapter.stop(); } catch (cleanupError) { report(cleanupError); }
      throw error;
    }
    if (!active() || id !== captureId) {
      await adapter.stop();
      return false;
    }
    change({ recording: true, paused: false, elapsedSeconds: 0, pendingUri: null });
    return true;
  });

  const tick = (seconds = 1) => {
    if (active() && state.recording && !state.paused && !state.busy && Number.isFinite(seconds) && seconds > 0) {
      change({ elapsedSeconds: state.elapsedSeconds + seconds });
    }
  };

  const prepareForReplay = async (): Promise<boolean> => {
    if (!active() || !state.recording) return false;
    return pause();
  };

  const dispose = (): Promise<void> => {
    if (disposal) return disposal;
    disposed = true;
    captureId++;
    state = { ...state, recording: false, paused: false };
    disposal = adapter.stop().then(() => {}, report);
    return disposal;
  };

  return { start, end, pause, resume, prepareForReplay, tick, getSnapshot, dispose };
}
