export type ABRun = 'A' | 'B';
export type ABVote = 'A' | 'B' | 'tie' | 'insufficient_evidence';

export interface Scenario {
  id: string;
  title: string;
  objective: string;
  role: string;
  facts: string[];
  constraints: string[];
  language: string;
  minMinutes: number;
  maxMinutes: number;
  minTurns?: number;
  sourceText?: string;
  uncertainties?: string[];
  evaluationPriorities?: string[];
  searchRequired?: boolean;
}
export interface ABTurn {
  id: string;
  run: ABRun;
  speaker: 'tasker' | 'model';
  sourceText: string;
  englishText: string;
  audioAssetId?: string;
  delivered?: boolean;
  scenarioOnly?: boolean;
  audioDurationSeconds?: number;
  createdAt: string;
}
export interface ABComparison {
  recommendation: ABVote;
  summary: string;
  findings: { dimension: string; detail: string; turnIds: string[] }[];
  outcomes: { A: string; B: string };
  limitations: string[];
}
export interface ABSession {
  id: string;
  scenario: Scenario;
  persona: { voice: string; style: string };
  createdAt: string;
  updatedAt: string;
  status: 'ready_a' | 'active_a' | 'waiting_b' | 'active_b' | 'comparing' | 'completed';
  activeRun: ABRun;
  turns: ABTurn[];
  elapsed: { A: number; B: number };
  comparison?: ABComparison;
  vote?: ABVote;
  pendingReply?: { id: string; run: ABRun; audioAssetId: string; sourceText?: string };
}

