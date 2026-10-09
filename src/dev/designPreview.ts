// Explicit development-only fixture. No private keys or external API calls.
// Use typed answers for the demo; recording still uses the real microphone.
export const designPreviewEnabled = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_COACHIE_DESIGN_PREVIEW === '1';
let questionIndex = 0;
const questions = [
  'How do you handle synchronous C++ object lifetime management and prevent memory leakage during volatile trade streaming?',
  'How would you design the system to recover safely after a connection failure?',
  'Tell me about a time you diagnosed a difficult performance issue.',
  'How do you balance delivery speed with reliability?',
  'What would you measure to know whether your solution is successful?',
];
// Short valid 24 kHz mono WAV so the real browser playback path is exercised.
const silentWav = 'UklGRuQSAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YcASAAAA' + 'A'.repeat(6399) + '=';
export async function designPreviewFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!designPreviewEnabled) return fetch(input,init);
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (body.contents?.length === 1 && body.contents[0].parts?.[0]?.text?.startsWith('Start the interview.')) questionIndex = 0;
  if (input.includes('-tts:')) return new Response(JSON.stringify({candidates:[{content:{parts:[{inlineData:{data:silentWav,mimeType:'audio/wav'}}]}}]}),{status:200});
  const text = body.contents?.some((c: any)=>c.parts?.some((p:any)=>p.inlineData))
    ? 'JSI provides direct synchronous C++ object references to JavaScript runtimes, bypassing the asynchronous JSON stringification queue entirely.'
    : questionIndex < questions.length ? questions[questionIndex++] : 'You gave clear and thoughtful answers. Keep supporting your design decisions with concrete examples and measurable outcomes.';
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200});
}
