# 🗺️ InterviewCoach — Project Plan

> **Last updated:** 9 October 2026  
> **Status:** v1.0.0 — Core loop complete, ready for testing & iteration  
> **Stack:** React Native (Expo SDK 51) · TypeScript · Gemini 3.8 Flash · Material Design 3

---

## 🎯 Product Goal

A mobile app that simulates a realistic screening/job interview using AI voice. The user types a topic or role, the AI interviewer speaks questions aloud using natural TTS, records and transcribes the user's spoken answers, then uses those answers to contextually generate follow-up questions. After 5 rounds the AI delivers a constructive spoken closing summary.

---

## ✅ What Is Built (v1.0.0)

| Feature | Status | File(s) |
|---------|--------|---------|
| Home screen with topic input + quick-pick chips | ✅ Done | `HomeScreen.tsx` |
| Settings screen — Gemini + ElevenLabs keys, TTS toggle | ✅ Done | `SettingsScreen.tsx` |
| 5-round interview loop with phase state machine | ✅ Done | `InterviewScreen.tsx` |
| AI question generation — Gemini 3.8 Flash | ✅ Done | `geminiService.ts` |
| Gemini TTS (`gemini-3.8-flash-tts`, voice: "Kore") | ✅ Done | `geminiService.ts` |
| ElevenLabs TTS fallback (voice: Rachel) | ✅ Done | `elevenLabsService.ts` |
| Loudspeaker playback via expo-av | ✅ Done | `audioService.ts` |
| Microphone recording via expo-av | ✅ Done | `audioService.ts` |
| Transcription via Gemini 3.8 Flash (audio inline) | ✅ Done | `geminiService.ts` |
| Animated pulsing mic FAB (react-native-reanimated) | ✅ Done | `InterviewScreen.tsx` |
| Phase status chips (AI Speaking / Listening / Thinking) | ✅ Done | `InterviewScreen.tsx` |
| Progress bar (Question N/5) | ✅ Done | `InterviewScreen.tsx` |
| AI closing summary spoken aloud | ✅ Done | `InterviewScreen.tsx` |
| Session summary screen with full Q&A transcript | ✅ Done | `SummaryScreen.tsx` |
| Share session as plain text | ✅ Done | `SummaryScreen.tsx` |
| AsyncStorage persistence of API keys | ✅ Done | `settingsStore.ts` |
| Material Design 3 dark theme | ✅ Done | `theme.ts` |
| NativeWind v4 (Tailwind for RN) configured | ✅ Done | `tailwind.config.js` |
| TypeScript strict mode | ✅ Done | `tsconfig.json` |
| iOS + Android microphone permissions declared | ✅ Done | `app.json` |

---

## 🔜 Planned / Next Steps

### P0 — Bugs to Verify on First Test
These should be checked as soon as the app runs on a real device:

- [ ] **Audio MIME type on Android** — `expo-av` HIGH_QUALITY records as `audio/m4a` on Android but the file extension may vary by device. Confirm `readAudioAsBase64` correctly maps it. May need to force `audio/m4a` regardless of extension.
- [ ] **Gemini TTS audio format** — The `gemini-3.8-flash-tts` model returns PCM/WAV base64. Confirm the file written is playable by expo-av without needing WAV header injection. If silent: may need to wrap raw PCM bytes in a WAV header (44-byte RIFF header, 24kHz, 16-bit mono).
- [ ] **`@react-navigation/native-stack` vs `@react-navigation/stack`** — The navigator uses `@react-navigation/stack` but screen props import `NativeStackScreenProps`. Align these — switch navigator to `createNativeStackNavigator` from `@react-navigation/native-stack` (needs separate install) OR change type imports to `StackScreenProps`.
- [ ] **NativeWind className not applied** — If NativeWind classes don't apply, confirm `nativewind-env.d.ts` is referenced in `tsconfig.json` and `babel.config.js` has the correct preset order.
- [ ] **`react-native-vector-icons` linking** — May require `npx expo install @expo/vector-icons` instead on Expo managed workflow.

### P1 — High-Value Improvements
- [ ] **Retry on error per-round** — Currently shows a Retry button but `runRound(currentRound)` may re-use stale state. Add proper state reset.
- [ ] **Configurable round count** — Let user choose 3, 5, or 10 questions from Home screen.
- [ ] **Voice selection** — Let user pick from Gemini's available voice names (Kore, Aoede, Charon, Fenrir, Puck, etc.) in Settings.
- [ ] **ElevenLabs voice picker** — Fetch `/v1/voices` and show list.
- [ ] **Session history** — Persist past sessions to AsyncStorage; show a "History" screen.
- [ ] **Timer per answer** — Optional countdown showing how long user has spoken.
- [ ] **Score/rating** — After session, AI rates each answer 1–10 and gives specific tips.

