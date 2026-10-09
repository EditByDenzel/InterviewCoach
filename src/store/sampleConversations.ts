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
    'Mock Interview Prep Session',
    [
      [
        'Tell me about yourself and the role you are looking for.',
        'I am a frontend engineer who enjoys making complex workflows easy to use. I recently built an interview practice tool and would like a role where I can own the experience from prototype to release.',
      ],
      [
        'What project best demonstrates how you work?',
        'I redesigned a support dashboard after watching agents use it. I grouped the actions around their most common task, tested a prototype with five agents, and shipped it in small steps. Average handling time fell by 18%.',
      ],
      [
        'What would you like to improve in your next role?',
        'I want to get better at explaining tradeoffs early. I now write a short decision note before implementation, ask for feedback, and revisit the result after launch.',
      ],
    ],
    'You connected your experience to the role and used a measurable example. Keep your opening focused on the two strengths most relevant to the position, then invite a follow-up.'
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
