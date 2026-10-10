import { prepareConversation, scenarioFromTopic } from '../src/services/conversationSetup';
import { extractScenario } from '../src/services/scenarioImportService';
import { AppSettings } from '../src/types';

jest.mock('../src/services/scenarioImportService', () => ({ extractScenario: jest.fn() }));
const settings = { language: 'Thai', geminiApiKey: 'fixture-key' } as AppSettings;

it('opens a typed topic with saved language and no extraction or invented user facts', async () => {
  const scenario = await prepareConversation({ text: '  Who is Cristiano Ronaldo?  ' }, settings);
  expect(scenario).toMatchObject({ topic: 'Who is Cristiano Ronaldo?', sourceText: 'Who is Cristiano Ronaldo?', language: 'Thai', facts: [], constraints: [] });
  expect(scenario.objective).toBe(scenario.topic);
  expect(extractScenario).not.toHaveBeenCalled();
});

it('keeps explicit photo instructions in internal context without adding a review stage', async () => {
  const extracted = { ...scenarioFromTopic('Travel', 'Thai'), minMinutes: 2, maxMinutes: 3, minTurns: 2, searchRequired: true, evaluationPriorities: ['Utility', 'Naturalness'], sourceText: 'original Thai instructions' };
  (extractScenario as jest.Mock).mockResolvedValueOnce(extracted);
  const image = { base64: 'fixture', mimeType: 'image/png' };
  const controller = new AbortController();
  expect(await prepareConversation({ image }, settings, controller.signal)).toEqual({ ...extracted, topic: 'Photo' });
  expect(extractScenario).toHaveBeenCalledWith('fixture-key', { image }, 'Thai', controller.signal);
});

it('does not upload a photo when its chat has already been closed', async () => {
  const controller = new AbortController(); controller.abort();
  const calls = (extractScenario as jest.Mock).mock.calls.length;
  await expect(prepareConversation({ image: { base64: 'fixture', mimeType: 'image/png' } }, settings, controller.signal)).rejects.toThrow('cancelled');
  expect(extractScenario).toHaveBeenCalledTimes(calls);
});
