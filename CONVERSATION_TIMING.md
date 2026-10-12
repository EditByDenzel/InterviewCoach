# Conversation timing backlog

Implemented 12 October 2026. No settings, buttons or timing dashboard were added.

The app retains an ordered timing outbox in AsyncStorage (`@coachie_timing_outbox_v1`). It sends batches to the existing configured voice backend (`EXPO_PUBLIC_TTS_BACKEND_URL`), at authenticated `POST /api/telemetry`. Offline uploads stay queued for the next flush. Logging never waits in the audio/conversation path. Existing speech authentication and allowed origins apply. The backend writes append-only files under `backend/private/conversation-timings/<sessionId>.jsonl`, excluded from Git. No automatic retention expiry is applied.

Each event contains a unique ID, session ID, A/B run, optional turn ID, UTC client timestamp, server receive timestamp, stage, selected voice/language and optional duration, outcome, audio seconds or reuse flag. Timing payloads contain no topic, transcripts, recordings, credentials or provider error bodies. Transcripts/recordings remain in the existing conversation store; this endpoint does not synchronize them between browsers/devices.

Stages cover recorder startup/stop, silence or idle trigger, captured reply finalization/read/save, transcription, English translation, concurrent reasoning from audio, fallback reasoning from text, accepted reuse decision, cached/generated TTS, playback and its first progress status, durable session save, comparison, session create/reopen/close and B opener reuse. Provider timings include their network round trip. Playback duration includes the entire clip; `audio.firstProgress` is the first player status, not a measured acoustic onset. Recorder silence still uses 2.3 seconds after speech. Initial setup inference is not currently timed.

Inspect locally, without app UI:

```powershell
cd backend
node timing-report.mjs
node timing-report.mjs <sessionId>
```

The report groups A/B stage durations, p50/p95, failures and reply-finalization-to-next-playback delay. Delivery is at least once, so event IDs are deduplicated by the report. A batch accepted by the server but interrupted before local acknowledgement can appear twice in the raw JSONL. Storage failures are best effort and do not interrupt conversations; no telemetry can survive a failed local storage write. Clearing site/app storage also clears the unsent outbox. Events start with this release; historical generation times cannot be reconstructed from transcript creation timestamps.

## Capture, durations and saving

One isolated meter spike no longer arms auto-finalization: two consecutive 80ms speech samples are required, retaining short one-word replies. Idle-without-speech pauses capture rather than submitting an answer. Digitally silent decodable audio is rejected before Gemini transcription. When finalized audio has no speech, Coachie asks for a repeat in the selected language and listens again. English captions remain visible. The original recording is retained in captureIssues until the conversation is explicitly deleted. Recovery utterances are excluded from dialogue context and scoring; missing speech never becomes a model answer or a model failure. Other audio receives explicit instructions to return `[NO_SPEECH]` when unintelligible; this is still a model judgment and cannot perfectly distinguish speech from TV/background speech.

Recorded reply duration is retained from the recorder's final status, with the existing elapsed-capture counter as fallback. It survives pending-transcript retries and is saved on the model turn. Playback backfills more accurate duration for older clips. Recorded waveform metadata is now preserved when copying temporary capture into durable storage.

Semantic changes autosave at mutation time, including questions, replies, recording references, run changes, playback duration and comparison. Explicit durable boundaries await that same save, preserving error/retry behavior. A final vote is optional and never required to save a comparison. Browser history remains local to that browser and origin (localhost and 127.0.0.1 are separate stores).

## Reported life-after-school test

The user tested the main app at localhost:8083 with the Onyi voice. Supplied screenshots establish both model runs reached comparison, the shared opener was reused, and an unrelated tourists/umbrellas transcript was accepted despite the user reporting no opening speech. The almost-flat visible waveform supports investigating silence/capture hallucination, but it does not prove what the recording contains. The comparison appears to penalize that opening; a capture error must not count as a model failure.

Shared opener plus adapted follow-ups follows `AB_CONVERSATION_BRIEF.md`: follow-up reuse is optional and must fit the current model's answers. Naturalness and fairness require comparable energy, depth, topics and length, not a fixed question count or mandatory identical follow-ups. Post-session findings and the separate final vote match the intended flow. The screenshots do not expose the full transcript, elapsed times or original audio, so whole-session adherence and the fairness of the final recommendation remain unverified. No adherence percentage is assigned.

## Verification

App regression suite: 214 passing tests. Backend: 9 passing tests. TypeScript and Git whitespace checks pass. Authenticated local endpoint probe returned HTTP 200 and persisted a diagnostic event. Coverage includes offline timing retry, ordered batching, backend validation/authentication, spike rejection, brief speech, paused capture, missing-speech recovery, waveform/duration retention, autosave without a vote and persistence retries. A new real microphone conversation and Android/iPhone tests remain necessary to validate the reported issue end to end.

## Skills and priority

Photo extraction now retains skillsTested separately from evaluationPriorities. Listed skills guide natural comparable probes and evidence-based findings. Task success is a pass/fail gate; catastrophic failures override normal rankings. Then the explicit scenario priority governs preference. Missing skill coverage is recorded as uncertainty, not an invented model failure. With no stated ordering, comparison defaults to Utility > Naturalness/Engagement > Audio Quality. No new setup form or settings were added.
