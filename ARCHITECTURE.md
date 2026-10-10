# Coachie architecture

Updated 10 October 2026. React Native 0.74 / Expo SDK 51 / React 18.2 / TypeScript. Component-local refs own asynchronous work; pure domain functions and serialized stores enforce durable boundaries.

## Navigation and domain

HomeScreen sends typed/photo input to ScenarioScreen. scenarioImagePicker.ts handles camera/library and permission/cancellation; scenarioImportService.ts extracts structured English fields, validates allowed languages/time and preserves uncertainty. The user reviews before navigation to ABSessionScreen.

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

Local data can be removed by uninstall/storage clearing. AsyncStorage keys are not encrypted vault storage. Images/audio/context go to configured providers for processing; no cloud backup or custom backend is implemented.

## UI and compatibility

MotionProvider tracks reduced motion, pointer capabilities and app state. Native animations cancel/retarget; web interactions use short transform/opacity easing. Drawers contain focus and restore it on close. Loops stop on pause/background/unmount. Scroll areas are bounded, composers cap growth and selected controls expose accessibility state. English transcript bubbles retain original audio replay.

InterviewScreen/SummaryScreen preserve the prior five-round interview behavior for legacy routes, with capture/retry fixes. ElevenLabs is a legacy alternative. They do not manufacture A/B data. Navigation uses @react-navigation/stack with aligned StackScreenProps.

## Verification boundary

Jest includes pure domain/store/provider/audio tests plus actual ABSessionScreen rendering with controlled hardware/provider adapters. tests/acceptance/ab-session.feature is a specification without executable Gherkin bindings. The design preview is development-gated, uses dummy keys/silent audio and simulated capture, and blocks real provider calls. Production exports exclude that preview flag and private environment keys. Exports prove bundling, not physical device operation. See AB_IMPLEMENTATION_PLAN.md for the outstanding equal-priority iOS/Android matrix and language auditions.
