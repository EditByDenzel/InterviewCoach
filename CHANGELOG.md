# Changelog

All notable changes to InterviewCoach are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Scenario A/B conversations and recovery — 2026-10-10

- Home now opens an editable scenario review from a typed topic, camera photo or
  imported screenshot. Review role, objective, facts, constraints, speaking
  language, duration, optional minimum exchanges, search requirement and priorities
  in English before starting. Camera/library permissions and cancellation preserve
  drafts; unreadable extraction details remain uncertain.
- Added tasker role-play with explicit Model A and Model B runs, a divider,
  shared opener/persona and isolated reasoning histories. Adaptive follow-ups use
  fixed scenario facts and each model's actual replies. Scenario time and explicit
  minimum exchanges replace a universal five/ten-question budget.
- Added adult Thai, English and Nigerian English character directions, voice
  previews and separate TTS style metadata. Exact utterance caching and validated
  scenario-only reuse avoid resynthesizing a present shared opener; no measured
  naturalness, accent fidelity or savings percentage is claimed.
- Selected completed-reply transcription: record, stop, transcribe original
  language, translate to English, then choose a contextual follow-up. Thai source
  remains background evidence while both speakers' visible text is English.
  Live captions are optional future work, not a release requirement.
- Added durable native document/browser IndexedDB recordings, serialized A/B
  metadata, resumable pending replies and reference-aware deletion. Reserve audio
  ownership before writes; release temporary captures only after durable saves.
  Stage-specific retries avoid duplicate accepted turns and repeated evaluations.
  An unusable unfinished recording can be explicitly deleted to capture again.
- Added final evidence-referenced comparison, original evaluated-model audio when
  available, insufficient-evidence handling, an independent A/B/tie/unsure vote
  and English transcript sharing. Missing capture and unverified factual/search
  claims are explicit limitations. Legacy interview history remains separate.
- Fixed stale recording callbacks, late permission/start cleanup, web/native
  speech detection, pause/replay/background handling, playback overlap and
  cleanup. Removed the unconditional eight-second answer cutoff. Added provider
  fetch/body deadlines, complete multipart response handling and truncation checks.
- Refined press/release easing, animation cancellation, reduced-motion/background
  cleanup, bounded composer growth, drawer keyboard focus/Escape, sibling history
  actions and selected-state accessibility. Compact A/B controls fit narrow phones.
- Verified **174 tests across 16 suites**, TypeScript and whitespace checks.
  Exported web, Android and iOS bundles without private environment keys.
  Browser fixtures completed both runs, English-visible Thai mode, comparison,
  independent vote and reload/reopen; settled layouts had no horizontal overflow
  at 320/390 widths. Additional fixture checks covered replay/deletion, cancellation
  and reduced motion. Fixtures use simulated capture, canned replies and silent
  audio; physical iOS/Android, real cameras/microphones, live provider quality,
  language auditions and latency remain unverified. No store deployment is claimed.
- Updated README, architecture, handoff, product plan, A/B plan/brief, research
  status and acceptance specifications. The private Live S2S reference informed
  fairness principles and scenario-specific rules; this independent app is not a
  claimed compliant integration with that platform. Private source media stays out
  of Git. Earlier entries below describe historical implementation states.

### Polish, In-App Drawer, Reactive Audio & Telegram Controls — 2026-10-10
- **In-App Sidebar Drawer**: Confined the conversation sidebar overlay strictly within `DesignFrame` as an absolute in-frame overlay rather than a root browser modal. On desktop web, the drawer and dim backdrop animate strictly within the phone mockup rather than detaching to the browser edge.
- **Delete Conversations**: Added chat deletion in `ConversationSidebar` with two-tap confirmation (`Delete?`) and persistent tracking of deleted sample chats in `@coachie_deleted_samples_v1` so deleted chats never resurface. Added delete conversation action and modal dialog in `ConversationScreen`.
- **Voice-Frequency Reactive Mic Halo**: Integrated Web Audio API `analyser` (web) and audio status metering (native) into `BreathingHalo` to dynamically scale (`1.0 + level * 0.35`) and boost aura glow in real-time based on speech volume and frequency instead of an idle loop.
- **Telegram-Style Transcription Button**: Redesigned `TranscriptionIcon` into a clean rounded badge with crisp `→A` matching Telegram's voice-note UX without squashing inside circle borders.
- **Balanced Waveform Layout**: Adjusted candidate waveform spacing (`step = 7`, right margin) so audio bars span evenly without bunching or clipping against action controls.
- **Atmospheric Feathered Footer Fade**: Replaced the abrupt top blur boundary in `anchoredSpeakerFooter` with an upward feathered gradient fade (`top: -36`), dissolving chat messages smoothly into obsidian darkness without harsh lines or strokes.
- **Quick Settings Modal Sizing**: Constrained `quickSettingsCard` `maxWidth` to `348` (`width: '90%'`) so the voice and language sheet sits comfortably with breathing room inside the 390px mobile frame.
- **Removed Duplicate UX Pause Phrasing**: Fixed double pause wording; status subheader displays `Paused · MM:SS` while bottom caption displays `Tap resume to continue speaking.` without repeating phrases.
- **Direct Question Starts**: Added system instructions and regex sanitization in `geminiService.ts` ensuring the AI never starts interviews with opening pleasantries ("Hello", "Welcome", etc.), beginning immediately with the first interview question.
- **Dynamic Duration & Loaders**: Eliminated hardcoded fallback durations (`00:24`, `00:18`); replaced with dynamic word-count calculations, live playback progress, and loading indicators.
- **Desktop Horizontal Drag-to-Scroll**: Enabled mouse click-and-drag horizontal scrolling on Home suggestion cards with `grab` / `grabbing` cursors.
- **Persistent Aira Drafting Pill**: Maintained `[Orb] Aira · Synthetic Voice` header permanently above every AI message card post-generation.


