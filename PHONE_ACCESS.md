# Phone access and PC history

Recommendation, 2026-10-12: start with private HTTPS mobile web hosted on the PC, then consider native builds after physical iPhone/Android audio tests. Backend persistence is implemented; private phone networking has not been deployed.

## Current state

With EXPO_PUBLIC_TTS_BACKEND_URL configured, the authenticated PC backend is authoritative for A/B sessions, legacy conversations, deleted samples and immutable recordings. Durable files are in backend/private/history; timing timelines remain in backend/private/conversation-timings. New chat metadata and audio are not stored in browser history. The design fixture and unconfigured installations retain the original device-only adapter.

On first history load, old browser/device sessions are imported without overwriting existing backend records or restoring backend-deleted IDs. Referenced recordings are copied before importing the session. Original device stores are preserved as migration backups, not replayed as live updates. Open or refresh each browser containing actual historical chats to migrate it; another browser cannot access that browser's original storage. Missing recording data stops migration rather than silently dropping evidence.

Backend revisions reject stale writes. Reopen a chat after a conflict; do not simultaneously conduct the same active session on both devices. The backend must be reachable for history reads and saves. Failed saves remain retryable in the chat; an offline conversation upload outbox is not implemented. Only timing events currently have a durable offline outbox.

The current custom TTS backend address uses localhost. On a phone that refers to the phone, not this PC. Phone access needs a reachable HTTPS backend URL and its allowed origin configured, as well as HTTPS for the web app's microphone access.

## Proposed implementation order

1. Verify the automatic migration from the browser containing the actual chats. Preserve its existing stores until migration is verified.
2. Serve the app and backend under private HTTPS, for example with Tailscale Serve. The PC must be running. A production web build improves loading and avoids dependence on the development server. Do not expose the current single-owner Gemini-key authentication as a public multi-user service.
3. Test phone/PC history refresh, interrupted uploads, duplicate retries, cross-device deletion, and iPhone/Android mic permission, silence detection, playback and interruptions. Completed and unfinished sessions must load without a final vote.
4. Add a durable conversation outbox only if disconnected operation is required, with conflict handling that never overwrites newer backend revisions.

## Alternatives and latency

- A VPS provides an always-on host while the PC is off, but changes where shared history lives and still needs migration, authentication and synchronization.
- A native app offers another route for device audio integration; it still needs the same shared storage. Packaging alone does not accelerate Gemini generation.
- The current standard Gemini requests go directly to Google; custom speech goes through the PC backend. Network quality, recording upload size and provider processing affect response time. Additional proxies may add latency; no phone/VPS benchmark has been run. Keep background history synchronization off the response path and use the timing backlog to compare the same workloads before changing provider routes.

References: [microphone secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [IndexedDB origin isolation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [private HTTPS with Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
