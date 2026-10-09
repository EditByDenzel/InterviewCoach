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
    { shouldPlay: true, volume: 1.0, isMuted: playbackMuted },
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
      if (status.didJustFinish) finish();
    });
  });
}

// --------------- Recording --------------------------------

let activeRecording: Audio.Recording | null = null;

export async function pauseRecording(): Promise<void> {
  await activeRecording?.pauseAsync();
}

export async function resumeRecording(): Promise<void> {
  await activeRecording?.startAsync();
}

/**
 * Request microphone permission.
 * Returns true if granted, false otherwise.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Start recording user audio.
 * Uses HIGH_QUALITY preset which on Android records as AAC/M4A,
 * on iOS as AAC in M4A container.
 */
export async function startRecording(): Promise<void> {
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
  await recording.startAsync();
  activeRecording = recording;
}

/**
 * Stop recording and return the local file URI.
 */
export async function stopRecording(): Promise<string | null> {
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
  const mimeType = Platform.OS === 'web' ? 'audio/webm' : mimeMap[ext] ?? 'audio/m4a';

  return { base64, mimeType };
}