### Fluid conversations and saved history
- Replaced the large Home CTA with a multiline composer, inline send, keyboard
  submission, animated height, long-word wrapping, and hidden scrollbar chrome.
- Added recent-conversation sidebar and a persisted full transcript viewer for
  completed and unfinished interviews. Saves happen before the next API request.
- Coachie logo opens Settings; removed fake 9:41, signal/battery, and home chrome.
- Added screen/drawer/message transitions, hover/press/focus feedback, reduced
  motion support, breathing mic halos, and animated processing indicators.
- Audio waveforms fill the row, animate during playback/transcription, and show
  real playback progress. Telegram-style transcript controls reveal/collapse text.
- Added Thai and 30 searchable Gemini studio voices. Thai uses Flash TTS;
  the current ElevenLabs multilingual_v2 engine is disabled for Thai.
- Updated Gemini 3.8 TTS requests to the documented Interactions API/WAV schema.
- Save actions stay visible beneath long language/voice settings lists.
- Development fixture now simulates capture as well as API responses; no real
  microphone or provider credentials are needed to inspect its processing states.
- Verified 15 unit tests, TypeScript, all-platform exports, responsive composer,
  five-round fixture flow, transcription/replay UI, and reload-persistent history.
  Real hardware and live paid provider calls remain unverified.

### Coachie design refresh
- Rebuilt Home and the five-round interview around the selected Figma screens.
- Added an explicit Start conversation button and consistent gradients within home cards.
- Added grouped Settings with Language, Voice, API Keys, and About subpages.
- Language and voice preferences feed the actual interview/TTS requests. Existing keys migrate intact.
- Restyled the summary, retained the transcript, and kept sharing and starting another session.
- Added recording pause/resume, mute, cached question replay, and recovery controls.
- Removed duplicate root registration: Expo/AppEntry already registers the app.
- Aligned screens, safe-area-context, and reanimated with Expo SDK 51 to fix native codegen.
- Verified 11 unit tests, TypeScript, web/Android/iOS bundle export, and a five-round browser fixture. Real-device audio and live provider access remain unverified.

### Fixed
- Fixed navigation types: Replaced `@react-navigation/native-stack` imports with `@react-navigation/stack`'s `StackScreenProps` and configured `headerLeft: () => null` in `AppNavigator.tsx`. TypeScript (`tsc --noEmit`) now compiles with zero errors.
- Added Expo entrypoint registration `registerRootComponent(App)` in `App.tsx` and updated `package.json` main field to `node_modules/expo/AppEntry.js`.
- Added missing icon and splash assets in `assets/`.

### Known Issues / P0 Bugs (to verify on first device test)
- Gemini TTS returns raw PCM — may need WAV header injection if expo-av cannot play it directly
- `react-native-vector-icons` may need replacing with `@expo/vector-icons` in managed Expo workflow
- Android audio MIME type from expo-av HIGH_QUALITY preset varies by device — confirm `audio/m4a` mapping

---

## [1.0.0] — 2026-10-09

### Added
- **Home screen** — Material Design 3 hero section, `TextInput` for topic, 8 quick-pick `Chip` suggestions (React, PM, DevOps, etc.), "How It Works" card, Start Interview button, Settings link, API key warning banner
- **Interview screen** — Full 5-round voice interview loop:
  - Phase state machine: `idle → generating_question → speaking → recording → transcribing → closing → done`
  - `ProgressBar` showing Question N/5 with percentage
  - Status `Chip` with icon for each phase (AI Speaking, Listening, Thinking, etc.)
  - Question and answer `Surface` cards displayed on screen while audio plays
  - Animated pulsing `FAB` microphone button (react-native-reanimated pulse rings) — red when recording, teal when idle
  - Error card with inline Retry button
  - Back navigation locked during interview to prevent accidental exit
