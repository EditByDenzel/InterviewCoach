// ============================================================
// src/services/audioService.ts
// Wraps expo-av for:
//   - Playing back TTS audio (loudspeaker mode)
//   - Recording user answers (microphone mode)
//   - Reading recorded audio as base64 for transcription
// ============================================================

import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { designPreviewEnabled, designPreviewRecordingUri } from '../dev/designPreview';

let activeSound: Audio.Sound | null = null;
let finishPlayback: (() => Promise<void>) | null = null;
let playbackMuted = false;
let playbackGeneration = 0;
export type AudioExtension = 'wav' | 'mp3' | 'm4a' | 'mp4' | 'webm' | 'ogg' | 'aac' | 'caf';
const playbackMimeTypes: Record<AudioExtension, string> = {
  wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4',
  webm: 'audio/webm', ogg: 'audio/ogg', aac: 'audio/aac', caf: 'audio/x-caf',
};

export async function stopPlayback(): Promise<void> {
  playbackGeneration++;
  const sound = activeSound;
  activeSound = null;
  const finish = finishPlayback;
  finishPlayback = null;
  if (finish) await finish();
  else if (sound) await sound.unloadAsync();
}

export async function setPlaybackMuted(muted: boolean): Promise<void> {
  playbackMuted = muted;
  await activeSound?.setIsMutedAsync(muted);
}

// --------------- Playback ---------------------------------

/**
 * Configure Audio session for PLAYBACK (loudspeaker).
 * Must be called before playing audio.
 */
export async function setPlaybackMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false, // use loudspeaker
  });
}

/**
 * Configure Audio session for RECORDING.
 * Must be called before starting a recording.
 */
export async function setRecordingMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}

/**
 * Write base64 audio to a temp file and play it.
 * Waits until playback completes before resolving.
 *
 * @param base64Audio  Base64 encoded audio bytes
 * @param extension    File extension: 'wav' | 'mp3' (default 'wav')
 */
export async function playBase64Audio(
  base64Audio: string,
  extension: AudioExtension = 'wav',
  onProgress?: (positionMillis:number,durationMillis:number)=>void,
): Promise<void> {
  const stopping = stopPlayback();
  const generation = playbackGeneration;
  await stopping;
  if (generation !== playbackGeneration) return;
  await setPlaybackMode();
  if (generation !== playbackGeneration) return;

  // A cancelled creation must never overwrite another clip's backing file.
  const uri = `${FileSystem.cacheDirectory}tts_output_${generation}.${extension}`;
  const removeTempFile = async () => {
    if (Platform.OS !== 'web') {
      try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch (_) {}
    }
  };

  // Write the base64 data as a binary file
  if (Platform.OS !== 'web') {
    try {
      await FileSystem.writeAsStringAsync(uri, base64Audio, { encoding: FileSystem.EncodingType.Base64 });
    } catch (error) { await removeTempFile(); throw error; }
  }

  if (generation !== playbackGeneration) { await removeTempFile(); return; }
  let sound: Audio.Sound;
  try {
    ({ sound } = await Audio.Sound.createAsync(
      { uri: Platform.OS === 'web' ? `data:${playbackMimeTypes[extension]};base64,${base64Audio}` : uri },
      { shouldPlay: false, volume: 1.0, isMuted: playbackMuted, progressUpdateIntervalMillis:100 },
    ));
  } catch (error) { await removeTempFile(); throw error; }
  if (generation !== playbackGeneration) {
    try { await sound.unloadAsync(); } finally { await removeTempFile(); }
    return;
  }
  activeSound = sound;

  // Wait for playback to finish
  await new Promise<void>((resolve, reject) => {
    let cleanup: Promise<void> | null = null;
    const finish = (error?: Error): Promise<void> => {
      if (cleanup) return cleanup;
      clearTimeout(timeout);
      if (activeSound === sound) { activeSound = null; finishPlayback = null; }
      sound.setOnPlaybackStatusUpdate(null);
      cleanup = (async () => {
        try { await sound.unloadAsync(); }
        catch (unloadError) { reject(error ?? unloadError); return; }
        finally { await removeTempFile(); }
        if (error) reject(error); else resolve();
      })();
      return cleanup;
    };
    const timeout = setTimeout(() => { void finish(new Error('Audio playback timed out. Please replay the question.')); }, 120_000);
    finishPlayback = () => finish();
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (cleanup) return;
      if (!status.isLoaded) { if(status.error) void finish(new Error(status.error)); return; }
      try { onProgress?.(status.positionMillis,status.durationMillis??0); } catch (_) {}
      if (status.didJustFinish) void finish();
    });
    // Install completion/error handlers before playback, including very short clips.
    void sound.playAsync().catch(error => { void finish(error); });
  });
}

// --------------- Recording --------------------------------

