// ============================================================
// src/store/settingsStore.ts — AsyncStorage wrappers for settings
// ============================================================
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, TTSProvider } from '../types';

const SETTINGS_KEY = '@interview_coach_settings';

/** Default empty settings */
const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  elevenLabsApiKey: '',
  ttsProvider: 'gemini',
};

/**
 * Load settings from AsyncStorage.
 * Returns defaults if nothing has been saved yet.
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('[settingsStore] Failed to load settings:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Persist settings to AsyncStorage.
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[settingsStore] Failed to save settings:', err);
    throw err;
  }
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
