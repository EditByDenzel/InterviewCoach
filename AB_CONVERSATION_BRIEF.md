# Coachie scenario A/B conversation brief

Updated 11 October 2026. Core A/B code is implemented; the user selected completed-reply transcription. Listening auditions and physical-device acceptance remain unverified. See AB_IMPLEMENTATION_PLAN.md for source mapping and delivery status.

## Confirmed intent

- Coachie plays the tasker asking another assistant questions and following up, not an interviewer grading the user.
- Coachie runs on a phone; the models play audio on a computer. iPhone and Android are equally important.
- A topic or photo opens the original chat directly. Use saved preferences and interpret project instructions in the background; no scenario form or required personal goal.
- Thai-selected sessions speak and record Thai. Original Thai remains background context/evidence; both speakers' primary chat text is English.
- Offer ordinary adult Thai, English and Nigerian English character directions in their twenties/thirties. Keep one profile fixed across A/B. Nigerian English does not automatically mean Pidgin.
- Preserve automatic listening plus manual capture, stop, pause and replay.
- Keep A and B visible in one chat with a Model B divider and explicit Start Model B.
- Compare only after both runs; evidence-based recommendation is essential and the user retains the final vote.
- Saved recordings, source/English transcripts and comparisons remain until explicit deletion. Storage is local, not cloud backup.

## Duration and fairness

Five questions per model was an initial guess, not the policy. Use the accepted scenario's duration and optional minimum exchanges. The screenshot showed a 1–5 minute example; the private reference also includes a scenario requiring 15+ turns, not a 15-minute duration. Read each scenario's distinct time and turn requirements instead of imposing one global rule. Maximum duration takes precedence over an unmet optional minimum. Explicit early completion remains possible.

Both runs share opener, character and goals. Follow-ups may adapt to actual replies while preserving comparable depth, energy and coverage. Do not repeat an answered question or invent constraints to favor a model. The comparison should explain differences in coverage or duration.

B has fresh reasoning history despite sharing the visible chat. Only fixed scenario facts and safe context-independent tasker clips may cross between runs; A's answers and interim assessments must not become B's facts.

## Implemented core flow

1. Send a topic or photo from Home; the original chat opens immediately.
2. Prepare photo instructions in the background and use saved voice/language preferences.
3. Start A automatically, preserving the original cards, gradient mic, footer and buttons.
4. Record completed replies, retain original source text and show English transcripts.
5. Finish A using its header pill, switch the computer model and start B below its divider.
6. Compare after both runs and choose an independent vote.

Legacy interviews remain separately readable. The new screen/store do not turn old interviews into fabricated A/B comparisons.

## English display and completed-reply transcription

Speech and display languages are independent. TTS receives the original selected-language wording, not the English translation. Translation failures retain audio and completed source text while showing an English recovery state.

The selected pipeline records the whole reply and stops. Follow-up reasoning from the original recording runs alongside source transcription; English translation follows transcription. The prepared decision is accepted only for that finalized reply and current run, with complete valid run history; failures fall back to transcript-based reasoning. Final comparison uses both runs. The user confirmed live captions are unnecessary for this release; live transcription is optional future work. The interface states that transcripts appear after each reply.

## Speech reuse and character auditions

The normal next-turn decision can select a delivered, scenario-only tasker clip or new wording. Validate reuse against the original stored turn and active history. Exact source text, language, voice, style, model and encoding define cache identity.

A stored shared opener needs no second wording/TTS request. Adaptive follow-ups still require reasoning; transcription and translation still cost requests. No savings percentage has been measured. Generate a complete revised utterance rather than splicing fragments.

Character profiles are audition candidates, not verified accent/naturalness claims. Final selection requires user listening and fluent Thai/Nigerian English review using equivalent scripts. Ordinary pacing and context-sensitive phrasing matter more than automatic hesitation or laughter.

## Essential final comparison

Task success comes first, followed by constraints, relevance, observable factual support, naturalness and available original model audio. Findings cite delivered turns. Missing capture is a limitation, not proof of model failure; either run without finalized replies means insufficient evidence.

Coachie's synthesized voice cannot establish evaluated-model vocal quality. A spoken search claim is not verified tool use. The current assessment does not independently fact-check replies and retains that limitation. The user's vote stays separate from the recommendation.

## Reference and verification boundary

The reviewed private Live S2S reference prohibits AI-authored prompts/evaluations and requires headphones for its own platform. Coachie is an independent practice/evaluation app, not a claimed compliant integration. Do not publish the private reference or personal source paths.

Automated checks cover domain transitions, isolation, validation, storage, provider failures and audio lifecycle. They do not establish fluent translation, convincing accents, real model quality or phone/computer acoustic reliability. Physical iOS and Android tests remain, including quiet/short replies, delays, within-answer pauses, echo, interruptions, permissions, storage pressure and reload.

Optional later decisions include blind versus visible recommendations, auditioned voice selection and independently grounded verification. Device arrangement, English display, retention and scenario-based duration are already confirmed.

## Capture recovery and evaluation precedence (12 October 2026)

When a finalized recording has no intelligible speech, ask for a repeat in the selected language and resume listening. Retain the capture as an issue, never fabricate an answer. Recovery utterances and no-speech audio are excluded from scoring and do not satisfy minimum reply counts. Technical missing speech is not a model failure. Save each semantic conversation change, including comparison before the optional vote.

Skills tested specify which abilities to probe and assess. Scenario priority orders their resulting utility, naturalness/engagement and audio evidence when choosing a preference. Task success is a pass/fail gate, and catastrophic failures override normal ranking. Preserve explicit imported skill names and priority ordering separately; do not turn them into a setup form or a checklist conversation. Missing evidence or uneven coverage requires uncertainty, not an invented penalty.

Background timing stages, outbox behavior, backend JSONL storage and verification are documented in CONVERSATION_TIMING.md. Historical generation latencies remain unknown.
