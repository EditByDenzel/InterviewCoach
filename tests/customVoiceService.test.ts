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
  it('synthesizes known standalone voice directly with persistent Google Voice ID when backend is unconfigured', async () => {
    delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
    const mockJson = { steps: [{ type: 'model_output', content: [{ type: 'audio', data: 'DIRECT_AUDIO_BASE64' }] }] };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => mockJson });
    expect(await generateGeminiTTS('key', 'Hello', 'Onyi')).toBe('DIRECT_AUDIO_BASE64');
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(JSON.parse(request.body).generation_config.speech_config[0].voice).toBe('voice_uu52ugbuzjxe');
  });
  it('reports missing configuration for unknown voice instead of sending a custom alias to Google', async () => {
    delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
    global.fetch = jest.fn();
    await expect(generateGeminiTTS('key', 'Hello', 'Chidera')).rejects.toThrow('not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
