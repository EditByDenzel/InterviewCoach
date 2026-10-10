# Coachie A/B implementation plan and delivery status

Updated 10 October 2026. Core independent A/B practice code is implemented. The user selected transcription after each completed reply; live captions are optional future work. Listening auditions and physical-device acceptance remain unverified. This document distinguishes code and mocked checks from actual device/provider results.

## Confirmed product decisions

Coachie runs on a phone and acts as the tasker. The evaluated models speak from a computer, captured through the phone microphone. iPhone and Android have equal priority. This is acoustic capture, not access to computer system audio.

Start from a typed topic/scenario or camera photo/screenshot. Review the extracted scenario in English before starting. The title alone is insufficient: role, objective, facts, constraints, speaking language, duration, optional minimum exchanges, search requirement and ordered evaluation priorities matter. Website navigation, general platform instructions and microphone errors are not scenario facts. Unreadable details remain uncertain.

When Thai is selected, tasker speech and original model recordings stay Thai; English translations are the primary visible conversation. Original source text stays in background context/evidence. English and Nigerian English are also supported character directions. Nigerian English does not mean Pidgin.

Five questions each was an initial estimate, not the final policy. Use each accepted scenario's duration and optional explicit minimum exchanges. The screenshot's example was 1–5 minutes; the reviewed private reference also contains a scenario requiring 15+ turns, not a 15-minute duration. Neither a time limit nor a turn minimum should be generalized across scenarios. Maximum duration takes precedence over optional minimum exchanges; manual early completion remains explicit. Replay and capture retries do not create accepted replies.

Use the same scenario, character and opener for both runs, with comparable objectives, energy, depth and duration. Follow-ups adapt to actual answers. Model B starts explicitly below a divider in the same chat but has independent reasoning history. Comparison and the user's final vote follow both runs.

## External-reference boundary

The reviewed private Live S2S reference clarifies comparison principles and scenario-specific constraints. Its platform instructions prohibit AI-authored prompts/evaluations and require headphones. Coachie is an independent practice/evaluation workflow, not an integration with that platform and not a claimed compliant way to perform its tasks. Headphone-only computer output cannot be acoustically captured by the phone. Do not publish the private PDF, screenshot, recordings or personal file paths.

## Implemented source map

| Area | Source | Current core |
|---|---|---|
| Scenario import/review | src/screens/ScenarioScreen.tsx; src/services/scenarioImportService.ts; src/services/scenarioImagePicker.ts | Typed/photo input, camera/library adapter, structured extraction, allowlist validation, editable English review and uncertainty |
| Domain | src/domain/abSession.ts | Scenario/persona snapshot, A/B lifecycle, stable turn IDs, idempotent acceptance, separate contexts, duration rules, exact synthesis cache identity, comparison/vote |
| Dialogue/translation | src/services/abConversationService.ts | Tasker behavior, active-run context, original/English text, validated reusable clips and evidence-linked comparison |
| Provider boundary | src/services/geminiService.ts | Request/body deadlines, multipart text, truncation detection, expanded transcription budget, selected-voice/style synthesis |
| Capture lifecycle | src/services/recordingSession.ts; src/services/audioService.ts | Current-state callbacks, hybrid controls, pause/resume, late-start cleanup; no unconditional eight-second answer cutoff |
| Durable evidence | src/store/audioAssetStore.ts; src/store/abSessionStore.ts | Native document files/browser IndexedDB, serialized metadata, pending replies and reference-aware deletion |
| A/B interface | src/screens/ABSessionScreen.tsx | English-visible A/B chat, explicit switch, shared opener, retained replies, comparison and independent vote |
| Character directions | src/domain/personas.ts | Adult Thai, English and Nigerian English voice/style candidates |
| Legacy compatibility | Existing interview/history screens and stores | Old interviews remain separate and readable; no fabricated Model B |

Renderer checks cover stage-specific saves, audio ownership, translation recovery, pause/replay, backgrounding and late permissions. Browser fixtures cover both runs, comparison/vote, reload/reopen, replay and deletion at 320/390 widths. A source listing is not proof of physical-device reliability.

## State and recovery

Session lifecycle: ready_a -> active_a -> waiting_b -> active_b -> comparing -> completed. Each turn carries original wording, English translation, audio reference and delivery metadata. pendingReply retains captured audio and any completed source transcription while translation or saving is retried.

Unplayed tasker text must not enter model context or evaluation. Replay does not append a turn. Retry resumes the failed stage rather than resubmitting an accepted answer, generating a second question, or treating interrupted playback as complete. Persist at captured-reply, accepted-turn, A/B-switch, comparison and vote boundaries.

Recordings and transcripts remain until explicit deletion; there is no automatic age-based eviction. Native files and browser IndexedDB are local storage, not cloud backup. App removal, browser storage clearing or OS eviction may still remove data.