let activeRecording: Audio.Recording | null = null;
let fixtureRecording=false;
let recordingGeneration = 0;
let recordingStart: Promise<void> | null = null;
let recordingPaused = false;
let pauseStartedAt = 0;
let pausedMillis = 0;
let recordingDetector: ((level: number, speaking: boolean) => void) | null = null;
let nativeMeterListener: ((status: Audio.RecordingStatus) => void) | null = null;
let resetRecordingDetector: (() => void) | null = null;

export async function pauseRecording(): Promise<void> {
  if(designPreviewEnabled)return;
  const recording = activeRecording;
  if (!recording || recordingPaused) return;
  // Block late meter samples as soon as pausing begins.
  recordingPaused = true;
  pauseStartedAt = Date.now();
  cleanUpVAD();
  try { await recording.pauseAsync(); }
  catch (error) {
    recordingPaused = false;
    pausedMillis += Date.now() - pauseStartedAt;
    setupWebVAD();
    throw error;
  }
}

export async function resumeRecording(): Promise<void> {
  if(designPreviewEnabled)return;
  const recording = activeRecording;
  if (!recording || !recordingPaused) return;
  await setRecordingMode();
  if (recording !== activeRecording) return;
  await recording.startAsync();
  if (recording !== activeRecording) return;
  pausedMillis += Date.now() - pauseStartedAt;
  recordingPaused = false;
  resetRecordingDetector?.();
  if (Platform.OS !== 'web') recording.setOnRecordingStatusUpdate(nativeMeterListener);
  setupWebVAD();
}

/**
 * Request microphone permission.
 * Returns true if granted, false otherwise.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if(designPreviewEnabled)return true;
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

let vadInterval: any = null;
let vadStream: any = null;
let vadAudioContext: any = null;
let vadGeneration = 0;

type AudioLevelCallback = (level: number) => void;
const audioLevelListeners = new Set<AudioLevelCallback>();

export function subscribeAudioLevel(callback: AudioLevelCallback): () => void {
  audioLevelListeners.add(callback);
  return () => { audioLevelListeners.delete(callback); };
}

function broadcastAudioLevel(level: number) {
  audioLevelListeners.forEach((fn) => {
    try { fn(level); } catch (_) {}
  });
}

function setupWebVAD() {
  if (Platform.OS !== 'web' || !activeRecording || recordingPaused) return;
  const generation = vadGeneration;
  try {
    const AudioContextClass = typeof window !== 'undefined' ? ((window as any).AudioContext || (window as any).webkitAudioContext) : null;
    if (!AudioContextClass || !navigator?.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (generation !== vadGeneration || !activeRecording || recordingPaused) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      vadStream = stream;
      vadAudioContext = new AudioContextClass();
      const source = vadAudioContext.createMediaStreamSource(stream);
      const analyser = vadAudioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      vadInterval = setInterval(() => {
        if (generation !== vadGeneration || recordingPaused) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        const normalized = Math.min(1, Math.max(0, (avg - 10) / 45));
        recordingDetector?.(normalized, avg > 14);
      }, 80);
    }).catch(() => { if (generation === vadGeneration) cleanUpVAD(); });
  } catch (_) {}
}

function cleanUpVAD() {
  vadGeneration++;
  broadcastAudioLevel(0);
  if (vadInterval) { clearInterval(vadInterval); vadInterval = null; }
  if (vadStream) {
    try { vadStream.getTracks().forEach((t: any) => t.stop()); } catch (_) {}
    vadStream = null;
  }
  if (vadAudioContext) {
    try { void Promise.resolve(vadAudioContext.close()).catch(() => {}); } catch (_) {}
    vadAudioContext = null;
  }
}

/**
 * Start recording user audio.
 * Uses HIGH_QUALITY preset which on Android records as AAC/M4A,
 * on iOS as AAC in M4A container.
 * Accepts optional onSilenceDetected callback for hands-free conversational flow.
 */
