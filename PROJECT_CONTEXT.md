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
transcript. Settings and completed/in-progress conversation transcripts persist
in AsyncStorage. Home's hamburger opens a recent-conversation sidebar; selecting
a session opens its saved question/answer flow and feedback. Recordings remain
temporary, and the saved viewer is read-only with a Practice again action.

Design source: https://www.figma.com/design/rizQLyexn1ZrW6HJvwdkCM/Coachie-App
Selected frames: Home `8:24`, Voice & Chat Interview Flow `8:108`.
Settings follows the user's grouped-row reference while reusing Coachie's palette.
Home now uses a growing topic composer with an inline send action. Enter sends;
Shift+Enter inserts a newline on web. The Coachie icon opens Settings. Simulated
9:41, signal/battery icons, and the fake home indicator are removed.
Per-card gradients remain clipped within the cards. `UI_REVIEW.md` records
the inspected UI states and remaining verification boundaries.

Services: `src/services/geminiService.ts`, `elevenLabsService.ts`, and
`audioService.ts`. Screens are in `src/screens`; navigation in `src/navigation`.

Configured models remain `gemini-3.8-flash` for text and transcription and
`gemini-3.8-flash-tts` for speech. Default voice remains `Kore`; users can
choose 30 searchable Gemini studio voices or an ElevenLabs voice ID. Thai is
available and selects Gemini; Flash TTS supports Thai, while Flash-Lite TTS and
the app's ElevenLabs multilingual_v2 engine do not. Interview language defaults
to English and is included in the question/feedback prompt. Google's model catalog lists
both model IDs at https://ai.google.dev/gemini-api/docs/models (checked during
setup). This does not verify account access or a live interview session.
ElevenLabs remains optional with Rachel as the default voice ID.
Gemini TTS uses the documented Interactions REST API and default WAV output:
https://ai.google.dev/gemini-api/docs/speech-generation (checked 9 October 2026).

MotionProvider handles web/native reduced-motion preferences and fine-pointer
hover capability. Screens fade/slide in 240ms, drawers in 260ms, transcripts
reveal in 200ms, and the topic composer grows/shrinks in 180ms. The composer
measures the actual web textarea, including unbroken text and newlines; growth
is capped at seven visible lines with scroll available and native scrollbar
chrome hidden. Audio waveforms fill their available width. Playback progress
uses expo-av position/duration callbacks; bars animate during playback and
transcription. These are stylized bars, not extracted amplitude measurements.
Mic halos breathe while ready/recording and stop when paused or disabled.
Loading dots animate only while an operation is active. Loops respect reduced
motion and stop on unmount.

## Run and verify

Dependencies are installed in the original folder. For a fresh checkout run
`npm ci`. Start with `npm start`, or `npm run web` for the browser preview.
Run `npm test -- --runInBand` and `npx tsc --noEmit` for automated checks.

Latest checks: 15 tests across four suites passed and TypeScript reported
no errors. Web, Android, and iOS production bundles exported without loading .env.
Expo SDK 51 navigation dependencies were aligned after an existing
react-native-screens/codegen mismatch. Browser checks
covered 320px/390px layouts, composer growth/shrink and bounded long-word input,
full-width audio bars, transcript reveal/collapse, changing mic halo transforms,
recording/pause/transcription/replay UI, and all five rounds using fixtures.
Saved completed/unfinished conversations reopen after reload. Thai and Puck
preference selection is verified in the fixture. Jest emits an existing
ts-jest isolatedModules deprecation warning.
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
keys and canned questions/silent audio. Its microphone capture is simulated;
it never requests microphone access or sends paid API requests. Short artificial
response delays expose loading states. ElevenLabs calls are blocked. The normal
app uses the selected provider. SVG assets are bundled as exact XML for native
offline rendering. Only three Inter font weights are loaded. Unit tests and
environment seeding already exist, despite older unchecked roadmap entries.
Treat historical release links and readiness claims as historical documentation.

