# 🏗️ InterviewCoach — Architecture

> Deep technical reference for developers and AI models continuing this project.

---

## Current UI and preferences (9 October 2026)

`CoachieDesign.tsx` supplies the responsive native frame, orange radial backdrop,
Figma icons, voice controls, and shared tokens. `SettingsDesign.tsx` supplies
grouped rows, headers, fields, and actions. Home, Interview, Summary, and all
Settings subpages use this shared design. Styling uses React Native StyleSheet.

Settings persist in AsyncStorage. Missing fields receive migration defaults:
English, Gemini Kore, and the existing Rachel voice ID. Subpage saves merge only
that page’s preferences, preserving API keys and other choices. A session takes
a settings snapshot; changes affect the next session.

The development-only design fixture replaces Gemini requests when explicitly
enabled; it cannot run in production. It stores demo preferences in memory and
blocks ElevenLabs requests. Normal operation uses real providers.

## Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│                     InterviewCoach                       │
│                  React Native (Expo 51)                  │
│                      TypeScript                          │
├──────────────────────┬──────────────────────────────────┤
│    UI Layer          │       Logic / Service Layer        │
│                      │                                    │
│  react-native-paper  │  geminiService.ts                 │
│  (MD3 components)    │    └─ Gemini 3.8 Flash (text)     │
│                      │    └─ Gemini 3.8 Flash TTS        │
│  NativeWind v4       │    └─ Gemini 3.8 Flash (audio)    │
│  (Tailwind classes)  │                                    │
│                      │  elevenLabsService.ts             │
│  react-native-       │    └─ ElevenLabs TTS (MP3)        │
│  reanimated          │                                    │
│  (animations)        │  audioService.ts                  │
│                      │    └─ expo-av (record + play)     │
│  @react-navigation   │    └─ expo-file-system            │
│  (routing)           │                                    │
│                      │  settingsStore.ts                 │
│                      │    └─ AsyncStorage                 │
└──────────────────────┴──────────────────────────────────┘
```

---

## Directory Structure (annotated)

```
InterviewCoach/
│
├── App.tsx                      # Root — GestureHandlerRootView > PaperProvider > AppNavigator
├── app.json                     # Expo config: SDK 51, permissions, plugins, orientations
├── package.json                 # All dependencies + scripts
├── babel.config.js              # babel-preset-expo + nativewind/babel + reanimated/plugin
├── tailwind.config.js           # NativeWind v4 content paths + COLORS extension
├── tsconfig.json                # Strict TS, path aliases, nativewind types
├── nativewind-env.d.ts          # className prop type shim for NativeWind
├── PLAN.md                      # Product roadmap (this project's source of truth)
├── CHANGELOG.md                 # Keep-a-Changelog format version history
├── ARCHITECTURE.md              # This file
│
└── src/
    ├── theme.ts                 # AppTheme (MD3DarkTheme extended) + COLORS raw palette
    │
    ├── types/
    │   └── index.ts             # All shared TS types: TTSProvider, AppSettings,
    │                            # InterviewRound, InterviewPhase, RootStackParamList
    │
    ├── navigation/
    │   └── AppNavigator.tsx     # createStackNavigator, MD3 header options
    │                            # Routes: Home | Interview | Summary | Settings
    │
    ├── store/
    │   └── settingsStore.ts     # loadSettings() / saveSettings() → AsyncStorage
    │                            # Key: '@interview_coach_settings'
    │
    ├── services/
    │   ├── geminiService.ts     # All Gemini API calls (3 functions)
    │   │                        # Constants: TEXT_MODEL, TTS_MODEL, TRANSCRIBE_MODEL
    │   ├── elevenLabsService.ts # generateElevenLabsTTS() → base64 MP3
    │   └── audioService.ts      # playBase64Audio(), startRecording(), stopRecording(),
    │                            # readAudioAsBase64(), requestMicrophonePermission()
    │
    └── screens/
        ├── HomeScreen.tsx       # Topic input, chip suggestions, How-it-works, Start btn
        ├── InterviewScreen.tsx  # THE CORE: full 5-round loop, phase state machine,
        │                        # animated FAB, conversation history management
        ├── SettingsScreen.tsx   # Gemini key, ElevenLabs key, TTS toggle, save
        └── SummaryScreen.tsx    # Q&A transcript cards, AI feedback, share, new session
