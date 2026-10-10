const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

import { loadSettings, saveSettings, updateSettings, getGeminiApiKey, getTTSProvider } from '../src/store/settingsStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Settings Store', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    jest.clearAllMocks();
  });

  it('returns default settings when storage is empty', async () => {
    const settings = await loadSettings();
    expect(settings).toEqual({
      geminiApiKey: '',
      elevenLabsApiKey: '',
      ttsProvider: 'gemini',
      language: 'English',
      geminiVoice: 'Kore',
      elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    });
  });

  it('migrates old settings and preserves keys across preference page saves', async () => {
    await saveSettings({geminiApiKey:'existing-key',elevenLabsApiKey:'existing-eleven',ttsProvider:'gemini'});
    expect((await loadSettings()).language).toBe('English');
    await updateSettings({language:'French'});
    await updateSettings({geminiVoice:'Puck'});
    expect(await loadSettings()).toMatchObject({geminiApiKey:'existing-key',elevenLabsApiKey:'existing-eleven',language:'French',geminiVoice:'Puck'});
  });

  it('saves and reloads user settings correctly', async () => {
    await saveSettings({
      geminiApiKey: 'test-gemini-key',
      elevenLabsApiKey: 'test-eleven-key',
      ttsProvider: 'elevenlabs',
    });

    const loaded = await loadSettings();
    expect(loaded.geminiApiKey).toBe('test-gemini-key');
    expect(loaded.elevenLabsApiKey).toBe('test-eleven-key');
    expect(loaded.ttsProvider).toBe('elevenlabs');

    expect(await getGeminiApiKey()).toBe('test-gemini-key');
    expect(await getTTSProvider()).toBe('elevenlabs');
  });

  it('serializes rapid preference changes without losing another page or key update', async () => {
    await Promise.all([
      saveSettings({ geminiApiKey: 'preserved-key', elevenLabsApiKey: '', ttsProvider: 'gemini' }),
      updateSettings({ language: 'Thai' }),
      updateSettings({ geminiVoice: 'Puck' }),
    ]);
    expect(await loadSettings()).toMatchObject({ geminiApiKey: 'preserved-key', language: 'Thai', geminiVoice: 'Puck' });
  });

  it('recovers the write queue after a storage failure', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));
      await expect(updateSettings({ language: 'Thai' })).rejects.toThrow('Storage full');
      await updateSettings({ geminiVoice: 'Puck' });
      expect((await loadSettings()).geminiVoice).toBe('Puck');
    } finally {
      warning.mockRestore();
    }
  });
});
