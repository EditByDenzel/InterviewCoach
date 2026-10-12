# Coachie project handoff

Updated 12 October 2026.

## Working location

Develop in the original InterviewCoach checkout. GitHub repository: https://github.com/EditByDenzel/InterviewCoach, branch main tracking origin/main. The separate Coachie checkout is not the development source. Inspect status before work, preserve unrelated changes, and never copy files between checkouts to synchronize them. Commit intended files only; no force push.

## Current product

Home -> original chat with A/B dividers; no scenario setup screen. Coachie is the tasker, asking another assistant for help. Phone microphone captures models playing on a computer. Both Android and iPhone are targets. Topics start directly with saved preferences. Photo instructions become internal scenario context without a review form. Do not require user goals, roles, facts, timing or priorities at launch.

Sending a new topic/photo starts A; B starts manually after a divider, with the same opener/persona/scenario and separate reasoning history. Natural adaptive follow-ups replace a fixed question count. Duration is scenario-specific, and the maximum takes precedence over optional minimum exchanges. Comparison follows both runs, uses delivered turn evidence and available original model audio, and retains a separate user vote. Missing capture is not a model failure; search and factual accuracy are not independently verified.

The user confirmed whole-reply transcription: record -> stop -> source transcription -> English translation -> follow-up. Thai source stays in background context while English is visible. Live captions are optional future work, not a release requirement. Thai, English and Nigerian English profiles are adult character directions requiring real auditions. A/B uses Gemini; existing interview/summary routes, settings and old history remain supported separately.

## Storage and recovery

A/B metadata uses @coachie_ab_sessions_v1. Audio is durable native document files or browser IndexedDB, not base64 in AsyncStorage. Reserve asset ownership before writing; preserve pending source/audio across translation failures. Stage-specific retry must not duplicate accepted turns or re-run a completed comparison. Interrupted tasker speech is undelivered until playback completes and must not enter context. Closing saves captured replies; backgrounding pauses capture/playback until explicit resume. Saved evidence remains until user deletion, subject to local storage clearing/uninstall. No cloud backup.

Settings and legacy transcript writes are serialized and validated; corrupt data is reported and preserved. Combined history uses conversationLibrary.ts, keeping bundled samples and real saved data distinct. Legacy sessions never acquire fabricated B results or fake playable recordings.

## Providers, design and verification

Configured IDs remain gemini-3.8-flash and gemini-3.8-flash-tts. TTS uses Interactions audio output and separate speech_metadata.style, retaining literal selected-language text. Text/transcription use generateContent. Provider deadlines include response bodies; incomplete output is rejected. Credentials stay in ignored .env or in-app settings; public Expo variables enter bundles. Live account access was not tested.

Shared design uses dark orange glass surfaces. Motion uses opacity/transform with cancellable transitions and reduced-motion/background cleanup. Composer growth is bounded; drawer focus/Escape and keyboard interaction are contained. Audio bars show measured time-domain amplitudes with player-position highlighting, not sound spectra. WAVs decode cross-platform; compressed web audio uses browser decoding. New native recordings persist metering envelopes; unsupported older native compressed clips show a neutral line.

Run npm ci, npm start (SDK 51-compatible client), npm run web, npm test -- --runInBand and npx tsc --noEmit. npm run preview:design serves a no-network fixture at port 8084 with simulated capture and silent WAVs. The A/B fixture has completed both runs, comparison, vote, reload/reopen, replay and deletion at 320/390 widths. Physical camera/mic, live provider quality, fluent-language auditions and OS interruptions remain unverified. Distribution/EAS is not configured.

Read AB_IMPLEMENTATION_PLAN.md, AB_CONVERSATION_BRIEF.md, ARCHITECTURE.md, PLAN.md and CHANGELOG.md for current scope and check evidence. The private Live S2S reference is not publishable and its platform rules prohibit AI-authored prompts/evaluations. This independent app is not a claimed compliant Arena integration.

Home photo is inside the composer at the left. Its former toolbar slot saves English, Thai or Nigerian English through partial settings updates, preserving credentials. Chats save and close automatically; failed saves stay open for retry. npm run web uses local .env loading on 8083; fixture mode remains on 8084.

Completed-reply response preparation now runs from the original audio alongside transcription/translation. It uses isolated active-run context and eligible reusable questions; only a matching finalized reply can consume it. Persist the reply before playback. Failed audio reasoning falls back to complete text; close/run-end prevents stale playback. Action labels are stored per tasker turn; voice captions use the fixed A/B Gemini voice. This is overlapping whole-recording processing, not live streaming or measured latency.

Capture recovery now asks for a repeat in the selected language when finalized audio has no intelligible speech. Save the recording as a capture issue; exclude it and recovery utterances from model scoring and valid dialogue context. Semantic state changes autosave before the optional vote. Model audio duration and measured waveform metadata survive transcription retries.

Photo extraction retains skillsTested separately from evaluationPriorities. Skills guide comparable natural probes; task success/catastrophic failures precede the explicit scenario priority. No additional setup UI. Background timing events use a durable AsyncStorage outbox and authenticated backend JSONL, documented in CONVERSATION_TIMING.md. Historical generation timings cannot be reconstructed. Verification: 214 app tests, 9 backend tests, TypeScript, whitespace and an authenticated endpoint probe; new physical capture validation remains outstanding.
