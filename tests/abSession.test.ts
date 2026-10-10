import {
  ABComparison, ABTurn, Scenario, addElapsed, appendTurn, cacheKey,
  completeComparison, completionForRun, contextForRun, createABSession, endRun,
  isABSession, setVote, startA, startB,
} from '../src/domain/abSession';

const scenario: Scenario = {
  id: 'travel', title: 'Travel advice', objective: 'Plan a safe trip', role: 'Traveller',
  facts: ['Saturday'], constraints: ['3,000 baht budget'], language: 'Thai', minMinutes: 1, maxMinutes: 5,
  sourceText: 'ต้นฉบับ',
};
const fresh = () => createABSession(scenario, { voice: 'Kore', style: 'Ordinary relaxed adult' });
const turn = (id: string, run: 'A' | 'B' = 'A', speaker: ABTurn['speaker'] = 'model'): ABTurn => ({
  id, run, speaker, sourceText: `ภาษาไทย ${id}`, englishText: `English ${id}`, audioAssetId: `audio-${id}`, createdAt: '2026-10-10T12:00:00Z',
});
const comparison: ABComparison = {
  recommendation: 'B', summary: 'B addressed the budget.', findings: [], outcomes: { A: 'Missed budget', B: 'Completed' }, limitations: ['Accuracy not externally verified'],
};

it('snapshots scenario facts and character so subsequent edits do not alter either run', () => {
  const input = { ...scenario, facts: ['Friday'] };
  const persona = { voice: 'Kore', style: 'Calm' };
  const session = createABSession(input, persona);
  input.facts[0] = 'Sunday'; persona.voice = 'Puck';
  expect(session.scenario.facts).toEqual(['Friday']);
  expect(session.persona.voice).toBe('Kore');
  expect(isABSession(session)).toBe(true);
});

it('requires an explicit transition after A before B starts with isolated context', () => {
  let session = startA(fresh());
  expect(() => startB(session)).toThrow('Finish Model A');
  session = appendTurn(session, turn('A_ONLY'));
  session = endRun(addElapsed(session, 60));
  expect(session.status).toBe('waiting_b');
  expect(() => appendTurn(session, turn('late-A'))).toThrow('not active');
  session = startB(session);
  expect(contextForRun(session)).toEqual([]);
  session = appendTurn(session, turn('B_RESPONSE', 'B'));
  expect(JSON.stringify(contextForRun(session))).not.toContain('A_ONLY');
  expect(contextForRun(session, 'A')[0].id).toBe('A_ONLY');
  const isolated = contextForRun(session, 'A'); isolated[0].sourceText = 'Changed';
  expect(session.turns[0].sourceText).not.toBe('Changed');
  expect(session.elapsed).toEqual({ A: 60, B: 0 });
  expect(isABSession(session)).toBe(true);
});

it('accepts a committed turn exactly once and rejects conflicting IDs or another run', () => {
  const original = turn('one');
  const session = appendTurn(startA(fresh()), original);
  expect(appendTurn(session, { ...original })).toBe(session);
  expect(() => appendTurn(session, { ...original, englishText: 'Conflict' })).toThrow('different turn');
  expect(() => appendTurn(session, turn('wrong', 'B'))).toThrow('different model run');
  original.sourceText = 'Mutated';
  expect(session.turns[0].sourceText).not.toBe('Mutated');
});

it('keeps undelivered tasker text out of model context and clears accepted pending evidence', () => {
  let session = appendTurn(startA(fresh()), { ...turn('unsaid', 'A', 'tasker'), delivered: false, scenarioOnly: true, audioDurationSeconds: 3 });
  expect(contextForRun(session)).toEqual([]);
  expect(completionForRun(addElapsed(session, 60)).shouldEnd).toBe(false);
  session = { ...session, pendingReply: { id: 'reply', run: 'A', audioAssetId: 'saved-clip', sourceText: 'ต้นฉบับ' } };
  expect(isABSession(session)).toBe(true);
  session = appendTurn(session, turn('reply'));
  expect(session.pendingReply).toBeUndefined();
});

