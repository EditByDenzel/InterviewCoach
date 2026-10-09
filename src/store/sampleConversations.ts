import { SavedConversation } from '../types';

function sample(id: string, topic: string, pairs: [string, string][], feedback: string): SavedConversation {
  return {
    id: `sample-${id}`,
    topic,
    isSample: true,
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-01T12:00:00Z',
    rounds: pairs.map(([question, answer], index) => ({
      roundNumber: index + 1,
      question,
      answer,
    })),
    currentQuestion: '',
    closingMessage: feedback,
    status: 'completed',
    language: 'English',
    voice: 'Kore',
  };
}

export const sampleConversations: SavedConversation[] = [
  sample(
    'mock-interview',
    'Deploy an autonomous AI agent to monitor liquidity pools. Make it a tactical trading bot.',
    [
      [
        'Deployed AlphaRaptor.sh to your agent network. The automation loop is active. Need to configure risk mitigation parameters? How do you handle synchronous C++ object lifetime management and prevent memory leakage during volatile trade streaming?',
        'JSI provides direct synchronous C++ object references to JavaScript runtimes, bypassing the asynchronous JSON stringification queue entirely.',
      ],
      [
        'How would you manage backpressure and failover if the liquidity pool websocket connection drops under peak volume?',
        'I would implement a ring buffer with ring-drop semantics for stale ticks, while a dedicated health watchdog triggers exponential backoff reconnects to secondary RPC endpoints.',
      ],
      [
        'What safeguard prevents rogue automated orders during severe slippage or flash crashes?',
        'A circuit breaker inspects the spread and local volatility threshold before signing any transaction payload. If slippage exceeds 1.5%, the execution engine immediately halts order dispatch.',
      ],
    ],
    'Exceptional technical depth. You articulated low-level JSI runtime guarantees and resilient backpressure strategies with clarity and poise.'
  ),
  sample(
    'architecture',
    'System Architecture Review',
    [
      [
        'How would you design a reliable notification service?',
        'I would start with delivery requirements and expected volume. An API accepts requests, a durable queue buffers work, and separate workers deliver email and push notifications. Each request has an idempotency key.',
      ],
      [
        'What happens when a provider becomes unavailable?',
        'Workers retry with exponential backoff and jitter. A circuit breaker prevents a failing provider from consuming all capacity, while a dead-letter queue retains messages that need investigation.',
      ],
      [
        'How would you prevent duplicate delivery?',
        'I would store the delivery state against the idempotency key and make transitions atomic. Provider support determines whether we can offer effectively-once delivery or must document an at-least-once guarantee.',
      ],
      [
        'How would you know the system is healthy?',
        'I would track queue age, delivery success, end-to-end latency, and retry rate. Alerts would use the delivery objective rather than CPU alone, and a dashboard would separate provider failures from our own errors.',
      ],
    ],
    'Your design covers buffering, recovery, and observability. Strengthen it by stating throughput assumptions and explaining which delivery guarantees your provider can actually support.'
  ),
  sample(
    'behavioral',
    'Behavioral STAR Framework',
    [
      [
        'Tell me about a time you handled a difficult deadline.',
        'Situation: our launch date was fixed and the integration was late. Task: deliver the core workflow safely. Action: I agreed on a smaller scope, isolated the integration behind a flag, and added a release checklist. Result: we launched on time without a rollback.',
      ],
      [
        'Describe a disagreement with a teammate.',
        'We disagreed on whether to rebuild a component. I listed the user problems and maintenance costs, then we tested a small improvement before committing to a rewrite. We kept the component and removed the main usability issue in two days.',
      ],
      [
        'Tell me about a mistake and what you learned.',
        'I shipped a layout without checking narrow screens. A user reported clipped controls. I reproduced it, fixed the constraint, and added a responsive review to our release process. The lesson was to validate real interaction, not just screenshots.',
      ],
      [
        'How have you helped someone on your team?',
        'A new teammate was struggling to trace an asynchronous bug. We paired on a timeline of events, added targeted logs, and found a stale response overwriting newer state. I documented the debugging method so they could use it independently next time.',
      ],
      [
        'What are you most proud of in that work?',
        'The team became more confident shipping small changes. We reduced repeated defects, made ownership clearer, and used customer feedback to choose the next improvement instead of guessing.',
      ],
    ],
    'You describe your own actions clearly and reflect on what changed. For each STAR answer, add a concrete result and keep the situation brief so the interviewer can focus on your contribution.'
  ),
];
