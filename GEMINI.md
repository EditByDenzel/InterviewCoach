# InterviewCoach Project Rules & Guidelines

## Overview
InterviewCoach is an AI-powered voice interview screening coach built with:
- **Runtime**: React Native (Expo SDK 51)
- **Design System**: Material Design 3 via `react-native-paper` v5 & `nativewind` v4
- **Audio Engine**: `expo-av`
- **AI Brain**: Gemini 3.8 Flash (`gemini-3.8-flash`)
- **Speech Synthesis (TTS)**: Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`, default voice: `Kore`) + ElevenLabs fallback
- **Transcription**: Gemini 3.8 Flash (`gemini-3.8-flash`) via inline audio understanding

## Project Structure
- `src/screens/`: `HomeScreen.tsx`, `InterviewScreen.tsx`, `SettingsScreen.tsx`, `SummaryScreen.tsx`
- `src/services/`: `geminiService.ts`, `elevenLabsService.ts`, `audioService.ts`
- `src/store/`: `settingsStore.ts` (persists settings to AsyncStorage, seeds from `.env`)
- `src/theme.ts`: Custom MD3DarkTheme palette (slate/navy background, cyan/teal accent)
- `tests/`: Jest test suites (`npm test`)

## Guidelines for Changes
1. **Never commit secrets**: API keys must stay in `.env` (which is git-ignored) or entered in-app.
2. **Audio modalities**: When requesting TTS from Gemini, always specify `responseModalities: ["AUDIO"]` and `speechConfig`.
3. **Tests**: Always run `npm test` before committing changes.