it('honors duration and explicit minimum turns instead of imposing five questions', () => {
  let session = startA(createABSession({ ...scenario, minTurns: 2 }, fresh().persona));
  session = appendTurn(session, turn('reply-1'));
  expect(completionForRun(session, { goalResolved: true }).reason).toBe('minimum_duration');
  expect(() => endRun(session)).toThrow('minimum');
  session = addElapsed(session, 60);
  expect(completionForRun(session, { goalResolved: true }).reason).toBe('minimum_turns');
  session = appendTurn(session, turn('reply-2'));
  expect(completionForRun(session, { goalResolved: true })).toEqual({ canEnd: true, shouldEnd: true, reason: 'goal_resolved' });
  for (let i = 3; i <= 8; i++) session = appendTurn(session, turn(`reply-${i}`));
  expect(completionForRun(session)).toEqual({ canEnd: true, shouldEnd: false, reason: 'continue' });
});

it('maximum duration takes priority over unmet minimum turns', () => {
  const session = addElapsed(startA(createABSession({ ...scenario, minTurns: 100 }, fresh().persona)), 300);
  expect(completionForRun(session)).toEqual({ canEnd: true, shouldEnd: true, reason: 'maximum_duration' });
  expect(endRun(session).status).toBe('waiting_b');
});

it('manual interruption can explicitly end early while normal completion cannot', () => {
  const session = startA(fresh());
  expect(() => endRun(session)).toThrow('minimum');
  expect(endRun(session, { force: true }).status).toBe('waiting_b');
});

it('allows the final vote only after B and validates cited evidence', () => {
  let session = appendTurn(startA(fresh()), turn('a'));
  expect(() => completeComparison(session, comparison)).toThrow('Finish both');
  session = startB(endRun(session, { force: true }));
  session = appendTurn(session, turn('b', 'B'));
  session = endRun(session, { force: true });
  expect(session.status).toBe('comparing');
  expect(() => setVote(session, 'A')).toThrow('completed comparison');
  expect(() => completeComparison(session, { ...comparison, findings: [{ dimension: 'Utility', detail: 'Claim', turnIds: ['missing'] }] })).toThrow('unknown conversation turn');
  session = completeComparison(session, { ...comparison, findings: [{ dimension: 'Utility', detail: 'Budget addressed', turnIds: ['a', 'b'] }] });
  session = setVote(session, 'A');
  expect(session.vote).toBe('A');
  expect(session.comparison?.recommendation).toBe('B');
  expect(isABSession(session)).toBe(true);
});

it('keys audio by every exact synthesis parameter without delimiter collisions', () => {
  const base = { text: 'เท่าไร?', language: 'Thai', voice: 'Kore', style: 'Calm', model: 'gemini-3.8-flash-tts', encoding: 'wav' };
  expect(cacheKey({ ...base })).toBe(cacheKey(base));
  for (const field of Object.keys(base) as (keyof typeof base)[]) {
    expect(cacheKey({ ...base, [field]: `${base[field]} ` })).not.toBe(cacheKey(base));
  }
  expect(cacheKey({ ...base, text: 'a|b', language: 'c' })).not.toBe(cacheKey({ ...base, text: 'a', language: 'b|c' }));
});

it('rejects invalid scenarios, nonfinite time, and malformed persisted evidence', () => {
  expect(() => createABSession({ ...scenario, maxMinutes: 0 }, fresh().persona)).toThrow('duration');
  expect(() => addElapsed(startA(fresh()), NaN)).toThrow('finite');
  expect(() => addElapsed(startA(fresh()), -1)).toThrow('finite');
  expect(isABSession({ ...fresh(), turns: [{ ...turn('bad'), sourceText: null }] })).toBe(false);
  expect(isABSession({ ...fresh(), status: 'completed', activeRun: 'B' })).toBe(false);
});
