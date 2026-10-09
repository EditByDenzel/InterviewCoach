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
- `src/screens/`: Home, Interview, Settings/Preferences, Summary, Conversation
- `src/services/`: `geminiService.ts`, `elevenLabsService.ts`, `audioService.ts`
- `src/store/`: settingsStore and conversationStore (local AsyncStorage)
- `src/components/`: shared orange design, motion, growing composer, history sidebar
- `src/theme.ts`: MD3DarkTheme aligned with Coachie's orange palette
- `tests/`: Jest test suites (`npm test`)

## Guidelines for Changes
1. **Never commit secrets**: API keys must stay in `.env` (which is git-ignored) or entered in-app.
2. **Gemini 3.8 TTS**: Use the Interactions API, `response_format: {type:'audio'}`,
   and `generation_config.speech_config: [{voice:voiceName}]`. Default output is
   WAV. Keep text/transcription requests on generateContent. See PROJECT_CONTEXT.
   Thai uses Flash TTS and its studio voices; Flash-Lite does not support Thai.
3. **Tests**: Always run `npm test` before committing changes.
4. **Changelog**: Always update CHANGELOG.md whenever making changes or additions to the codebase.
