# A/B acceptance specifications and executable coverage

ab-session.feature has **no Gherkin step bindings** and is not discovered by Jest. Do not count its scenarios as passing automated tests. Some behavior has executable unit coverage below; other cases require renderer/browser, fluent-listener or physical-device verification.

| Specification area | Current executable files | Boundary |
|---|---|---|
| Scenario fields, uncertainty and untrusted image data | tests/scenarioImport.test.ts | Mocked responses, not measured OCR fidelity |
| Camera/library cancellation and permissions | tests/scenarioImagePicker.test.ts | Adapter tests, not a real camera |
| Lifecycle, duration, idempotency, isolation, cache identity and vote | tests/abSession.test.ts | Pure domain, not UI event ordering |
| Tasker policy, source/English text, safe reuse, evidence and abstention | tests/abConversationService.test.ts | Mocked provider, not translation/judge quality |
| Deadlines, multipart response, truncation | tests/geminiReliability.test.ts; tests/geminiService.test.ts; tests/geminiContext.test.ts | Dummy keys and mocked network |
| Recording callback ownership, pause/resume and disposal | tests/recordingSession.test.ts | Fake adapters, not acoustic/OS guarantees |
| Audio cleanup/browser lifecycle | tests/audioService.test.ts; tests/audioWebLifecycle.test.ts | Controlled audio/runtime mocks |
| Durable native/browser asset adapters | tests/audioAssetStore.test.ts; tests/audioAssetWeb.test.ts | Adapter tests, not real storage pressure or eviction |
| Pending replies, retention, shared deletion and corruption | tests/abSessionStore.test.ts | Serialized local storage |
| A/B screen recovery, replay, background, ownership and stage-specific saves | tests/abSessionScreen.test.ts | Actual screen rendering with mocked hardware/provider/storage boundaries |
| Legacy history/preferences | tests/conversationStore.test.ts; tests/settingsStore.test.ts | Legacy data remains separate from A/B |

Screen retry boundaries and renderer/browser fixture coverage are tracked with implementation. Record actual commands/results after changes settle rather than inferring a complete end-to-end pass from this table.

Tags:

- @unit: deterministic domain/service/store/controller behavior.
- @ui: renderer/browser interaction through the explicit no-network fixture.
- @device: physical iOS **and** Android phones, with model audio played on a computer.
- @listening: fluent-listener/user assessment using real source audio.
- @pending-streaming: live PCM/concurrent transcription not yet implemented.
- @regression: existing design/interaction to preserve.

Run executable checks from the project root:

    npm test -- --runInBand
    npx tsc --noEmit

Duration follows each scenario and optional minimum exchanges, not a universal five questions. Evidence remains until deletion, subject to app removal or browser/OS clearing of local storage. No remote backup is implied.

Use synthetic images/audio and dummy keys. Keep private screenshots, recordings and the PDF outside the repository. The external reference prohibits AI-authored prompts/evaluations and requires headphones; independent Coachie tests are not evidence of integration or compliance.

Outstanding physical acceptance includes capture/camera behavior, voice auditions, translation fidelity, provider latency and blinded comparison-quality review. Partial-caption/streaming cases are optional future specifications: the user selected completed-reply transcription for this release.
