import { generateGeminiTTS, generateInterviewText, transcribeAudio } from '../src/services/geminiService';

const response = (parts: unknown[], finishReason = 'STOP') => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts }, finishReason }] }),
} as Response);

describe('Gemini request recovery', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('keeps all spoken text parts and excludes internal thought text', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([
      { text: 'internal reasoning', thought: true },
      { text: 'วันเสาร์ ' }, { text: 'งบ 3,000 บาท' },
    ]));
    expect(await transcribeAudio('test-key', 'audio')).toBe('วันเสาร์ งบ 3,000 บาท');
    expect(await generateInterviewText('test-key', 'Topic', [], 'Next')).toBe('วันเสาร์ งบ 3,000 บาท');
  });

  it('rejects a truncated transcript instead of accepting a partial answer', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([{ text: 'Partial answer' }], 'MAX_TOKENS'));
    await expect(transcribeAudio('test-key', 'audio')).rejects.toThrow('partial response was not accepted');
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4096);
  });

  it('rejects interrupted safety output and blank output', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(response([{ text: 'Partial answer' }], 'SAFETY'))
      .mockResolvedValueOnce(response([{ text: '   ' }]));
    await expect(transcribeAudio('test-key', 'audio')).rejects.toThrow('could not be completed');
    await expect(transcribeAudio('test-key', 'audio')).rejects.toThrow('empty transcription');
  });

  it.each([
    ['text', () => generateInterviewText('test-key', 'Topic', [], 'Next'), 60000],
    ['transcribe', () => transcribeAudio('test-key', 'audio'), 60000],
    ['TTS', () => generateGeminiTTS('test-key', 'Question'), 120000],
  ] as const)('bounds a stalled %s request even if fetch ignores cancellation', async (_, action, deadline) => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    global.fetch = jest.fn().mockImplementation((_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    });
    const check = expect(action()).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(deadline);
    await check;
    expect(signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('also bounds a stalled response body and clears successful request deadlines', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    const check = expect(transcribeAudio('test-key', 'audio')).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(60000);
    await check;
    global.fetch = jest.fn().mockResolvedValue(response([{ text: 'Complete.' }]));
    expect(await transcribeAudio('test-key', 'audio')).toBe('Complete.');
    expect(jest.getTimerCount()).toBe(0);
  });
});