const votes: ABVote[] = ['A', 'B', 'tie', 'insufficient_evidence'];
const isText = (value: unknown): value is string => typeof value === 'string';
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
const isDate = (value: unknown) => isText(value) && Number.isFinite(Date.parse(value));
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function isScenario(value: any): value is Scenario {
  return !!value && ['id', 'title', 'objective', 'role', 'language'].every(key => isText(value[key]) && !!value[key].trim()) &&
    isTextList(value.facts) && isTextList(value.constraints) &&
    nonnegative(value.minMinutes) && nonnegative(value.maxMinutes) && value.maxMinutes > 0 && value.minMinutes <= value.maxMinutes &&
    (value.minTurns === undefined || (Number.isInteger(value.minTurns) && value.minTurns >= 0)) &&
    (value.sourceText === undefined || isText(value.sourceText)) &&
    (value.uncertainties === undefined || isTextList(value.uncertainties)) &&
    (value.evaluationPriorities === undefined || isTextList(value.evaluationPriorities)) &&
    (value.searchRequired === undefined || typeof value.searchRequired === 'boolean');
}
export function isABTurn(value: any): value is ABTurn {
  return !!value && isText(value.id) && !!value.id && (value.run === 'A' || value.run === 'B') &&
    (value.speaker === 'tasker' || value.speaker === 'model') &&
    isText(value.sourceText) && !!value.sourceText.trim() && isText(value.englishText) && !!value.englishText.trim() &&
    isDate(value.createdAt) && (value.audioAssetId === undefined || (isText(value.audioAssetId) && !!value.audioAssetId)) &&
    (value.delivered === undefined || typeof value.delivered === 'boolean') &&
    (value.scenarioOnly === undefined || typeof value.scenarioOnly === 'boolean') &&
    (value.audioDurationSeconds === undefined || nonnegative(value.audioDurationSeconds));
}
export function isABComparison(value: any): value is ABComparison {
  return !!value && votes.includes(value.recommendation) && isText(value.summary) &&
    Array.isArray(value.findings) && value.findings.every((finding: any) => finding &&
      isText(finding.dimension) && isText(finding.detail) && isTextList(finding.turnIds)) &&
    !!value.outcomes && isText(value.outcomes.A) && isText(value.outcomes.B) && isTextList(value.limitations);
}
export function isABSession(value: any): value is ABSession {
  if (!value || !isText(value.id) || !value.id || !isScenario(value.scenario) || !value.persona ||
      !isText(value.persona.voice) || !value.persona.voice.trim() || !isText(value.persona.style) ||
      !isDate(value.createdAt) || !isDate(value.updatedAt) ||
      !['ready_a', 'active_a', 'waiting_b', 'active_b', 'comparing', 'completed'].includes(value.status) ||
      !['A', 'B'].includes(value.activeRun) || !Array.isArray(value.turns) || !value.turns.every(isABTurn) ||
      !value.elapsed || !nonnegative(value.elapsed.A) || !nonnegative(value.elapsed.B) ||
      (value.comparison !== undefined && !isABComparison(value.comparison)) ||
      (value.vote !== undefined && !votes.includes(value.vote))) return false;
  const ids = new Set(value.turns.map((turn: ABTurn) => turn.id));
  if (ids.size !== value.turns.length) return false;
  if (value.comparison?.findings.some((finding: ABComparison['findings'][number]) => finding.turnIds.some(id => !ids.has(id)))) return false;
  if (['ready_a', 'active_a', 'waiting_b'].includes(value.status)) {
    if (value.activeRun !== 'A' || value.turns.some((turn: ABTurn) => turn.run === 'B')) return false;
  } else if (value.activeRun !== 'B') return false;
  if (value.status === 'ready_a' && value.turns.length > 0) return false;
  if (value.status === 'completed' && !value.comparison) return false;
  if (value.status !== 'completed' && (value.comparison || value.vote)) return false;
  if (value.pendingReply !== undefined) {
    const pending = value.pendingReply;
    if (!pending || !isText(pending.id) || !pending.id || !['A', 'B'].includes(pending.run) ||
        !isText(pending.audioAssetId) || !pending.audioAssetId ||
        (pending.sourceText !== undefined && !isText(pending.sourceText))) return false;
  }
  return true;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const update = (session: ABSession, patch: Partial<ABSession>): ABSession => ({ ...session, ...patch, updatedAt: new Date().toISOString() });
const assertActive = (session: ABSession) => {
  if (session.status !== (session.activeRun === 'A' ? 'active_a' : 'active_b')) throw new Error('This model run is not active.');
};

export function createABSession(scenario: Scenario, persona: ABSession['persona']): ABSession {
  if (!isScenario(scenario)) throw new Error('Review the scenario, language, and duration before starting.');
  if (!persona.voice?.trim() || !isText(persona.style)) throw new Error('Choose a voice before starting.');
  const now = new Date().toISOString();
  return {
    id: `ab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    scenario: clone(scenario), persona: { ...persona }, createdAt: now, updatedAt: now,
    status: 'ready_a', activeRun: 'A', turns: [], elapsed: { A: 0, B: 0 },
  };
}
export function startA(session: ABSession): ABSession {
  if (session.status !== 'ready_a') throw new Error('Model A has already started.');
  return update(session, { status: 'active_a', activeRun: 'A' });
}
export function startB(session: ABSession): ABSession {
  if (session.status !== 'waiting_b') throw new Error('Finish Model A before starting Model B.');
  return update(session, { status: 'active_b', activeRun: 'B' });
}
export function appendTurn(session: ABSession, turn: ABTurn): ABSession {
  if (!isABTurn(turn)) throw new Error('The turn needs its original words and English transcript.');
  const existing = session.turns.find(item => item.id === turn.id);
  if (existing) {
    const fields: (keyof ABTurn)[] = ['id', 'run', 'speaker', 'sourceText', 'englishText', 'audioAssetId', 'createdAt', 'delivered', 'scenarioOnly', 'audioDurationSeconds'];
    if (!fields.every(field => existing[field] === turn[field])) throw new Error('A different turn already uses this ID.');
    return session;
  }
  assertActive(session);
  if (turn.run !== session.activeRun) throw new Error('The turn belongs to a different model run.');
  return update(session, {
    turns: [...session.turns, { ...turn }],
    ...(turn.speaker === 'model' && session.pendingReply?.id === turn.id ? { pendingReply: undefined } : {}),
  });
}
export function addElapsed(session: ABSession, seconds: number): ABSession {
  assertActive(session);
  if (!nonnegative(seconds)) throw new Error('Elapsed time must be a finite positive number.');
  return update(session, { elapsed: { ...session.elapsed, [session.activeRun]: session.elapsed[session.activeRun] + seconds } });
}
export function contextForRun(session: ABSession, run: ABRun = session.activeRun): ABTurn[] {
  return session.turns.filter(turn => turn.run === run && turn.delivered !== false).map(turn => ({ ...turn }));
}

export interface CompletionOptions { goalResolved?: boolean; }
export function completionForRun(session: ABSession, options: CompletionOptions = {}): {
  canEnd: boolean; shouldEnd: boolean;
  reason: 'maximum_duration' | 'minimum_duration' | 'minimum_turns' | 'goal_resolved' | 'continue';
} {
  const elapsed = session.elapsed[session.activeRun];
  if (elapsed >= session.scenario.maxMinutes * 60) return { canEnd: true, shouldEnd: true, reason: 'maximum_duration' };
  if (elapsed < session.scenario.minMinutes * 60) return { canEnd: false, shouldEnd: false, reason: 'minimum_duration' };
  // Count completed replies, not replays, silence retries or generated clips.
  const replies = session.turns.filter(turn => turn.run === session.activeRun && turn.speaker === 'model' && turn.delivered !== false).length;
  if (replies < (session.scenario.minTurns ?? 0)) return { canEnd: false, shouldEnd: false, reason: 'minimum_turns' };
  return { canEnd: true, shouldEnd: !!options.goalResolved, reason: options.goalResolved ? 'goal_resolved' : 'continue' };
}
export function endRun(session: ABSession, options: CompletionOptions & { force?: boolean } = {}): ABSession {
  assertActive(session);
  if (!options.force && !completionForRun(session, options).canEnd) throw new Error('The scenario minimum duration or turns have not been reached.');
  return update(session, { status: session.activeRun === 'A' ? 'waiting_b' : 'comparing' });
}
export function completeComparison(session: ABSession, comparison: ABComparison): ABSession {
  if (session.status !== 'comparing') throw new Error('Finish both model runs before comparing.');
  if (!isABComparison(comparison)) throw new Error('The comparison response is incomplete.');
  const ids = new Set(session.turns.map(turn => turn.id));
  if (comparison.findings.some(finding => finding.turnIds.some(id => !ids.has(id)))) throw new Error('The comparison cites an unknown conversation turn.');
  return update(session, { status: 'completed', comparison: clone(comparison) });
}
export function setVote(session: ABSession, vote: ABVote): ABSession {
  if (session.status !== 'completed' || !session.comparison) throw new Error('Read the completed comparison before voting.');
  if (!votes.includes(vote)) throw new Error('Choose A, B, tie, or insufficient evidence.');
  return update(session, { vote });
}
/** Exact JSON tuple avoids hash collisions and delimiter/normalization mistakes. */
export function cacheKey(input: { text: string; language: string; voice: string; style: string; model: string; encoding: string }): string {
  return JSON.stringify([input.text, input.language, input.voice, input.style, input.model, input.encoding]);
}
