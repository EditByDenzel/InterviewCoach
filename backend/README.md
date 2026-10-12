# Coachie custom voices

Node 22.9+ and FFmpeg are required. Run commands from this directory.

```powershell
npm ci
npm run voices:init
npm start
```

Initialization reads the Onyi/Denzel reference and consent pairs from
`backend/private/recordings/` in the app development folder. It uses the first 30 seconds of reference speech,
leaves consent complete, and converts temporary copies to mono 24 kHz PCM WAV.
Original recordings are unchanged. Google verifies the real consent. A rejection
does not independently establish that the words were wrong; investigate the
reported cause. Never synthesize or edit consent to bypass verification.
The default local files are `Onyi-reference.m4a`, `Onyi-consent.m4a`,
`Denzel-reference.m4a`, and `Denzel-consent.m4a`. Denzel pairs the new Chidera
Voice 4 reference with Consent 5. Earlier Chidera/Denzel inputs remain private archives.
Moved reference files were verified against their original SHA-256 hashes.
This folder is Git-ignored.
An optional JSON manifest path can be passed with `npm run voices:init -- manifest.json`.

`GEMINI_API_KEY` belongs in the server environment. Local development also reads
the existing ignored root `.env` and accepts its `EXPO_PUBLIC_GEMINI_API_KEY`.
Initialization uses `store: true` and returns a persistent `voice_id`, written to
`backend/private/voices.json`, never printed or sent to the frontend. Profiles
are read on each request, so profile replacement does not require a backend restart.
Google documents one-year retention for persistent profiles. Provider expiration
metadata is saved when available; usage can extend stateful expiry, so the backend
lets Google determine availability. Older seven-day keys remain supported during
migration, but new initialization always creates persistent profiles.
Protect the private directory with your host's filesystem access
controls (POSIX mode 0600 is requested; Windows uses its directory ACLs).

Set this public, non-secret address in the app's ignored `.env`, then restart Expo:

```dotenv
EXPO_PUBLIC_TTS_BACKEND_URL=http://localhost:8787
```

Settings → Voice includes Onyi and Denzel. Selecting one applies to NEW A/B
sessions and Gemini legacy interviews. Existing sessions retain their voice,
and saved audio/replay retains the original recording. ElevenLabs remains its
own legacy engine. Both custom voices share the existing WAV decoder, durable
audio storage, cancellation, playback progress and measured waveforms.

`generateCustomVoiceAudio` accepts text and/or recorded audio, and
`speakWithCustomVoice` in `src/services/customVoicePlayback.ts` generates and
plays text with the same cross-platform player. All existing Gemini speech
calls automatically route custom voice names to this backend.

POST `/api/tts` with JSON:

```json
{"voice":"Onyi","text":"Hello!","style":"Warm and conversational"}
```

Optional `audio: {data: "BASE64", mimeType: "audio/mp4"}` is accepted. If text is
absent, Gemini Flash transcribes the original language first; incomplete
transcription is rejected. If both are supplied, explicit text is spoken.
Audio is never treated as a new reference voice or an instruction to TTS.
Language coverage and consent checks depend on Google's supported languages.
Response JSON is `{audio, mimeType: "audio/wav", text, voice}`; `Accept: audio/wav`
returns binary instead. This is complete-clip playback, not streaming.

This backend is for this single-owner app. It verifies `Authorization: Bearer`
against the server's Gemini account key, matching the key already saved locally
in the app. No additional public Expo token or voice key is introduced. It binds
to loopback by default and permits only localhost/127.0.0.1 port 8083 origins.
For a physical phone, set `TTS_HOST=0.0.0.0`, point the app URL at the computer's
LAN address and configure `TTS_ALLOWED_ORIGINS` for any web origins needed.
Use HTTPS and real user-session authentication before a multi-user public
deployment; do not distribute the owner's Gemini credential with a public app.
Payloads are limited to 12 MB, recordings to 8 MB and simultaneous requests to
two. Provider errors are redacted. Existing provider SDK deadlines are 120s.

Sources: [voice replication](https://ai.google.dev/gemini-api/docs/voice-replication)
and [speech generation](https://ai.google.dev/gemini-api/docs/speech-generation).

Validation: `npm test` here, plus `npm test -- --runInBand` and `npx tsc --noEmit`
in the app root. Automated tests do not prove consent acceptance or phone audio.

Live check on 12 October 2026: Google accepted Onyi's replacement consent and
the app endpoint generated a valid WAV preview. Onyi was subsequently recreated
with persistent storage. Chidera's third and fourth consent recordings
was rejected for a phrase mismatch; its voice is not active yet. No diagnostic
transcription of consent was performed. Chidera was also retried with persistent
storage and received the same reported rejection.
Use `node --env-file-if-exists=../.env audition.mjs Onyi` for a private preview
while the backend is running. Physical phone playback remains unverified.

A fresh persistent Denzel attempt using Voice 4 and Consent 4 also received
Google's reported consent phrase mismatch. No Denzel ID was created. Denzel
replaces Chidera in the picker; the old name remains recognized internally for
saved-session compatibility. Onyi's working profile was not regenerated.

The subsequent Consent 5 + Voice 4 attempt also received Google's reported
phrase mismatch. Consent 5 is now the active Denzel consent file; Consent 4 is
archived. No Denzel profile has been created and Onyi remains unchanged.

## Background conversation timings

Authenticated `POST /api/telemetry` accepts metadata-only event batches and appends per-session JSONL under the ignored `private/conversation-timings/` directory. This route does not invoke speech or use a speech concurrency slot. The app queues offline events locally and retries them without adding UI.

Run `node timing-report.mjs` or `node timing-report.mjs <sessionId>` here to summarize stage latency, failures and reply-to-playback delay. See [CONVERSATION_TIMING.md](../CONVERSATION_TIMING.md) for fields, retry behavior and verification. Logging starts with this release; earlier life-after-school generation timings are unavailable.
