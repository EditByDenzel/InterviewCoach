import { generateGeminiTTS } from '../src/services/geminiService';

describe('Custom voice routing', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
    else process.env.EXPO_PUBLIC_TTS_BACKEND_URL = originalUrl;
  });
  it.each(['Onyi', 'Chidera', 'Denzel'])('routes %s through backend and preserves wording/style', async voice => {
    process.env.EXPO_PUBLIC_TTS_BACKEND_URL = 'http://localhost:8787/';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ mimeType: 'audio/wav', audio: 'UklGRg==' }) });
    expect(await generateGeminiTTS('local-key', 'สวัสดี!', voice, 'Calm')).toBe('UklGRg==');
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:8787/api/tts');
    expect(JSON.parse(request.body)).toEqual({ text: 'สวัสดี!', voice, style: 'Calm' });
    expect(request.headers.Authorization).toBe('Bearer local-key');
  });
  it('reports missing configuration instead of sending a custom alias to Google', async () => {
    delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
    global.fetch = jest.fn();
    await expect(generateGeminiTTS('key', 'Hello', 'Onyi')).rejects.toThrow('not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
