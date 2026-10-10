# Coachie: voice and conversation design research

Research date: 10 October 2026. Status: research informed the implemented A/B tasker, adult character directions, separate speech style metadata and context-aware audio reuse. No live audio quality benchmark or fluent-listener audition was performed. The original baseline observations below describe the app before implementation; current behavior is in AB_IMPLEMENTATION_PLAN.md. The user selected completed-reply transcription; live captions are optional future work.

## Product evidence

Read the supplied screenshot, README, CHANGELOG, PLAN, ARCHITECTURE, PROJECT_CONTEXT, and the current conversation/audio services. The original `InterviewCoach` directory is the active project according to PROJECT_CONTEXT. The separate `ChatGPT/Coachie` checkout contains an older implementation.

The screenshot shows Live S2S Arena: Model A, Model B, then Vote. It asks evaluators to keep the opener, follow-ups, topic, energy, depth, and length comparable. Task success is a pass/fail gate; the displayed priority is utility, then naturalness/engagement, then audio quality. The scenario requires search, Thai speech, and a short 1–5 minute conversation. The Thai text appears to concern checking a news report about a new respiratory disease before travel; that is a tentative paraphrase because the small text is blurry. A microphone-not-detected error is visible. These are instructions within the reference image, not instructions to operate that service or change Coachie's language.

Before this implementation, Coachie was an interviewer: topic -> question -> speech -> recorded or typed answer -> transcription -> follow-up -> five accepted answers -> feedback -> saved transcript. It already includes 30 studio voices, language preferences including Thai, replay, pause, error recovery, and saved conversations. Source also includes automatic recording and silence detection. The handoff's successful fixture tests do not demonstrate live microphone quality, provider access, latency, or vocal realism.

## Historical baseline findings

| Finding in current source | Consequence | Proposed response |
|---|---|---|
| geminiService.ts:49 always assigns a professional screening interviewer | A travel or casual role-play topic still receives interview behavior | Define mode, each participant's role, scenario goal, and completion condition explicitly |
| InterviewScreen.tsx:53 and submit() enforce five accepted answers | A request to repeat or clarify can consume a round; no separate dialogue-act classification exists | Distinguish substantive answers from clarification, repair, user questions, and ending requests |
| geminiService.ts:108 uses one generic delivery instruction | Voice selection alone does not establish a character's behavior or expressive range | Audition a stable voice identity, then test restrained turn-level delivery |
| Audio silence detection waits 2300 ms, followed by sequential transcription, text generation, and full TTS | Silence detection contributes about 2.3 seconds before network work, subject to polling; total latency is unmeasured | Instrument each stage before tuning or replacing the pipeline |
| Transcription maxOutputTokens is 300; returned text is accepted without checking finishReason | Longer answers may be truncated and the next question may miss the important ending | Use a recording-length-aware budget or chunking; detect truncation and recover without losing the recording |
| Question output budget is 120 tokens across languages | Some responses can end mid-sentence; token limits do not equal spoken duration | Constrain dialogue length in the prompt and validate completion separately |
| Conversation requests have no search tool | Coachie cannot currently ground a search-required scenario in fresh evidence | Add grounding only if Coachie is meant to answer factual/current-information questions |

These are static-code findings and risks, not reproduced device failures. Native silence detection also depends on usable metering; test that the configured recording preset actually provides levels on target devices.

## Voice character design