- **Summary screen** — Session complete view with:
  - AI Coach Feedback card (closing message)
  - Stats row (questions answered, completion status)
  - Full Q&A transcript with colour-coded Q (primary) / A (green) role tags
  - Share Transcript (native share sheet) and New Interview buttons
- **Settings screen** — MD3 design with:
  - Gemini API key field with show/hide toggle
  - `SegmentedButtons` TTS provider toggle (Gemini / ElevenLabs)
  - ElevenLabs API key field (highlighted when ElevenLabs selected)
  - Save with validation + confirmation
  - Privacy notice
- **Gemini service** (`geminiService.ts`):
  - `generateInterviewText()` — Gemini 3.8 Flash text generation with system instruction, conversation history, temperature 0.8
  - `generateGeminiTTS()` — Gemini 3.8 Flash TTS, voice "Kore", returns base64 WAV/PCM
  - `transcribeAudio()` — Gemini 3.8 Flash with inline audio base64, temperature 0, returns plain transcript
- **ElevenLabs service** (`elevenLabsService.ts`):
  - `generateElevenLabsTTS()` — `eleven_multilingual_v2` model, Rachel voice, returns base64 MP3
- **Audio service** (`audioService.ts`):
  - `setPlaybackMode()` / `setRecordingMode()` — switches expo-av between loudspeaker output and mic input
  - `playBase64Audio()` — writes temp file, plays via `Audio.Sound.createAsync`, waits for completion with 2-min safety timeout
  - `startRecording()` / `stopRecording()` — HIGH_QUALITY preset, cleans up stale recordings
  - `readAudioAsBase64()` — reads recording file, maps extension to MIME type
  - `requestMicrophonePermission()` — wraps `Audio.requestPermissionsAsync`
- **Settings store** (`settingsStore.ts`):
  - `loadSettings()` / `saveSettings()` — AsyncStorage JSON persistence with defaults
  - `getGeminiApiKey()` / `getTTSProvider()` — convenience getters
- **Theme** (`theme.ts`):
  - Custom MD3DarkTheme: navy `#0F172A` background, teal/cyan `#06B6D4` primary, `#1E293B` surfaces
  - `COLORS` raw palette constant for StyleSheet usage
- **Navigation** (`AppNavigator.tsx`):
  - Stack navigator: Home → Interview → Summary (Interview and Summary lock back gesture)
  - MD3-themed header (surface background, primary title colour)
- **Types** (`types/index.ts`):
  - `TTSProvider`, `AppSettings`, `ConversationTurn`, `InterviewRound`, `InterviewPhase`, `RootStackParamList`
- **Config files**: `app.json` (SDK 51, mic permissions iOS+Android, expo-av plugin), `package.json`, `babel.config.js` (NativeWind + Reanimated), `tailwind.config.js`, `tsconfig.json`, `nativewind-env.d.ts`

### Dependencies (v1.0.0)
| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~51.0.28 | Managed workflow runtime |
| `expo-av` | ~14.0.7 | Audio record + playback |
| `expo-file-system` | ~17.0.1 | Temp audio file I/O |
| `react-native-paper` | ^5.13.1 | Material Design 3 components |
| `react-native-reanimated` | ^3.16.2 | Mic pulse animation |
| `react-native-safe-area-context` | ^4.14.0 | Safe area insets |
| `react-native-screens` | ^4.4.0 | Native screen optimisation |
| `@react-navigation/native` | ^6.1.17 | Navigation container |
| `@react-navigation/stack` | ^6.3.29 | Stack navigator |
| `@react-native-async-storage/async-storage` | 1.23.1 | API key persistence |
| `nativewind` | ^4.1.23 | Tailwind CSS for RN |
| `tailwindcss` | ^3.4.16 | Tailwind core |

### AI Models Used (confirmed from ai.google.dev, 9 Oct 2026)
| Role | Model ID |
|------|----------|
| Interview question generation | `gemini-3.8-flash` |
| Text-to-speech | `gemini-3.8-flash-tts` |
| Answer transcription | `gemini-3.8-flash` |

---

## [0.1.0] — 2026-10-09 (Design session)

### Decided
- Platform: React Native (Expo) — chosen over web app so MUI/ShadCN question came up; resolved to use Material Design 3 (React Native Paper v5) which is the native Android equivalent
- Models: corrected from deprecated `gemini-2.0-flash` / `gemini-2.5-flash-preview-tts` to current `gemini-3.8-flash` / `gemini-3.8-flash-tts` after consulting live Google AI docs
- TTS providers: Gemini 3.8 Flash TTS (default, free) + ElevenLabs (optional, paste key in-app)
- Design: dark navy/teal MD3 theme + NativeWind v4 utility classes

---

[Unreleased]: https://github.com/YOUR_USERNAME/InterviewCoach/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/YOUR_USERNAME/InterviewCoach/releases/tag/v1.0.0
[0.1.0]: https://github.com/YOUR_USERNAME/InterviewCoach/releases/tag/v0.1.0