### P2 — Polish
- [ ] **Splash screen** — Add actual icon/splash assets (currently placeholder paths in app.json).
- [ ] **Haptic feedback** — `expo-haptics` for mic start/stop.
- [ ] **Background keep-awake** — `expo-keep-awake` so screen doesn't sleep mid-interview.
- [ ] **Accessibility** — Add `accessibilityLabel` to all interactive elements.
- [ ] **Tablet layout** — Wider content column for iPad.
- [ ] **Dark/light theme toggle** — Currently hard-coded dark.

### P3 — Platform / Distribution
- [ ] **EAS Build** — Set up `eas.json` and `eas build` for a proper APK/IPA.
- [ ] **Environment variables** — Move from AsyncStorage to `.env` + `expo-constants` for CI/CD.
- [ ] **Unit tests** — Jest + `@testing-library/react-native` for service layer.
- [ ] **E2E tests** — Detox or Maestro for interview flow.
- [ ] **Play Store / App Store listing** — Screenshots, description, privacy policy.

---

## 🏗️ Architecture

### State Machine (InterviewScreen)

```
idle
  │
  ├─[mount]──► generating_question ──► speaking ──► idle
  │                                                   │
  │                                          [user presses FAB]
  │                                                   │
  │                                               recording
  │                                                   │
  │                                          [user presses FAB]
  │                                                   │
  │                                            transcribing
  │                                                   │
  │                                    ┌──────────────┴──────────────┐
  │                                  (round < 5)               (round = 5)
  │                                    │                             │
  │                           generating_question                 closing
  │                                    │                             │
  │                                  speaking                      done
  │                                    │                             │
  └────────────────────────────────── idle                    → SummaryScreen
```

### Data Flow

```
User types topic
    │
    ▼
HomeScreen ──navigate──► InterviewScreen(topic)
                                │
                          loadSettings()
                                │
                     ┌──────────▼──────────┐
                     │  Conversation Loop   │
                     │                      │
                     │  generateInterviewText()   ◄── historyRef[]
                     │       │                              ▲
                     │  generateGeminiTTS() or             │
                     │  generateElevenLabsTTS()             │
                     │       │                              │
                     │  playBase64Audio()                   │
                     │       │                              │
                     │  startRecording()                    │
                     │       │  (user speaks)               │
                     │  stopRecording()                     │
                     │       │                              │
                     │  readAudioAsBase64()                 │
                     │       │                              │
                     │  transcribeAudio() ─────────────────┘
                     │       │
                     │  round++ ──────────────────────────────► runClosing()
                     └──────────────────────────────────────────────│
                                                                     ▼
                                                              SummaryScreen
```

### Service Layer Responsibilities

| Service | Responsibility | External API |
|---------|---------------|-------------|
| `geminiService.ts` | Text generation, TTS, transcription | `generativelanguage.googleapis.com` |
| `elevenLabsService.ts` | TTS fallback | `api.elevenlabs.io` |
| `audioService.ts` | expo-av wrapper — play + record | Device hardware |
| `settingsStore.ts` | Persist/retrieve app settings | AsyncStorage |

---

## 🔑 API Reference (current as of Oct 2026)

### Gemini Text — `gemini-3.8-flash`
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=KEY
```
Body: `{ systemInstruction, contents: [{role, parts:[{text}]}], generationConfig: {temperature, maxOutputTokens} }`

### Gemini TTS — `gemini-3.8-flash-tts`
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent?key=KEY
```
Body: `{ contents: [{parts:[{text}]}], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } } }`  
Response: `candidates[0].content.parts[0].inlineData.data` → base64 WAV/PCM

Available voices: `Kore`, `Aoede`, `Charon`, `Fenrir`, `Puck`, `Leda`, `Orus`, `Zephyr`

### Gemini Transcription — `gemini-3.8-flash` (with audio)
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=KEY
```
Body: `{ contents: [{ parts: [{ inlineData: { mimeType: "audio/m4a", data: "<base64>" } }, { text: "Transcribe this audio..." }] }] }`

### ElevenLabs TTS
```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
Headers: xi-api-key: KEY, Accept: audio/mpeg
Body: { text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }
```
Default voice ID (Rachel): `21m00Tcm4TlvDq8ikWAM`

---

## 🧑‍💻 For the Next Developer / AI Model

1. **Read this file first**, then `CHANGELOG.md`, then `ARCHITECTURE.md`.
2. The single most likely bug to hit first is the **WAV header issue** with Gemini TTS — see P0 above.
3. The **nav type mismatch** (`NativeStackScreenProps` vs `@react-navigation/stack`) is a TypeScript error only — the app may still run but will show TS errors. Fix in `AppNavigator.tsx` and all screen files.
4. All model names are **constants at the top of `geminiService.ts`** — one-line change to update.
5. The conversation history is a simple `GeminiMessage[]` array in `historyRef` — it is never truncated. For long sessions this is fine; for 10+ rounds consider keeping only the last N turns.
6. **No state management library** is used — all state lives in component `useState`/`useRef`. For future features like session history, add Zustand or Jotai.
7. `.env` / secrets: currently zero build-time secrets. All keys are runtime user-entered. This is intentional for a personal tool but review before any multi-user deployment.
