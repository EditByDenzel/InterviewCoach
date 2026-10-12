# Phone access and PC history

Phone testing, 2026-10-12: an email-protected Cloudflare Quick Tunnel now exposes a production web build connected to the existing PC backend. The VPS is unchanged. Physical iPhone/Android audio tests remain outstanding.

## Current test access

The exported app lives in ignored artifacts/phone/web. backend/phone-gateway.mjs serves it on loopback port 8085 and proxies only the known API routes to the existing backend on 8787. A Cloudflare Quick Tunnel must always run with --allowed-mail restricting it to the owner's chosen address; do not expose the build with an unprotected tunnel. The protected build contains the owner's existing client-side account configuration and is not a public release artifact.

On the phone, open the generated HTTPS URL, enter the allowed email, complete the emailed code, and allow microphone access when using Coachie. Keep the PC awake and the backend, gateway and Cloudflare process running. The URL changes when the tunnel restarts. The app's history/custom voice/timing requests use the same HTTPS origin instead of the phone's localhost. Normal PC development stays on 8083 with its existing backend configuration.

To rebuild the protected test app with the actual account configuration and a fresh Metro cache:

```
node --env-file-if-exists=.env node_modules/expo/bin/cli export --platform web --output-dir artifacts/phone/web --clear
node backend/phone-gateway.mjs
artifacts/phone/cloudflared.exe tunnel --url http://127.0.0.1:8085 --allowed-mail <your-allowed-email> --protocol http2 --no-autoupdate
```

Local browser verification loaded the shared completed life-after-school chat and other saved history. An unauthenticated visit to the public tunnel reached Cloudflare's email login screen. This does not prove physical-phone capture or latency.

## Current state

With EXPO_PUBLIC_TTS_BACKEND_URL configured, the authenticated PC backend is authoritative for A/B sessions, legacy conversations, deleted samples and immutable recordings. Durable files are in backend/private/history; timing timelines remain in backend/private/conversation-timings. New chat metadata and audio are not stored in browser history. The design fixture and unconfigured installations retain the original device-only adapter.

On first history load, old browser/device sessions are imported without overwriting existing backend records or restoring backend-deleted IDs. Referenced recordings are copied before importing the session. Original device stores are preserved as migration backups, not replayed as live updates. Open or refresh each browser containing actual historical chats to migrate it; another browser cannot access that browser's original storage. Missing recording data stops migration rather than silently dropping evidence.

Backend revisions reject stale writes. Reopen a chat after a conflict; do not simultaneously conduct the same active session on both devices. The backend must be reachable for history reads and saves. Failed saves remain retryable in the chat; an offline conversation upload outbox is not implemented. Only timing events currently have a durable offline outbox.

The PC custom TTS backend address remains localhost. The secure phone origin resolves it to the gateway instead, so no phone request points to the phone's localhost. Same-origin HTTPS requests carry the owner bearer in X-Coachie-Authorization, separate from Cloudflare access headers; the gateway maps it to Authorization for the backend's existing validation. Normal PC/native requests retain Authorization. History identifies access-page redirects and HTTP failures. Gateway stdout contains only request categories/status/timing and authentication/tunnel presence; no content or credentials.

Web Figma icons use bundled SVG data URIs, avoiding extra protected image fetches without changing their design. A readable hostname requires a named Cloudflare Tunnel with DNS on a managed domain; Quick Tunnel hostnames are random and change on restart.

## Proposed implementation order

1. Verify the automatic migration from the browser containing the actual chats. Preserve its existing stores until migration is verified.
2. Use the current protected Cloudflare test link. Tailscale Serve remains an alternative for installed private-network clients. Do not expose the current single-owner Gemini-key authentication as a public multi-user service.
3. Test phone/PC history refresh, interrupted uploads, duplicate retries, cross-device deletion, and iPhone/Android mic permission, silence detection, playback and interruptions. Completed and unfinished sessions must load without a final vote.
4. Add a durable conversation outbox only if disconnected operation is required, with conflict handling that never overwrites newer backend revisions.

## Alternatives and latency

- A VPS provides an always-on host while the PC is off, but changes where shared history lives and still needs migration, authentication and synchronization.
- A native app offers another route for device audio integration; it still needs the same shared storage. Packaging alone does not accelerate Gemini generation.
- The current standard Gemini requests go directly to Google; custom speech goes through the PC backend. Network quality, recording upload size and provider processing affect response time. Additional proxies may add latency; no phone/VPS benchmark has been run. Keep background history synchronization off the response path and use the timing backlog to compare the same workloads before changing provider routes.

References: [microphone secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [IndexedDB origin isolation](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [private HTTPS with Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).
