// Explicit development-only fixture. No private keys or external API calls.
// Audio capture is simulated only in this explicit fixture; no microphone access.
export const designPreviewEnabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_COACHIE_DESIGN_PREVIEW === '1';
let questionIndex = 0;
let fixtureLanguage = 'English';
const questions = [
  'How do you handle synchronous C++ object lifetime management and prevent memory leakage during volatile trade streaming?',
  'How would you design the system to recover safely after a connection failure?',
  'Tell me about a time you diagnosed a difficult performance issue.',
  'How do you balance delivery speed with reliability?',
  'What would you measure to know whether your solution is successful?',
];
// Short valid 24 kHz mono WAV so the real browser playback path is exercised.
const silentWav = 'UklGRuQSAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YcASAAAA' + 'A'.repeat(6399) + '=';
export const designPreviewRecordingUri=`data:audio/wav;base64,${silentWav}`;
export async function designPreviewFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!designPreviewEnabled) return fetch(input,init);
  // Leave enough time to inspect processing indicators, without real API traffic.
  await new Promise(resolve=>setTimeout(resolve,600));
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (body.contents?.length === 1 && body.contents[0].parts?.[0]?.text?.startsWith('Start the interview.')) questionIndex = 0;
  if (body.model?.includes('-tts')) return new Response(JSON.stringify({steps:[{type:'model_output',content:[{type:'audio',data:silentWav,mime_type:'audio/wav'}]}]}),{status:200});
  const properties = body.generationConfig?.responseSchema?.properties;
  if (properties) {
    let payload: any = {};
    try { payload = JSON.parse(body.contents?.[0]?.parts?.[0]?.text || '{}'); } catch {}
    let result: any;
    if (properties.reuseTurnId) {
      fixtureLanguage = payload.scenario?.language || 'English';
      const replies = (payload.conversation || []).filter((t: any) => t.speaker === 'model').length;
      const english = replies === 0 ? 'I am planning a trip. Can you help me figure out a practical plan?' : replies === 1 ? 'How would that fit my budget and the timing?' : 'What should I check before making the booking?';
      const thai = replies === 0 ? 'ฉันกำลังวางแผนเดินทาง ช่วยวางแผนที่ทำได้จริงให้หน่อยได้ไหม' : replies === 1 ? 'แล้วเรื่องงบประมาณกับเวลาควรจัดการอย่างไร' : 'ก่อนจองฉันควรตรวจสอบอะไรบ้าง';
      result = { sourceText: fixtureLanguage === 'Thai' ? thai : english, englishText: english, reuseTurnId: '', scenarioOnly: true, goalResolved: replies >= 3 };
    } else if (properties.recommendation) {
      const a = (payload.turns || []).find((t: any) => t.run === 'A' && t.speaker === 'model');
      const b = (payload.turns || []).find((t: any) => t.run === 'B' && t.speaker === 'model');
      result = { recommendation: 'B', summary: 'Fixture comparison: B supplied more concrete planning details; A left important constraints unresolved.', outcomes: { A: 'Partial: some planning constraints remain unresolved.', B: 'Pass: the requested planning constraints were addressed.' }, findings: [{ dimension: 'Task success and utility', detail: 'B gives a usable next step, while A needs another clarification. This is canned development evidence.', turnIds: [a?.id, b?.id].filter(Boolean) }], limitations: ['Development fixture: synthetic responses and silent audio, not a live model assessment.'] };
    } else if (properties.englishText) {
      result = { englishText: fixtureLanguage === 'Thai' ? 'A practical plan should account for your budget, dates, transport and any current travel advice.' : payload.sourceText || 'Fixture English transcript.' };
    }
    if (result) return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }] }), { status: 200 });
  }
  const text = body.contents?.some((c: any)=>c.parts?.some((p:any)=>p.inlineData))
    ? fixtureLanguage === 'Thai' ? 'ควรตรวจสอบงบประมาณ วันเดินทาง การเดินทาง และคำแนะนำล่าสุดก่อนจอง' : 'A practical plan should account for your budget, dates, transport and current travel advice before booking.'
    : questionIndex < questions.length ? questions[questionIndex++] : 'You gave clear and thoughtful answers. Keep supporting your design decisions with concrete examples and measurable outcomes.';
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200});
}
