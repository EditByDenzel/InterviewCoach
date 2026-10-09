# Coachie UI review — 9 October 2026

Reviewed using better-ui/accessibility/typography and Emil design engineering
guidance. Responsive form sizing guidance informed the bounded composer.

| Before | After | Why |
| --- | --- | --- |
| Large separate Start conversation button | Growing topic composer with inline send | Topic entry and submission form one interaction |
| Mirror text wrapped differently from the textarea; native focus border and scrollbar | Actual textarea measurement, outer focus ring, native chrome removed | Long words, newlines, paste, growth and shrink match the real field |
| Static navigation and controls | 240ms screen entrance, 260ms drawer, 120ms press, fine-pointer hover | Clear response without long waits; motion can be interrupted |
| Simulated 9:41/signal/battery/home chrome | Actual app content and safe areas | Device chrome belongs to the operating system |
| Hamburger had no saved history | Modal recent-conversation drawer and persisted transcript viewer | Reopen completed or interrupted practice after reload |
| Short waveform clustered at the left | Bar count adapts to the remaining row width | Audio control makes full use of narrow and wide layouts |
| Static bars/dots and mic | Playback/transcription bars, loading dots, breathing halo | Feedback follows the operation; paused/disabled mic stops breathing |
| Small chevron transcript control | 44px arrow-A transcription action and 200ms reveal | Recognizable control and clear expanded state |
| Preset waveform color fraction | Progress from expo-av position/duration | Orange progress represents actual playback |
| Six voices and no Thai | Thai plus 30 searchable Gemini studio voices, fixed Save footer | Supported choices stay easy to find and save |

Verified in the browser fixture at 320px and 390px: empty/expanded composer,
unbroken input up to 900 characters, seven-line growth cap with no horizontal
overflow, shrinking after clearing, Enter send/Shift+Enter newline, waveform
last bar aligned with its container edge, transcription loading bubble, transcript
collapse/expand, replay UI, recording pause/resume, and all five answers reaching
Summary. Mic halo opacity/scale changed between observations. Thai and Puck
selection/save, sidebar, Escape close, and saved completed/unfinished transcripts
reopening after reload were inspected. Modal semantics and hidden background were
confirmed in the DOM. The fixture uses canned text/silent audio and simulated
capture; this verifies UI/state flow, not recording quality.

Automated: 15 tests in four suites, TypeScript, web/Android/iOS export. Tests cover
playback cancellation/progress, mute, pause/resume, API payloads, settings migration,
serialized history writes and corrupt-storage preservation. Exports exclude
private .env values and fixture enablement.

Not verified: physical-device audio or screen readers, full keyboard audit,
OS text scaling/reduced-motion behavior, live provider access/Thai speech quality,
or measured frame rates/10% animation playback. Reduced-motion handling is
implemented for web/native, with loops cleaned up on unmount.
