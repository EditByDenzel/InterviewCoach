import {
  generateInterviewText,
  generateGeminiTTS,
  transcribeAudio,
} from '../src/services/geminiService';

describe('Gemini Service', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('generateInterviewText', () => {
    it('sends prompt with correct Gemini 3.8 Flash model URL and formats body', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Tell me about a challenging project you built.' }],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await generateInterviewText(
        'mock-api-key',
        'React Native Engineer',
        [],
        'Start the interview.',
        'French',
      );

      expect(result).toBe('Tell me about a challenging project you built.');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = (global.fetch as jest.Mock).mock.calls[0];
      expect(calledUrl).toContain('gemini-3.8-flash:generateContent?key=mock-api-key');

      const body = JSON.parse(calledOptions.body);
      expect(body.systemInstruction.parts[0].text).toContain('React Native Engineer');
      expect(body.systemInstruction.parts[0].text).toContain('in French');
      expect(body.contents).toHaveLength(1);
      expect(body.contents[0].parts[0].text).toBe('Start the interview.');
    });

    it('throws error when Gemini API returns an error response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'API key invalid',
      } as any);

      await expect(
        generateInterviewText('bad-key', 'Topic', [], 'Prompt'),
      ).rejects.toThrow('Gemini text API error 403');
    });
  });

  describe('generateGeminiTTS', () => {
    it('requests audio modality and Kore voice from gemini-3.8-flash-tts', async () => {
      const mockBase64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: mockBase64,
                  },
                },
              ],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await generateGeminiTTS('mock-api-key', 'Hello world', 'Puck');

      expect(result).toBe(mockBase64);
      const [calledUrl, calledOptions] = (global.fetch as jest.Mock).mock.calls[0];
      expect(calledUrl).toContain('gemini-3.8-flash-tts:generateContent?key=mock-api-key');

      const body = JSON.parse(calledOptions.body);
      expect(body.generationConfig.responseModalities).toEqual(['AUDIO']);
      expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Puck');
    });
  });

  describe('transcribeAudio', () => {
    it('sends base64 audio and returns transcribed text', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'I built an e-commerce application using TypeScript.' }],
            },
          },
        ],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      const result = await transcribeAudio('mock-api-key', 'fake-base64-audio', 'audio/m4a');

      expect(result).toBe('I built an e-commerce application using TypeScript.');
      const [calledUrl, calledOptions] = (global.fetch as jest.Mock).mock.calls[0];
      expect(calledUrl).toContain('gemini-3.8-flash:generateContent?key=mock-api-key');

      const body = JSON.parse(calledOptions.body);
      expect(body.contents[0].parts[0].inlineData.mimeType).toBe('audio/m4a');
      expect(body.contents[0].parts[0].inlineData.data).toBe('fake-base64-audio');
    });
  });
});
