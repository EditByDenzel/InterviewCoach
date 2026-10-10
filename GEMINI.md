# Coachie provider and development guidelines

Read PROJECT_CONTEXT.md, AB_IMPLEMENTATION_PLAN.md and ARCHITECTURE.md for current scope. Coachie uses scenario-based A/B conversations; existing five-round interviews remain supported on legacy routes.

- Runtime: React Native / Expo SDK 51, TypeScript, React Native Paper and shared orange design/motion components.
- Configured text/transcription model: gemini-3.8-flash, through generateContent. Require complete responses and bounded fetch/body deadlines.
- Configured A/B TTS model: gemini-3.8-flash-tts, through Interactions with response_format audio and generation_config.speech_config voice. Keep literal source text separate from speech_metadata.style; default WAV output must not be wrapped again as assumed raw PCM.
- Keep selected language, persona and opener consistent across runs. Thai source remains background context; English is visible. Nigerian English is not Pidgin by default.
- Transcription happens after each finished recording. Live PCM/captions are optional future work.
- A/B always uses Gemini; ElevenLabs remains an optional legacy interview provider. Do not claim measured naturalness, latency or provider access without a live check.
- Never commit credentials, .env, recordings, private references, node_modules or generated exports. Expo public variables enter client bundles.
- Preserve asynchronous save/recording ownership and stable turn IDs; retries must not duplicate accepted turns. Report corrupt metadata rather than silently dropping it.
- Run npm test -- --runInBand, npx tsc --noEmit and git diff --check before commit. Update CHANGELOG.md and distinguish simulated checks from physical/device/provider results.

Provider documentation used in the research: https://ai.google.dev/gemini-api/docs/speech-generation. Further sources and audition criteria are in VOICE_CONVERSATION_RESEARCH.md.
