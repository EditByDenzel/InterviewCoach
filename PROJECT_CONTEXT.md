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
Home -> Interview -> Summary. Settings opens focused Language, Voice, API Keys,
and About pages. All screens share the orange glow, dark glass surfaces, and
rounded controls from Coachie’s Figma design.
The interview asks five questions, speaks them aloud, records each answer,
transcribes it, generates follow-ups, and finishes with feedback and a shareable
transcript. Settings persist in AsyncStorage.

Design source: https://www.figma.com/design/rizQLyexn1ZrW6HJvwdkCM/Coachie-App
Selected frames: Home `8:24`, Voice & Chat Interview Flow `8:108`.
Settings follows the user's grouped-row reference while reusing Coachie's palette.
Home's labeled Start conversation action and per-card gradients are deliberate
usability refinements requested after the first preview. `UI_REVIEW.md` records
the inspected UI states and remaining verification boundaries.

Services: `src/services/geminiService.ts`, `elevenLabsService.ts`, and
`audioService.ts`. Screens are in `src/screens`; navigation in `src/navigation`.

Configured models remain `gemini-3.8-flash` for text and transcription and
`gemini-3.8-flash-tts` for speech. Default voice remains `Kore`; users can
choose six Gemini voices or an ElevenLabs voice ID. Interview language defaults
to English and is included in the question/feedback prompt. Google's model catalog lists
both model IDs at https://ai.google.dev/gemini-api/docs/models (checked during
setup). This does not verify account access or a live interview session.
ElevenLabs remains optional with Rachel as the default voice ID.

## Run and verify

Dependencies are installed in the original folder. For a fresh checkout run
`npm ci`. Start with `npm start`, or `npm run web` for the browser preview.
Run `npm test -- --runInBand` and `npx tsc --noEmit` for automated checks.

Latest checks: 11 tests across three suites passed and TypeScript reported
no errors. Web, Android, and iOS production bundles exported without loading .env.
Expo SDK 51 navigation dependencies were aligned after an existing
react-native-screens/codegen mismatch. Browser checks
covered Home, settings subpages, saved preferences, validation, 320px layouts,
and a complete five-round typed session using development fixtures. Jest emits an existing ts-jest isolatedModules deprecation warning.
Real-device recording, playback, and paid/live API calls were not tested.

The existing ignored `.env` can seed `EXPO_PUBLIC_GEMINI_API_KEY`. Do not print
or commit it. Expo public environment values become part of the client bundle;
enter keys in Settings when distributing a build rather than bundling a private
key. `.env.example` documents the variable without a credential.

## Pending work and older documentation

Consult `PLAN.md` for the roadmap. Known unverified areas include raw PCM/WAV
handling for Gemini TTS, Android recording MIME type, NativeWind rendering,
real-device audio replay and retry behavior. EAS/distribution is not configured.
Navigation types and missing assets have already been fixed.
`npm run preview:design` runs a development-only fixture at port 8084 with dummy
keys and canned questions/silent audio. Use typed answers: its microphone still
uses the real device. ElevenLabs calls are blocked in that fixture. The normal
app uses the selected provider. SVG assets are bundled as exact XML for native
offline rendering. Only three Inter font weights are loaded. Unit tests and
environment seeding already exist, despite older unchecked roadmap entries.
Treat historical release links and readiness claims as historical documentation.

