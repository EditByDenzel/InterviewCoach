# Coachie architecture

Updated 11 October 2026. React Native 0.74 / Expo SDK 51 / React 18.2 / TypeScript. Component-local refs own asynchronous work; pure domain functions and serialized stores enforce durable boundaries.

## Navigation and domain

HomeScreen sends topic/photo input directly to ABSessionScreen. conversationSetup.ts uses saved language for simple topics without a separate extraction request or invented facts. Photos use scenarioImportService.ts in the background to preserve explicit instructions and uncertainty. scenarioImagePicker.ts handles permissions/cancellation. Sending starts A; saved sessions wait for resume. ScenarioScreen and its route have been removed.

src/domain/abSession.ts defines scenario/persona snapshots, stable turn IDs and lifecycle:

```text
ready_a -> active_a -> waiting_b -> active_b -> comparing -> completed
```

startB creates a fresh run. Only delivered tasker turns enter active context. Append is idempotent for identical IDs/data; changed duplicate IDs fail. Completion uses scenario time, optional minimum finalized replies and goal resolution; maximum duration wins. Manual early end is explicit. Comparison and vote are separate.

## Conversation and audio

```text
Fixed scenario + active-run history
 -> decideNextTurn (new wording or eligible saved utterance)
 -> persist undelivered turn
 -> synthesize literal source wording with fixed voice/style
 -> reserve audio ownership, persist, save audio, play
 -> persist delivered turn
 -> automatic/manual microphone capture
 -> reserve ownership, persist durable model audio
 -> transcribe source, persist source
 -> translate English, accept stable reply, persist
 -> choose next turn or finish run
```

Whole-reply transcription is the selected flow. Original Thai is background context; displayed text is English. Live captions are optional future architecture. The normal tasker gets only its run plus fixed facts and validated context-independent tasker clips. B's saved opener avoids another dialogue/TTS request. Exact source wording, language, voice, style, model and encoding define cache identity; adaptive reuse selection still requires reasoning.

abConversationService.ts validates structured decisions and comparison evidence. Comparison receives both delivered histories and available ORIGINAL model recordings within a request budget. Missing recordings, translation/capture uncertainty and unverified search/factual claims are limitations. No independent fact checker is implemented.

geminiService.ts provides bounded fetch/body requests, complete multipart text, truncation rejection, source transcription and Interactions WAV TTS. Style metadata never replaces literal spoken text. AudioService owns native expo-av and web MediaRecorder/Web Audio lifecycles, speech/silence detection, playback progress and temporary-file cleanup. recordingSession.ts serializes capture controls, reads current callbacks, tracks pauses and cleans late permission starts. An unconditional eight-second cutoff is removed. Silence heuristics still need acoustic device tuning.

ABSessionScreen retains failed-stage continuations, pending replies, asset ownership and playback/capture state. Replay does not append turns; pause/close/background cannot mark interrupted speech delivered. Empty or unusable unfinished recordings can be explicitly deleted for another capture. Save retries continue past mutations instead of accepting another copy or re-running the evaluator.

## Persistence

- abSessionStore.ts: separate validated @coachie_ab_sessions_v1 metadata with serialized snapshots and reference-aware session deletion.
- audioAssetStore.ts: immutable binary assets in native document files with metadata, or browser IndexedDB Blobs. No automatic eviction. Temporary captured files are released only after durable audio and session persistence.
- conversationLibrary.ts: shared history facade projecting A/B summaries beside legacy interviews and bundled samples. A/B history opens its resumable screen.
- conversationStore.ts/settingsStore.ts: validated serialized legacy history, sample tombstones and settings. Corrupt history is reported rather than silently discarded.

Local data can be removed by uninstall/storage clearing. AsyncStorage keys are not encrypted vault storage. Images/audio/context go to configured providers for processing; no cloud backup is implemented. Custom Onyi/Chidera speech uses the optional Node backend described in backend/README.md. Initialization uses persistent Google profiles (store: true, documented one-year retention); voice IDs live in its ignored private directory and the app stores voice names. Stateful availability is checked by Google because usage can extend expiry. Legacy seven-day keys remain readable during migration. Existing Gemini speech callers route custom names to the backend and keep existing WAV playback/storage. Studio voices still use the existing direct path.

