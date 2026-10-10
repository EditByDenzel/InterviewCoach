import { Scenario } from '../domain/abSession';
import { AppSettings } from '../types';
import { extractScenario, ScenarioInput } from './scenarioImportService';

/** Internal context, never a user-facing setup form or invented biography. */
export function scenarioFromTopic(topic: string, language = 'English'): Scenario {
  const text = topic.trim() || 'A natural conversation';
  return {
    id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: text.slice(0, 300), topic: text, objective: text,
    role: 'The person asking the assistant questions', facts: [], constraints: [],
    language: ['English', 'Thai', 'Nigerian English'].includes(language) ? language : 'English',
    minMinutes: 1, maxMinutes: 5, sourceText: text,
  };
}

export async function prepareConversation(input: ScenarioInput, settings: AppSettings, signal?: AbortSignal): Promise<Scenario> {
  if (signal?.aborted) throw new Error('Conversation cancelled.');
  if (!input.image) return scenarioFromTopic(input.text || '', settings.language);
  // Only photo/project instructions require extraction. A simple topic goes
  // straight to dialogue, avoiding a separate provider request and form.
  const extracted = await extractScenario(settings.geminiApiKey, input, settings.language, signal);
  return { ...extracted, topic: input.text?.trim() || 'Photo' };
}
