// ============================================================
// src/store/settingsStore.ts — AsyncStorage wrappers for settings
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, TTSProvider } from '../types';
import { designPreviewEnabled } from '../dev/designPreview';

const SETTINGS_KEY = '@interview_coach_settings';

const getEnvApiKey = () => (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

/** Default settings (can be pre-seeded by local .env file) */
const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: getEnvApiKey(),
  elevenLabsApiKey: '',
  ttsProvider: 'gemini',
  language: 'English',
  geminiVoice: 'Kore',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
};
let previewSettings = { ...DEFAULT_SETTINGS, geminiApiKey: 'design-preview-fixture' };

/**
 * Load settings from AsyncStorage.
 * Returns defaults if nothing has been saved yet.
 */
export async function loadSettings(): Promise<AppSettings> {
  if (designPreviewEnabled) return { ...previewSettings };
  const envKey = getEnvApiKey();
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, geminiApiKey: envKey };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // If parsed key is blank or empty, use the env key when available
      geminiApiKey: (parsed.geminiApiKey && parsed.geminiApiKey.trim()) || envKey,
    };
  } catch (err) {
    console.warn('[settingsStore] Failed to load settings:', err);
    return { ...DEFAULT_SETTINGS, geminiApiKey: envKey };
  }
}

/**
 * Persist settings to AsyncStorage.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  if (designPreviewEnabled) { previewSettings = { ...DEFAULT_SETTINGS, ...settings }; return; }
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[settingsStore] Failed to save settings:', err);
    throw err;
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  await saveSettings({ ...await loadSettings(), ...patch });
}

/**
 * Convenience: get just the Gemini API key.
 */
export async function getGeminiApiKey(): Promise<string> {
  const s = await loadSettings();
  return s.geminiApiKey;
}

/**
 * Convenience: get TTS provider.
 */
export async function getTTSProvider(): Promise<TTSProvider> {
  const s = await loadSettings();
  return s.ttsProvider;
}
