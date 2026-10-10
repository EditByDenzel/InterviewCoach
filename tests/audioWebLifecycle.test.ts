const mockRecording = {
  prepareToRecordAsync: jest.fn(async () => {}), startAsync: jest.fn(async () => {}),
  pauseAsync: jest.fn(async () => {}), stopAndUnloadAsync: jest.fn(async () => {}),
  getURI: jest.fn(() => 'blob:recording'), setOnRecordingStatusUpdate: jest.fn(),
  setProgressUpdateInterval: jest.fn(),
};
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-file-system', () => ({ cacheDirectory: '', EncodingType: { Base64: 'base64' } }));
jest.mock('expo-av', () => ({ Audio: {
  setAudioModeAsync: jest.fn(async () => {}),
  Recording: jest.fn(() => mockRecording), RecordingOptionsPresets: { HIGH_QUALITY: {} },
} }));

import { startRecording, stopRecording, pauseRecording, resumeRecording, subscribeAudioLevel, readAudioAsBase64, releaseTemporaryRecording } from '../src/services/audioService';

describe('Web microphone lifecycle', () => {
  let energy = 0;
  let getUserMedia: jest.Mock;
  let stopTrack: jest.Mock;
  let closeContext: jest.Mock;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); energy = 0;
    stopTrack = jest.fn(); closeContext = jest.fn(async () => {});
    getUserMedia = jest.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] }));
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: class {
      close = closeContext;
      createMediaStreamSource() { return { connect: jest.fn() }; }
      createAnalyser() { return { fftSize: 256, frequencyBinCount: 128,
        getByteFrequencyData: (buffer: Uint8Array) => buffer.fill(energy) }; }
    } } });
  });
  afterEach(async () => {
    await stopRecording(); jest.useRealTimers();
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete (globalThis as any).navigator;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as any).window;
  });
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

  it('stops a permission stream that resolves after recording was stopped', async () => {
    let resolveStream: (stream: any) => void = () => {};
    getUserMedia.mockImplementationOnce(() => new Promise(resolve => { resolveStream = resolve; }));
    await startRecording(jest.fn(), jest.fn()); await stopRecording();
    resolveStream({ getTracks: () => [{ stop: stopTrack }] }); await flush();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('recognizes a one-word reply without the former 400ms speech gate', async () => {
    const silence = jest.fn(); const idle = jest.fn();
    await startRecording(silence, idle); await flush();
    energy = 30; jest.advanceTimersByTime(160);
    energy = 0; jest.advanceTimersByTime(2400);
    expect(silence).toHaveBeenCalledTimes(1); expect(idle).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalledTimes(1); expect(closeContext).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('suspends metering while paused and retains speech context on resume', async () => {
    const silence = jest.fn(); await startRecording(silence); await flush();
    energy = 30; jest.advanceTimersByTime(160); await pauseRecording();
    expect(stopTrack).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(20_000); energy = 0;
    await resumeRecording(); await flush(); jest.advanceTimersByTime(80);
    expect(silence).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2400); expect(silence).toHaveBeenCalledTimes(1);
  });

  it('meters manual capture and clears resources on stop', async () => {
    const level = jest.fn(); const unsubscribe = subscribeAudioLevel(level);
    await startRecording(); await flush(); energy = 30; jest.advanceTimersByTime(80);
    expect(level).toHaveBeenLastCalledWith(20 / 45);
    await stopRecording(); expect(level).toHaveBeenLastCalledWith(0); unsubscribe();
    expect(stopTrack).toHaveBeenCalledTimes(1); expect(closeContext).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps manual recording available if the auxiliary meter permission fails', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));
    await startRecording(jest.fn()); await flush();
    expect(jest.getTimerCount()).toBe(0);
    expect(await stopRecording()).toBe('blob:recording');
  });

  it.each(['audio/mp4', 'audio/webm;codecs=opus', 'audio/wav'])('uses the captured Blob MIME type %s for transcription', async type => {
    const fetchOriginal = globalThis.fetch;
    const readerOriginal = Object.getOwnPropertyDescriptor(globalThis, 'FileReader');
    globalThis.fetch = jest.fn(async () => ({ blob: async () => ({ type }) })) as any;
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
      result = `data:${type};base64,recorded-audio`;
      onload: (() => void) | null = null;
      readAsDataURL() { this.onload?.(); }
    } });
    try {
      expect(await readAudioAsBase64('blob:recording')).toEqual({ base64: 'recorded-audio', mimeType: type.split(';')[0] });
    } finally {
      globalThis.fetch = fetchOriginal;
      if (readerOriginal) Object.defineProperty(globalThis, 'FileReader', readerOriginal);
      else delete (globalThis as any).FileReader;
    }
  });
  it('revokes only temporary blob capture URLs, keeping data fixtures and permanent paths intact',async()=>{
    const revoke=jest.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
    try {
      await releaseTemporaryRecording('blob:captured-reply');
      await releaseTemporaryRecording('data:audio/wav;base64,YQ==');
      await releaseTemporaryRecording('file:///documents/reply.wav');
      expect(revoke).toHaveBeenCalledTimes(1);expect(revoke).toHaveBeenCalledWith('blob:captured-reply');
    }finally{revoke.mockRestore();}
  });
});
