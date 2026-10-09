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
let finishPlayback: (() => void) | null = null;
let playbackMuted = false;
let playbackGeneration = 0;

export async function stopPlayback(): Promise<void> {
  playbackGeneration++;
  const sound = activeSound;
  activeSound = null;
  finishPlayback?.();
  finishPlayback = null;
  if (sound) await sound.unloadAsync();
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
  extension: 'wav' | 'mp3' = 'wav',
  onProgress?: (positionMillis:number,durationMillis:number)=>void,
): Promise<void> {
  await stopPlayback();
  const generation = playbackGeneration;
  await setPlaybackMode();

  const uri = `${FileSystem.cacheDirectory}tts_output.${extension}`;

  // Write the base64 data as a binary file
  if (Platform.OS !== 'web') await FileSystem.writeAsStringAsync(uri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: Platform.OS === 'web' ? `data:audio/${extension === 'mp3' ? 'mpeg' : 'wav'};base64,${base64Audio}` : uri },
    { shouldPlay: true, volume: 1.0, isMuted: playbackMuted, progressUpdateIntervalMillis:100 },
  );
  if (generation !== playbackGeneration) { await sound.unloadAsync(); return; }
  activeSound = sound;

  // Wait for playback to finish
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      if (activeSound === sound) { activeSound = null; finishPlayback = null; }
      sound.setOnPlaybackStatusUpdate(null);
      sound.unloadAsync().then(() => error ? reject(error) : resolve(), unloadError => reject(error ?? unloadError));
    };
    const timeout = setTimeout(() => finish(), 120_000);
    finishPlayback = () => { clearTimeout(timeout); sound.setOnPlaybackStatusUpdate(null); resolve(); };
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (!status.isLoaded) { if(status.error) finish(new Error(status.error)); return; }
      onProgress?.(status.positionMillis,status.durationMillis??0);
      if (status.didJustFinish) finish();
    });
  });
}

// --------------- Recording --------------------------------

let activeRecording: Audio.Recording | null = null;
let fixtureRecording=false;

export async function pauseRecording(): Promise<void> {
  if(designPreviewEnabled)return;
  await activeRecording?.pauseAsync();
}

export async function resumeRecording(): Promise<void> {
  if(designPreviewEnabled)return;
  await activeRecording?.startAsync();
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

function setupWebVAD(onSilenceDetected?: () => void, onIdleTimeout?: () => void) {
  if (Platform.OS !== 'web' || (!onSilenceDetected && !onIdleTimeout)) return;
  try {
    const AudioContextClass = typeof window !== 'undefined' ? ((window as any).AudioContext || (window as any).webkitAudioContext) : null;
    if (!AudioContextClass || !navigator?.mediaDevices?.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      vadStream = stream;
      vadAudioContext = new AudioContextClass();
      const source = vadAudioContext.createMediaStreamSource(stream);
      const analyser = vadAudioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speechStarted = false;
      let speechStartTime = 0;
      let lastSpeechTime = 0;
      const recordStartTime = Date.now();

      vadInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;

        const now = Date.now();
        if (avg > 14) {
          if (!speechStarted) {
            if (!speechStartTime) speechStartTime = now;
            else if (now - speechStartTime > 400) {
              speechStarted = true;
            }
          }
          lastSpeechTime = now;
        } else {
          speechStartTime = 0;
          if (!speechStarted && now - recordStartTime > 7000) {
            cleanUpVAD();
            onIdleTimeout?.();
          } else if (speechStarted && lastSpeechTime > 0 && now - lastSpeechTime > 2300) {
            cleanUpVAD();
            onSilenceDetected?.();
          }
        }
      }, 100);
    }).catch(() => {});
  } catch (_) {}
}

function cleanUpVAD() {
  if (vadInterval) { clearInterval(vadInterval); vadInterval = null; }
  if (vadStream) {
    try { vadStream.getTracks().forEach((t: any) => t.stop()); } catch (_) {}
    vadStream = null;
  }
  if (vadAudioContext) {
    try { vadAudioContext.close(); } catch (_) {}
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
  cleanUpVAD();
  if (activeRecording) {
    // Clean up any stale recording
    try {
      await activeRecording.stopAndUnloadAsync();
    } catch (_) {}
    activeRecording = null;
  }

  await setRecordingMode();

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  if (Platform.OS !== 'web' && (onSilenceDetected || onIdleTimeout)) {
    let speechStarted = false;
    let lastSpeechTime = 0;
    const recordStartTime = Date.now();
    recording.setOnRecordingStatusUpdate((status) => {
      if (!status.isRecording) return;
      const now = Date.now();
      const metering = status.metering ?? -160;
      if (metering > -38) {
        speechStarted = true;
        lastSpeechTime = now;
      } else if (!speechStarted && now - recordStartTime > 7000) {
        recording.setOnRecordingStatusUpdate(null);
        onIdleTimeout?.();
      } else if (speechStarted && lastSpeechTime > 0 && now - lastSpeechTime > 2300) {
        recording.setOnRecordingStatusUpdate(null);
        onSilenceDetected?.();
      }
    });
  }

  await recording.startAsync();
  activeRecording = recording;

  if (Platform.OS === 'web') {
    setupWebVAD(onSilenceDetected, onIdleTimeout);
  }
}

/**
 * Stop recording and return the local file URI.
 */
export async function stopRecording(): Promise<string | null> {
  cleanUpVAD();
  if(designPreviewEnabled){const uri=fixtureRecording?designPreviewRecordingUri:null;fixtureRecording=false;return uri;}
  if (!activeRecording) return null;

  await activeRecording.stopAndUnloadAsync();
  const uri = activeRecording.getURI();
  activeRecording = null;
  return uri ?? null;
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
  const base64 = Platform.OS === 'web' ? await new Promise<string>(async (resolve, reject) => {
    try {
      const blob = await (await fetch(uri)).blob();
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read recorded audio.'));
      reader.readAsDataURL(blob);
    } catch(error) { reject(error); }
  }) : await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Determine MIME type from extension
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    m4a: 'audio/m4a',
    aac: 'audio/aac',
    wav: 'audio/wav',
    mp4: 'audio/mp4',
    caf: 'audio/x-caf',
  };
  const mimeType = uri.startsWith('data:audio/wav')?'audio/wav':Platform.OS === 'web' ? 'audio/webm' : mimeMap[ext] ?? 'audio/m4a';

  return { base64, mimeType };
}
