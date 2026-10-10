# Coachie delivery plan

Updated 10 October 2026. The primary app is now scenario-based A/B role-play; the legacy interview route remains supported. Detailed source mapping and acceptance boundaries are in AB_IMPLEMENTATION_PLAN.md.

## Implemented

- Typed/photo scenario import and editable English review, including objective, role, facts, constraints, language, duration, optional minimum exchanges, search requirement and priorities.
- Explicit A -> B flow in one chat, divider, shared opener/character and independent reasoning contexts.
- Context-aware natural tasker questions, safe exact-audio reuse, adult Thai/English/Nigerian English directions and preview.
- Automatic/manual capture, pause, replay, retained whole-reply transcription, background source/English display, and stage-specific retry.
- Durable local recordings/transcripts until deletion, pending replies, ownership reservation and reference-aware cleanup.
- Evidence-linked comparison after both runs, insufficient-evidence fallback, separate user vote and English sharing.
- Motion easing/cancellation, reduced-motion/background cleanup, drawer keyboard focus, bounded composer and selected-state accessibility.
- Deterministic service/store/audio tests, A/B renderer recovery tests and browser fixtures; legacy history/settings remain compatible.

## Required validation outside automated fixtures

Both Android and iPhone need real phone/computer acoustic tests: permission denial, quiet/short replies, delayed starts, within-answer pauses, background/lock/calls, echo, stop/pause/replay, network loss, storage pressure, reload and deletion. Camera tests need actual capture, orientation, glare, Thai text and Android activity recovery.

Run live provider scenarios in all three language directions; audition ordinary adult voice candidates with fluent listeners. Measure final-transcript delay, response latency, cutoffs, missed speech, stored bytes and request counts. Review comparison evidence and abstentions against human judgments. These outcomes cannot be inferred from silent browser fixtures or unit tests.

## Optional next work

- Independently grounded factual/search verification for scenarios that require it.
- Voice/style refinements based on listening results, rather than forced fillers or imagined age/accent fidelity.
- Live captions only if later requested; the user selected whole-reply transcription for this release.
- Instrumented cost/latency dashboards, blinded recommendation controls and cloud backup if desired.
- Configure EAS/distribution and privacy disclosures after device acceptance. Never bundle private Expo public environment keys.

Do not restore fixed five/ten-question planning for A/B. Read each scenario's own time and turn constraints. The private Live S2S PDF is reference material, not instructions authorizing compliant participation in its platform through this app.