export async function startRecording(onSilenceDetected?: () => void, onIdleTimeout?: () => void): Promise<void> {
  if(designPreviewEnabled){fixtureRecording=true;return;}
  // A second start cancels the pending first start, then waits for its cleanup.
  const generation = ++recordingGeneration;
  const previousStart = recordingStart;
  const operation = (async () => {
  if (previousStart) await previousStart.catch(() => {});
  if (generation !== recordingGeneration) return;
  cleanUpVAD();
  if (activeRecording) {
    // Clean up any stale recording
    try {
      activeRecording.setOnRecordingStatusUpdate(null);
      await activeRecording.stopAndUnloadAsync();
    } catch (_) {}
    activeRecording = null;
  }

  await setRecordingMode();
  if (generation !== recordingGeneration) return;

  const recording = new Audio.Recording();
  try {
  await recording.prepareToRecordAsync({
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  if (generation !== recordingGeneration) {
    await recording.stopAndUnloadAsync();
    return;
  }
  recording.setProgressUpdateInterval(80);
  recordingPaused = false;
  pausedMillis = 0;
  {
    let speechStarted = false;
    let lastSpeechTime: number | null = null;
    let recordStartTime = Date.now();
    let fired = false;
    resetRecordingDetector = () => {
      fired = false;
      if (!speechStarted) recordStartTime = Date.now() - pausedMillis;
    };
    recordingDetector = (level, speaking) => {
      if (fired || recordingPaused || generation !== recordingGeneration) return;
      const now = Date.now() - pausedMillis;
      broadcastAudioLevel(level);
      if (speaking) {
        speechStarted = true;
        lastSpeechTime = now;
      } else {
        const callback = !speechStarted && now - recordStartTime > 7000 ? onIdleTimeout
          : speechStarted && lastSpeechTime !== null && now - lastSpeechTime > 2300 ? onSilenceDetected : undefined;
        if (!callback) return;
        fired = true;
        recording.setOnRecordingStatusUpdate(null);
        cleanUpVAD();
        callback();
      }
    };
    nativeMeterListener = (status) => {
      if (!status.isRecording || generation !== recordingGeneration) return;
      const metering = status.metering ?? -160;
      recordingDetector?.(Math.min(1, Math.max(0, (metering + 50) / 40)), metering > -38);
    };
    if (Platform.OS !== 'web') recording.setOnRecordingStatusUpdate(nativeMeterListener);
  }

  await recording.startAsync();
  if (generation !== recordingGeneration) {
    recording.setOnRecordingStatusUpdate(null);
    await recording.stopAndUnloadAsync();
    return;
  }
  activeRecording = recording;
  setupWebVAD();
  } catch (error) {
    recording.setOnRecordingStatusUpdate(null);
    try { await recording.stopAndUnloadAsync(); } catch (_) {}
    if (generation === recordingGeneration) {
      recordingDetector = null; nativeMeterListener = null; resetRecordingDetector = null; cleanUpVAD();
    }
    throw error;
  }
  })();
  recordingStart = operation;
  try { await operation; }
  finally { if (recordingStart === operation) recordingStart = null; }
}

/**
 * Stop recording and return the local file URI.
 */
export async function stopRecording(): Promise<string | null> {
  recordingGeneration++;
  cleanUpVAD();
  if(designPreviewEnabled){const uri=fixtureRecording?designPreviewRecordingUri:null;fixtureRecording=false;return uri;}
  if (recordingStart) await recordingStart.catch(() => {});
  recordingDetector = null;
  nativeMeterListener = null;
  resetRecordingDetector = null;
  if (!activeRecording) return null;

  const recording = activeRecording;
  activeRecording = null;
  recording.setOnRecordingStatusUpdate(null);
  try {
    await recording.stopAndUnloadAsync();
    return recording.getURI() ?? null;
  } finally { broadcastAudioLevel(0); }
}

/** Release the original capture only after its durable audio and metadata were saved. */
export async function releaseTemporaryRecording(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (uri.startsWith('blob:') && typeof URL !== 'undefined') URL.revokeObjectURL(uri);
    return;
  }
  const cache = FileSystem.cacheDirectory;
  if (!cache || !uri.startsWith('file:') || !uri.startsWith(cache)) return;
  const relative = uri.slice(cache.length);
  // The cleanup API must never delete persistent evidence or a cache directory.
  if (!relative || relative.endsWith('/') || /[?#]/.test(relative)) return;
  let decoded: string;
  try { decoded = decodeURIComponent(relative); } catch (_) { return; }
  if (decoded.split(/[\\/]/).some(segment => !segment || segment === '.' || segment === '..')) return;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.isDirectory) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

/**
 * Read a recorded audio file as a base64 string.
 * Returns both the base64 data and the detected MIME type.
 *
 * @param uri  Local file URI returned by stopRecording()
 */
export async function readAudioAsBase64(
  uri: string,
): Promise<{ base64: string; mimeType: string }> {
  let webMimeType = '';
  const base64 = Platform.OS === 'web' ? await new Promise<string>(async (resolve, reject) => {
    try {
      const blob = await (await fetch(uri)).blob();
      webMimeType = blob.type?.split(';')[0].trim() ?? '';
      const reader = new FileReader();
      reader.onload = () => {
        const data = typeof reader.result === 'string' ? reader.result.split(',')[1] : null;
        if (!data) reject(new Error('Recorded audio is empty or unreadable.'));
        else resolve(data);
      };
      reader.onerror = () => reject(new Error('Could not read recorded audio.'));
      reader.readAsDataURL(blob);
    } catch(error) { reject(error); }
  }) : await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine MIME type from extension
  const ext = uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    m4a: 'audio/m4a',
    aac: 'audio/aac',
    wav: 'audio/wav',
    mp4: 'audio/mp4',
    caf: 'audio/x-caf',
  };
  // Safari can record MP4 while Chromium records WebM. Blob URLs have no extension.
  const mimeType = Platform.OS === 'web' ? webMimeType || 'audio/webm' : mimeMap[ext] ?? 'audio/m4a';

  return { base64, mimeType };
}
