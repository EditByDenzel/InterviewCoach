import { generateGeminiTTS, generateInterviewText, GeminiMessage, transcribeAudio } from '../src/services/geminiService';

// Service-boundary regression tests for the foundations retained by the A/B plan.
// These do not claim that the future A/B controller or translation UI exists.
describe('Conversation context and source-language preservation', () => {
  const originalFetch = global.fetch;
  const textResponse = (text: string) => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  } as Response);

  afterEach(() => { global.fetch = originalFetch; });

  it('retains earlier constraints and corrections without mutating caller history', async () => {
    const history: GeminiMessage[] = [
      { role: 'model', parts: [{ text: 'คุณมีงบเท่าไร' }] },
      { role: 'user', parts: [{ text: 'Budget is 3,000 baht; travel on Friday.' }] },
      { role: 'model', parts: [{ text: 'เดินทางวันศุกร์ใช่ไหม' }] },
      { role: 'user', parts: [{ text: 'Correction: Saturday, still 3,000 baht.' }] },
    ];
    const snapshot = JSON.stringify(history);
    history.forEach(turn => {
      turn.parts.forEach(Object.freeze);
      Object.freeze(turn.parts);
      Object.freeze(turn);
    });
    Object.freeze(history);
    const mockFetch = jest.fn().mockResolvedValue(textResponse('คุณอยากเดินทางช่วงไหน'));
    global.fetch = mockFetch;

    await generateInterviewText('test-only-key', 'Travel', history, 'Continue.', 'Thai');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.contents.slice(0, history.length)).toEqual(history);
    expect(body.contents[history.length].parts[0].text).toBe('Continue.');
    expect(JSON.stringify(history)).toBe(snapshot);
  });

  it('does not leak supplied Model A history into a separate Model B request', async () => {
    const marker = 'A_ONLY_PRIVATE_RESPONSE_9731';
    const aHistory: GeminiMessage[] = [{ role: 'user', parts: [{ text: marker }] }];
    const bHistory: GeminiMessage[] = [];
    const mockFetch = jest.fn().mockResolvedValue(textResponse('What matters most?'));
    global.fetch = mockFetch;

    await Promise.all([
      generateInterviewText('test-only-key', 'Shared scenario', aHistory, 'Continue A.'),
      generateInterviewText('test-only-key', 'Shared scenario', bHistory, 'Begin B.'),
    ]);

    const requests = mockFetch.mock.calls.map(call => JSON.parse(call[1].body));
    const a = requests.find(body => body.contents.at(-1).parts[0].text === 'Continue A.');
    const b = requests.find(body => body.contents.at(-1).parts[0].text === 'Begin B.');
    expect(JSON.stringify(a)).toContain(marker);
    expect(JSON.stringify(b)).not.toContain(marker);
    expect(bHistory).toEqual([]);
  });

  it('sends Thai wording to TTS unchanged, including punctuation and numerals', async () => {
    const spokenText = 'ถ้ามีงบ 3,000 บาท ควรเลือกแบบไหน?';
    const audio = 'test-audio-payload';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: audio }] }] }),
    });
    global.fetch = mockFetch;

    expect(await generateGeminiTTS('test-only-key', spokenText, 'Puck')).toBe(audio);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input[0].content[0].text).toBe(spokenText);
  });

  it('preserves the returned Thai transcript for later translation and evaluation', async () => {
    const originalThai = 'ไม่ใช่วันศุกร์ เป็นวันเสาร์ งบ 3,000 บาท';
    global.fetch = jest.fn().mockResolvedValue(textResponse(originalThai));

    const result = await transcribeAudio('test-only-key', 'test-recording', 'audio/webm');
    expect(result).toBe(originalThai);
  });
});