## UI and compatibility

MotionProvider tracks reduced motion, pointer capabilities and app state. Native animations cancel/retarget; web interactions use short transform/opacity easing. Drawers contain focus and restore it on close. Loops stop on pause/background/unmount. Scroll areas are bounded, composers cap growth and selected controls expose accessibility state. English transcript bubbles retain original audio replay. conversationStyles.ts shares the original InterviewScreen design with ABSessionScreen: gradient topic bubble, glass audio cards, custom gradient microphone, circular controls and atmospheric footer fade. Scrollbars stay hidden while automatic scrolling remains. Generated scenario titles/objectives/time metadata are not chat headings.

InterviewScreen/SummaryScreen preserve the prior five-round interview behavior for legacy routes, with capture/retry fixes. ElevenLabs is a legacy alternative. They do not manufacture A/B data. Navigation uses @react-navigation/stack with aligned StackScreenProps.

## Verification boundary

Jest includes pure domain/store/provider/audio tests plus actual ABSessionScreen rendering with controlled hardware/provider adapters. tests/acceptance/ab-session.feature is a specification without executable Gherkin bindings. The design preview is development-gated, uses dummy keys/silent audio and simulated capture, and blocks real provider calls. Production exports exclude that preview flag and private environment keys. Exports prove bundling, not physical device operation. See AB_IMPLEMENTATION_PLAN.md for the outstanding equal-priority iOS/Android matrix and language auditions.

Home language selection uses serialized updateSettings({language}) without changing key fields. TopicComposer provides left-side photo clearance for short/multiline text. Close saves before navigating Home; failed saves remain retryable. scripts/start-main.cjs clears fixture/dotenv-disable flags and retains credentials.

Completed-reply response preparation now runs from the original audio alongside transcription/translation. It uses isolated active-run context and eligible reusable questions; only a matching finalized reply can consume it. Persist the reply before playback. Failed audio reasoning falls back to complete text; close/run-end prevents stale playback. Action labels are stored per tasker turn; voice captions use the fixed A/B Gemini voice. This is overlapping whole-recording processing, not live streaming or measured latency.

The A/B footer overlays the bounded scroll viewport with the dark Figma 8:110 fade, 24px padding and measured height plus 64px scroll clearance. New turns animate upward through its 6px blurred edge for 280ms; restored turns and reduced-motion entries stay still. Web applies an SVG feDisplacementMap to the real viewport content, using a canvas-generated neutral map outside the 96px lens edge. The map changes only with viewport/footer size; native uses dark Expo blur. No transcript clone or per-frame canvas redraw is used. If map generation is unavailable, the dark blurred footer remains. The padded multiline input caps its height at 110px. A/B uses a compact, restrained mic halo; legacy/Home behavior is preserved.

AudioWaveform loads immutable clip evidence and renders a bounded amplitude envelope through the shared Waveform component. audioWaveform.ts parses PCM/float WAV bytes on both platforms; browser compressed formats use serial decodeAudioData with context cleanup. audioService captures native metering at 80ms timeline offsets, excludes pause updates and hands the envelope to durable AudioAsset metadata. The original recording is retained unchanged. Wave heights never pulse decoratively; played color follows the real position/duration callback. Unknown/unsupported waveforms are flat, including old native compressed files without envelope metadata. No waveform provider requests are made.

## Capture recovery and background telemetry

ABSession.captureIssues owns no-speech recordings until explicit session deletion. Capture-recovery tasker turns are spoken in the selected language and displayed in English, but excluded from context and comparison evidence. No model answer is invented. Semantic mutations save immediately; explicit durable boundaries await those saves and retain retry behavior. Recorder duration passes through pendingReply to the accepted model turn; replay backfills older duration.

Scenario.skillsTested and evaluationPriorities are distinct optional source fields carried through extraction, tasker prompts and comparison. Task success and catastrophic failures precede normal scenario ranking.

conversationTelemetry.ts persists metadata-only events in an AsyncStorage outbox, sends authenticated batches to backend/server.mjs /api/telemetry and never waits on uploads in the conversation path. backend/telemetry.mjs writes ignored per-session JSONL; timing-report.mjs deduplicates event IDs and reports stage percentiles and reply-to-player-status delay. See CONVERSATION_TIMING.md for limitations.