Delete only the session's unshared assets. Keep another session's referenced clips. Deletion is retryable and idempotent; corrupt metadata is reported and preserved, not silently filtered away.

## Dialogue, reuse and character quality

The tasker uses fixed scenario facts plus the active run, answers clarifications consistently and asks brief relevant follow-ups. It does not grade a candidate or announce a winner mid-conversation. Equivalent adaptive probes take priority over redundant scripts or invented turn budgets.

The normal dialogue decision selects new wording or a safe delivered scenario-only utterance. Validate its original stored identity and reject duplicate IDs, unsafe cross-run wording and already-used questions. Exact source text, language, voice, delivery style, model and encoding form cache identity. Reuse complete utterances. A present shared opener avoids another wording/TTS request; transcription, translation and adaptive decisions still incur requests. No measured savings percentage is claimed.

Characters in their twenties/thirties are audition directions, not verified perceived ages or accents. Keep the selected profile fixed across the pair. Audition identical opener, clarification and follow-up scripts with fluent Thai/Nigerian English listeners; tune ordinary pacing, stress and register without forced filler. Custom voice design and final voice choices remain follow-up work.

## Evaluation boundaries

Compare only after both runs end. Use delivered turn evidence, original and translated text, elapsed time, scenario priorities and available original model audio. Task success precedes softer dimensions. Findings cite known delivered turn IDs. If either run lacks finalized model replies, return insufficient evidence.

Missing/corrupt audio is a limitation, not a model failure. Coachie's speech cannot establish model vocal quality. Spoken search claims do not prove tool use; current evaluation does not independently fact-check replies. A separate grounded verification pass remains future work. Recommendation and user vote remain independent.

## Delivery stages

| Stage | Status and remaining exit criteria |
|---|---|
| 0 — Baseline/reference review | Device arrangement and equal OS priority confirmed; physical acoustic baseline outstanding |
| 1 — Domain/storage | Implemented with deterministic domain/store and screen save/retry checks |
| 2 — Topic/camera | Extraction, picker and English review implemented; real permissions, orientation, glare, diacritics and Android activity recreation outstanding |
| 3 — Bilingual tasker | Core and mocked contracts implemented; fluent-language and live-provider results unverified |
| 4 — Audio and completed-reply transcription | Selected flow implemented: capture -> stop -> source transcription -> English translation -> follow-up. Live captions are optional future work |
| 5 — A/B interface/recovery | Separate A/B screen implemented, legacy preserved; renderer/fixture retry, reload and model-boundary checks passed |
| 6 — Reuse/voice | Cache identity, opener reuse and safe follow-up selection implemented. **Listening auditions, accent fidelity and measured savings unverified** |
| 7 — Comparison | Evidence references, abstention and independent vote implemented; grounded verification and blinded judge review outstanding |
| 8 — Release validation | Automated checks available. **Physical iOS and Android tests outstanding**, including real latency, acoustic echo and OS interruptions |

### Optional future live captions

Only if later requested, establish a supported incremental audio path on each platform. Use decodable PCM or documented complete segments with sequence IDs/timestamps, not arbitrary compressed M4A/WebM byte slices. Retain a durable final recording while incremental transcription and English translation run. Reconcile partial revisions against finalized source text; partial captions must never trigger extra replies or follow-ups.

Prototype reconnect, backpressure, out-of-order revisions, gaps, Thai-to-English fidelity and background/foreground behavior. Identify model, transport, credentials and billing changes before adopting another service. Keep manual completion and visibly label whole-recording fallback. The selected release flow deliberately waits for completed replies, preserving full accepted context for follow-ups and final judging.

### Stage 8 physical matrix

Test both phone platforms against computer playback: short/quiet replies, delayed starts, mid-answer pauses, noise, echo, permission denial, screen lock, calls/audio interruptions, pause/replay/resume, network loss, storage pressure, deletion and reload. Use synthetic camera scenarios before private references.

Measure final-transcript delay, reply-to-Coachie-audio delay, missed speech, cutoffs, retries, stored bytes and provider requests. Record actual device/model/build results separately from silent fixtures or mocked responses. No latency or naturalness claim follows from unit tests.

## Verification

Run npm test -- --runInBand and npx tsc --noEmit. Release counts/results are recorded in CHANGELOG.md after final checks.

tests/acceptance/README.md maps specifications to executable test files. The .feature file has no Gherkin bindings and is not an extra passing suite. Streaming cases are optional future specifications; fluent-listener and physical-device validation remain pending. Use synthetic inputs and dummy credentials; never commit private media, keys or the reference PDF.

Further research links remain in VOICE_CONVERSATION_RESEARCH.md; they are not evidence of current device/provider verification.
