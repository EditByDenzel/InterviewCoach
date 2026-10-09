// ============================================================
// src/services/audioService.ts
// Wraps expo-av for:
//   - Playing back TTS audio (loudspeaker mode)
//   - Recording user answers (microphone mode)
//   - Reading recorded audio as base64 for transcription
// ============================================================

import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';

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
  await setPlaybackMode();

  const uri = `${FileSystem.cacheDirectory}tts_output.${extension}`;

  // Write the base64 data as a binary file
  await FileSystem.writeAsStringAsync(uri, base64Audio, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume: 1.0 },
  );

  // Wait for playback to finish
  await new Promise<void>((resolve, reject) => {
    sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        sound.unloadAsync().finally(resolve);
      }
    });
    // Safety timeout: 2 minutes max
    setTimeout(() => {
      sound.unloadAsync().finally(resolve);
    }, 120_000);
  });
}

// --------------- Recording --------------------------------

let activeRecording: Audio.Recording | null = null;

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
  const base64 = await FileSystem.readAsStringAsync(uri, {
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
  const mimeType = mimeMap[ext] ?? 'audio/m4a';

  return { base64, mimeType };
}
