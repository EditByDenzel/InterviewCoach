# 🎙️ InterviewCoach

An AI-powered mock interview app built with **React Native (Expo SDK 51)**, featuring:

- 🤖 **Gemini 3.8 Flash** for intelligent, contextual interview questions
- 🔊 **Gemini 3.8 Flash TTS** or **ElevenLabs** for natural-sounding interviewer voice
- 📝 **Gemini 3.8 Flash** audio transcription to capture your spoken answers
- 🎨 **Material Design 3** (React Native Paper v5 + NativeWind v4)
- 🎤 **Animated microphone FAB** with pulsing record indicator

---

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) — `npm install -g expo-cli`
- [Expo Go](https://expo.dev/client) app on your phone, OR an Android/iOS emulator
- **Gemini API key** from [Google AI Studio](https://aistudio.google.com/)
- *(Optional)* [ElevenLabs API key](https://elevenlabs.io/) for higher-quality TTS

---

## 🚀 Setup & Run

```bash
# 1. Clone / navigate to the project
cd InterviewCoach

# 2. Install dependencies
npx expo install

# 3. Start the dev server
npx expo start
```

Then scan the QR code with Expo Go, or press `a` for Android emulator / `i` for iOS simulator.

---

## ⚙️ Configuration

1. Open the app and tap **Settings & API Keys** on the Home screen.
2. Paste your **Gemini API key**.
3. Choose your **TTS provider**:
   - **Gemini TTS** — free, uses the "Kore" voice
   - **ElevenLabs** — higher quality, requires a paid ElevenLabs key
4. Tap **Save Settings**.

---

## 🎯 App Flow

| Step | Action |
|------|--------|
| 1 | Enter interview topic on Home screen (e.g. *React Native Developer*) |
| 2 | Tap **Start Interview** |
| 3 | AI generates a question and speaks it aloud |
| 4 | Tap **Record Answer** (pulsing mic FAB) |
| 5 | Speak your answer, then tap **Stop Recording** |
| 6 | Answer is transcribed and fed back to AI |
| 7 | Repeat for 5 rounds |
| 8 | AI delivers a closing performance summary |
| 9 | View full session transcript on the Summary screen |

---

## 🗂️ File Structure

```
InterviewCoach/
├── App.tsx                          # Root — PaperProvider + Navigator
├── app.json                         # Expo config + permissions
├── babel.config.js                  # Babel + NativeWind preset
├── tailwind.config.js               # NativeWind/Tailwind config
├── tsconfig.json                    # TypeScript config
├── nativewind-env.d.ts              # NativeWind className type shim
└── src/
    ├── theme.ts                     # MD3 dark theme + raw COLORS
    ├── types/index.ts               # Shared TypeScript types
    ├── navigation/AppNavigator.tsx  # Stack navigator
    ├── store/settingsStore.ts       # AsyncStorage wrappers
    ├── services/
    │   ├── geminiService.ts         # Text gen, TTS, transcription
    │   ├── elevenLabsService.ts     # ElevenLabs TTS
    │   └── audioService.ts         # expo-av playback + recording
    └── screens/
        ├── HomeScreen.tsx           # Topic entry + navigation
        ├── SettingsScreen.tsx       # API key + TTS config
        ├── InterviewScreen.tsx      # Live 5-round interview loop
        └── SummaryScreen.tsx        # Q&A transcript + AI feedback
```

---

## 🛠️ Key Technologies

| Library | Purpose |
|---------|---------|
| `expo-av` | Audio recording + playback (loudspeaker) |
| `expo-file-system` | Read/write temp audio files for TTS & transcription |
| `react-native-paper` v5 | Material Design 3 UI components |
| `nativewind` v4 | Tailwind CSS utility classes on React Native |
| `react-native-reanimated` | Smooth mic pulse animation |
| `@react-navigation/stack` | Screen navigation |
| `@react-native-async-storage/async-storage` | Persist API keys |

---

## 🔒 Privacy

All API keys are stored locally on your device via AsyncStorage. They are only sent directly to **Google's Generative Language API** and/or **ElevenLabs** — never to any third-party server.

---

## 📝 Notes

- The app requires **microphone permission** to record answers. On iOS this is declared in `app.json` under `infoPlist`. On Android the `RECORD_AUDIO` permission is listed.
- Audio plays through the **loudspeaker** by default (not earpiece) using `Audio.setAudioModeAsync`.
- If TTS fails, check your Gemini API key and ensure the `gemini-3.8-flash-tts` model is available in your region.
- Transcription uses `gemini-3.8-flash` with inline audio (base64). For best results, speak clearly in a quiet environment.

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| [`README.md`](README.md) | Setup & quick start (this file) |
| [`PLAN.md`](PLAN.md) | Full product plan, roadmap, P0 bugs, next steps |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Technical deep-dive: data flows, design decisions, API reference |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history (Keep-a-Changelog format) |

---

*Built with ❤️ using Expo SDK 51 · Gemini 3.8 Flash · Material Design 3 · Oct 2026*