```

---

## Key Design Decisions

### 1. Phase State Machine (not a reducer)
`InterviewScreen` uses a simple `useState<InterviewPhase>` string enum rather than `useReducer`. This was a deliberate simplicity choice for v1. If state transitions become complex (retries, branching), migrate to `useReducer` or XState.

### 2. Conversation History as `useRef`
`historyRef` is a `useRef<GeminiMessage[]>` (not `useState`) because:
- It doesn't need to trigger re-renders
- It needs to be read synchronously inside `runRound` without stale closure issues
- Mutations are append-only (`appendToHistory`)

### 3. No Global State Library
All state lives in component-level hooks. This is appropriate for a single-screen-at-a-time app with no shared state between screens. If session history persistence or user profiles are added, introduce **Zustand** (lightweight) or **Jotai** (atomic).

### 4. API Keys at Runtime (not build-time)
Keys are user-entered and stored in AsyncStorage — never in `.env` or the bundle. This is the correct approach for a personal tool. For a multi-user SaaS: move key management server-side with auth.

### 5. TTS Audio Pipeline
```
Gemini TTS API
    │ base64 WAV/PCM string
    ▼
FileSystem.writeAsStringAsync(cacheDir/tts_output.wav, base64, {encoding: Base64})
    │ local URI
    ▼
Audio.Sound.createAsync({ uri }, { shouldPlay: true })
    │ wait for didJustFinish
    ▼
sound.unloadAsync()
```
**Potential issue:** Gemini TTS may return raw 16-bit PCM without a WAV header. In that case expo-av will fail silently. Fix: prepend a 44-byte WAV header before writing (24kHz, 16-bit, mono — values from Gemini docs).

### 6. Recording Audio Pipeline
```
Audio.setAudioModeAsync({ allowsRecordingIOS: true })
    │
Audio.Recording.prepareToRecordAsync(HIGH_QUALITY)
    │
recording.startAsync()
    │ (user speaks)
recording.stopAndUnloadAsync()
    │ uri: file:///.../.../AV/recording-xxx.m4a
    ▼
FileSystem.readAsStringAsync(uri, {encoding: Base64})
    │ + MIME type from extension map
    ▼
transcribeAudio(apiKey, base64, mimeType)  → Gemini inline audio
```

### 7. Navigator Type Mismatch (Known v1.0 Issue)
`AppNavigator.tsx` uses `createStackNavigator` from `@react-navigation/stack` but screen props are typed as `NativeStackScreenProps` from `@react-navigation/native-stack`. These are compatible at runtime but produce TypeScript errors. **Fix:**
```bash
npx expo install @react-navigation/native-stack
```
Then in `AppNavigator.tsx`:
```ts
import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Stack = createNativeStackNavigator<RootStackParamList>();
```

---

## Environment & Dependencies

### Runtime Requirements
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli` or `npx expo`)
- Expo Go app on Android/iOS for development

### Key Dependency Notes
- `react-native-paper` v5 requires `react-native-vector-icons` OR `@expo/vector-icons`. In Expo managed workflow, `@expo/vector-icons` is pre-bundled — you may need to remove `react-native-vector-icons` and import from `@expo/vector-icons` instead.
- `nativewind` v4 requires `babel-preset-expo` with `jsxImportSource: "nativewind"` in `babel.config.js` — already configured.
- `react-native-reanimated` must be the **last** Babel plugin — already configured.

### Babel Config
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-reanimated/plugin"],  // MUST be last
  };
};
```

---

## Gemini API Reference (Oct 2026)

### Base URL
```
https://generativelanguage.googleapis.com/v1beta/models
```

### Model IDs (stable as of 9 Oct 2026)
| Use | Model ID | Notes |
|-----|----------|-------|
| Text generation | `gemini-3.8-flash` | Latest stable Flash |
| Text-to-speech | `gemini-3.8-flash-tts` | Studio-grade, "Kore" voice |
| Audio transcription | `gemini-3.8-flash` | Pass audio as inlineData |

### Available TTS Voices (Gemini 3.8 Flash TTS)
`Kore` · `Aoede` · `Charon` · `Fenrir` · `Puck` · `Leda` · `Orus` · `Zephyr`  
Currently hardcoded to `Kore`. See P1 in PLAN.md for voice picker feature.

---

## Colour Palette

| Token | Hex | Used for |
|-------|-----|---------|
| `background` | `#0F172A` | Screen backgrounds |
| `surface` | `#1E293B` | Cards, surfaces |
| `surfaceElevated` | `#263348` | Elevated cards, inputs |
| `accent` (primary) | `#06B6D4` | Primary buttons, progress, text |
| `accentDim` | `#0E7490` | Inverse primary, hover states |
| `success` | `#22C55E` | Answer cards, completion |
| `warning` | `#F59E0B` | Thinking/transcribing phase |
| `error` | `#EF4444` | Error states |
| `recordActive` | `#F43F5E` | FAB when recording |
| `border` | `#334155` | Dividers, outlines |
| `textSecondary` | `#94A3B8` | Subtitles, labels |
