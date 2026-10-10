# Coachie

Coachie is a React Native / Expo SDK 51 app for scenario-based voice conversations and A/B assistant comparisons. Coachie plays the person asking for help; Model A and Model B answer from a computer while a phone captures their audio. The earlier five-round interview flow remains available to legacy sessions.

## Run

```sh
npm ci
npm start
```

Use an SDK 51-compatible client or development build. Android and iPhone are both targets; physical-device validation and distributable builds remain pending. `npm run web` opens the normal browser app. Enter your Gemini key through Home's Settings icon, then select a language and voice. The new A/B flow uses Gemini text, transcription and TTS; ElevenLabs remains an optional legacy-interview provider. Model availability and billing depend on your provider account.

## Scenario flow

1. Type a topic/scenario or tap Photo to capture/import an image.
2. Review the extracted English title, role, objective, facts, constraints, language, duration, optional minimum exchanges, search requirement and evaluation priorities. Correct unclear or missing details before starting.
3. Choose/preview a character and explicitly start Model A.
4. Coachie speaks in the selected language. Record the model's answer with automatic listening or manual controls; pause, stop or replay as needed.
5. After recording stops, the app transcribes the original language, translates to English when needed and chooses a context-aware follow-up. Original source text stays in background evidence. Live captions are not required or implemented.
6. End A, switch models on the computer and explicitly start B below its divider. B reuses the same saved opener while its reasoning history starts fresh.
7. After both runs, review a comparison with turn evidence and limitations. Choose A, B, tie or insufficient evidence independently of the recommendation.

There is no fixed five/ten-question budget. Scenario duration and any explicit minimum exchanges drive the conversation; the maximum time takes priority. Follow-ups adapt to answers while keeping scenario coverage comparable. A matching saved utterance can reuse its audio; adaptive decisions still need reasoning.

Thai, English and Nigerian English character directions are provided for ordinary adults in their twenties/thirties. These are audition candidates, not verified accent or naturalness claims. English text is displayed by default even when the speech is Thai.

## History and privacy

A/B transcripts, original/translated wording, comparisons and recordings stay locally until explicit deletion. Audio uses native document files or browser IndexedDB; metadata and settings use AsyncStorage. Local storage is not a cloud backup: uninstalling the app or clearing browser/OS storage can remove it. An unfinished unusable recording can be explicitly deleted to retry capture. Legacy sessions without retained audio show transcripts only.

Scenario images, recordings, transcripts and relevant conversation context are sent to Google for extraction, transcription, translation, dialogue or evaluation. Available original model recordings are included in the final audio assessment; missing audio and unverified factual/search claims are reported as limitations. Keys are stored locally in AsyncStorage, which is not an encrypted credential vault. Never commit keys or private media. An `EXPO_PUBLIC_GEMINI_API_KEY` can seed development settings, but Expo public values are embedded in bundles: omit private keys from distributed builds.

The private Live S2S reference informed comparison principles. Its own platform prohibits AI-authored prompts/evaluations and requires headphones. This is an independent practice/evaluation app, not a claimed compliant integration with that platform.

## Checks and preview

```sh
npm test -- --runInBand
npx tsc --noEmit
npm run preview:design
```

The preview at port 8084 uses dummy credentials, canned replies, simulated microphone capture and silent audio. It makes no paid provider calls. Renderer/service/storage tests and browser fixtures do not establish physical microphone/camera reliability, translation quality, natural accents or live latency.

See [AB_IMPLEMENTATION_PLAN.md](AB_IMPLEMENTATION_PLAN.md) for delivery status and the physical-device matrix, [AB_CONVERSATION_BRIEF.md](AB_CONVERSATION_BRIEF.md) for decisions, [VOICE_CONVERSATION_RESEARCH.md](VOICE_CONVERSATION_RESEARCH.md) for research, [ARCHITECTURE.md](ARCHITECTURE.md) for source boundaries and [CHANGELOG.md](CHANGELOG.md) for changes.
