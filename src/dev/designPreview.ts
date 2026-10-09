// Explicit development-only fixture. No private keys or external API calls.
// Audio capture is simulated only in this explicit fixture; no microphone access.
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
export const designPreviewRecordingUri=`data:audio/wav;base64,${silentWav}`;
export async function designPreviewFetch(input: string, init?: RequestInit): Promise<Response> {
  if (!designPreviewEnabled) return fetch(input,init);
  // Leave enough time to inspect processing indicators, without real API traffic.
  await new Promise(resolve=>setTimeout(resolve,600));
  const body = JSON.parse(String(init?.body ?? '{}'));
  if (body.contents?.length === 1 && body.contents[0].parts?.[0]?.text?.startsWith('Start the interview.')) questionIndex = 0;
  if (body.model?.includes('-tts')) return new Response(JSON.stringify({steps:[{type:'model_output',content:[{type:'audio',data:silentWav,mime_type:'audio/wav'}]}]}),{status:200});
  const text = body.contents?.some((c: any)=>c.parts?.some((p:any)=>p.inlineData))
    ? 'JSI provides direct synchronous C++ object references to JavaScript runtimes, bypassing the asynchronous JSON stringification queue entirely.'
    : questionIndex < questions.length ? questions[questionIndex++] : 'You gave clear and thoughtful answers. Keep supporting your design decisions with concrete examples and measurable outcomes.';
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200});
}
