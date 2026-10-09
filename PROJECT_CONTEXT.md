# InterviewCoach handoff

Updated: 9 October 2026.

## Working location and GitHub

Use `C:\Users\user\Documents\antigravity\InterviewCoach` as the working folder
for Antigravity and Codex. Open this same folder in each tool. A separate
Coachie checkout was populated during setup; it is not needed for development.

Repository: https://github.com/EditByDenzel/InterviewCoach
Branch: `main`, tracking `origin/main`.
GitHub connector identity and Git CLI repository access verified as
`EditByDenzel`, with administrator permission. The repository is public.

Before working: `git status --short --branch`, then `git pull --ff-only` when
the working tree is clean. After intentional changes, run checks, commit only
the intended files, and push. Avoid editing the same files simultaneously from
multiple tools. Git synchronizes committed files; private chat history and
local ignored files do not transfer through GitHub.

## Product and implementation

React Native with Expo SDK 51, TypeScript, React Native Paper v5, NativeWind v4.
Home -> Interview -> Summary, with Settings for API keys and TTS provider.
The interview asks five questions, speaks them aloud, records each answer,
transcribes it, generates follow-ups, and finishes with feedback and a shareable
transcript. Settings persist in AsyncStorage.

Services: `src/services/geminiService.ts`, `elevenLabsService.ts`, and
`audioService.ts`. Screens are in `src/screens`; navigation in `src/navigation`.

Configured models remain `gemini-3.8-flash` for text and transcription and
`gemini-3.8-flash-tts` for speech, voice `Kore`. Google's model catalog lists
both model IDs at https://ai.google.dev/gemini-api/docs/models (checked during
setup). This does not verify account access or a live interview session.
ElevenLabs remains the optional provider with Rachel voice.

## Run and verify

Dependencies are installed in the original folder. For a fresh checkout run
`npm ci`. Start with `npm start`, or `npm run web` for the browser preview.
Run `npm test -- --runInBand` and `npx tsc --noEmit` for automated checks.

During setup, all six tests across two suites passed and TypeScript reported
no errors. Jest emits an existing ts-jest isolatedModules deprecation warning.
Real-device recording, playback, and paid/live API calls were not tested.

The existing ignored `.env` can seed `EXPO_PUBLIC_GEMINI_API_KEY`. Do not print
or commit it. Expo public environment values become part of the client bundle;
enter keys in Settings when distributing a build rather than bundling a private
key. `.env.example` documents the variable without a credential.

## Pending work and older documentation

Consult `PLAN.md` for the roadmap. Known unverified areas include raw PCM/WAV
handling for Gemini TTS, Android recording MIME type, NativeWind rendering,
managed-workflow icons, and retry state. EAS/distribution is not configured.
Navigation types and missing assets have already been fixed. Unit tests and
environment seeding already exist, despite older unchecked roadmap entries.
Treat historical release links and readiness claims as historical documentation.