Google's current Voice Design documentation describes creating a persistent vocal identity from a description and reusing its `voice_...` identifier. Use voice identity for stable timbre and accent, and compare it against existing studio voices. This is a better experiment than choosing a voice solely from labels such as “firm” or “warm.” Availability in this project's account has not been tested. [Google Voice Design](https://ai.google.dev/gemini-api/docs/voice-design).

Gemini 3.8 TTS separates literal spoken text from sustained delivery in `speech_metadata.style`; brief vocal events use inline tags. Keep an identity stable, start with empty or minimal consistent style, then change delivery only when the turn warrants it. The current app already uses the correct metadata mechanism. Unary output defaults to WAV, while streaming defaults to PCM chunks; the old roadmap's automatic WAV-header suggestion should not be applied blindly. [Google TTS guide](https://ai.google.dev/gemini-api/docs/speech-generation).

Proposed audition, pending the user's preferred language and character:

- Three voice candidates, each reading identical scripts: greeting, curious follow-up, clarification, gentle disagreement, uncertain answer, closing.
- Compare a minimal style baseline with “relaxed, attentive, conversational; light sentence stress.” This wording is a hypothesis to audition, not a proven optimum.
- Score accent authenticity, pronunciation, phrasing, emotional fit, fatigue over several minutes, and identity consistency across repeated requests.
- Let punctuation do most of the work. Test sparse pause tags only where a specific phrase needs one. Do not automatically add laughs, sighs, hesitations, or breath sounds to every reply.
- Use fluent reviewers for each supported language; a pleasant English sample does not establish Thai quality.

## Conversation behavior

Google's conversation-design guidance recommends brief relevant turns, one question at a time, and yielding after asking. Its question guidance distinguishes broad questions that invite stories from narrow questions that help when a user is uncertain. These are useful design principles, though the old Assistant product APIs are not the implementation target. [Turn-taking](https://developers.google.com/assistant/conversation-design/learn-about-conversation), [Question design](https://developers.google.com/assistant/conversation-design/questions).

Proposed behavior policy:

1. Identify the last turn's purpose: answer, question, correction, uncertainty, request to repeat, or ending request.
2. Answer a direct question or repair misunderstanding before continuing the agenda.
3. Track facts, constraints, unresolved details, and topics already covered.
4. Choose one useful next move: clarify, ask for an example, explore a decision, challenge a trade-off, answer, change topic, or close.
5. Tie follow-ups to something actually said. Avoid invented details, repetitive paraphrases, and routine praise.
6. Use brief conversational wording. Do not force every reply to end in a question when the user's goal is already satisfied.
7. Keep coaching feedback outside role-play unless the selected mode calls for it.

Example: after “We cut scope because the deadline moved,” a specific follow-up is “What did you decide to cut?” If the person then says the cut removed onboarding, “How did new users manage without it?” follows the answer. Replacing both with unrelated stock questions loses the conversational thread. These examples are design proposals, not measured model outputs.

Integration proposal: supply a compact persona, scenario, success condition, language, session state, and a handful of diverse good/bad dialogue examples to the text model. Return validated fields such as dialogue act, spoken text, delivery cue, and whether the objective is complete. The app controls state transitions; TTS receives only spoken text and separate delivery metadata. Begin with one generation call rather than adding an extra planning call to every turn. Google's current prompting guidance favors clear role definitions, ordered conversation rules, explicit tool conditions, and concrete examples. [Live prompting guidance](https://ai.google.dev/gemini-api/docs/live-api/best-practices).

## Provisional flow

Describe the session goal -> confirm who plays which role -> choose language/character and audition -> microphone check -> opening -> adaptive conversation -> user ends or objective/time limit is reached -> optional feedback and transcript.

Keep the existing five-question interview as a distinct mode if interview practice remains a goal. A scenario mode would need different prompts and completion logic, not merely a renamed topic box. If the app generates questions for another assistant, its character should behave as the scenario participant and avoid volunteering the assistant's answers.

## Speech pipeline decision

| Approach | Why consider it | What must be demonstrated |
|---|---|---|
| Improve current Flash + Flash TTS | Retains explicit wording and chosen vocal identity | Acceptable reply delay and natural multi-turn delivery |
| Stream TTS in the existing cascade | Can begin playback before all audio is available | Native/web chunk buffering, sample-format correctness, cancellation, and coherent prosody |
| Prototype Gemini Live separately | Designed for interactive audio and user interruptions | Preferred voice quality, language support, role fidelity, latency, and cost on the target device |

Google documents Live as supporting interruption and interactive tool use. It is an alternative architecture, not a switch that turns the existing TTS player into simultaneous listening and speaking. Do not assume custom TTS voice IDs carry over to Live. [Live API overview](https://ai.google.dev/gemini-api/docs/live-api).

For the current cascade, measure end-of-user-speech -> recording submission -> transcription completion -> text completion -> first audible response. Track median and slow-tail latency, premature cut-offs, missed short answers, and recovery after a request fails. Compare adjustable end-of-turn timing with a manual “done” fallback; simply lowering the silence threshold can interrupt thoughtful answers.

## Evaluation before adopting changes

Use the screenshot's task-success-first principle as a proposed evaluation method. Do not trade a correct, useful conversation for attractive but unhelpful speech.

- Dialogue comparison: same scenarios and recorded/transcribed inputs, compare baseline and proposed policy. Include vague answers, user questions, corrections, silence, repetition requests, changed constraints, and early exits.
- Voice comparison: same text and playback volume, randomized presentation, compare voice/style candidates independently of question quality.
- Whole-session comparison: repeat comparable goals with natural follow-ups. Measure task completion, relevance, repetition, useful follow-ups, language consistency, reply delay, interruptions, and vocal preference.
- Treat automated scoring as a screening aid. User listening and fluent-language review decide whether the character sounds right.

The subsequent implementation added complete-response validation, an explicit tasker/scenario role, context-aware follow-ups and voice preview/style controls. Instrumented latency/cost measurements and listening auditions remain unverified. Streaming or Live should be considered only if live captions or interruptions become necessary.

## Original discovery questions (now resolved in AB_CONVERSATION_BRIEF.md)

1. Primary job: interview practice, broad role-play, or preparing/comparing scenario conversations?
2. Which side does Coachie play: assistant, questioning character, or practice coach?
3. One concrete scenario and the observable result that makes it successful?
4. Main language/accent, character relationship/personality, and current biggest annoyance?
5. Hands-free interruptions or explicit turn controls; preferred session length and feedback timing?
6. Before implementation benchmarking: main device/platform, personal versus shared use, and acceptable latency/cost trade-off.
