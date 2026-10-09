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

import { loadSettings, saveSettings, getGeminiApiKey, getTTSProvider } from '../src/store/settingsStore';

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
    });
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
});
