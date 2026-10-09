# Coachie UI review — 9 October 2026

Reviewed using better-ui, better-accessibility, and better-typography guidance.

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH (fixed) | src/screens/HomeScreen.tsx:48 | Unlabeled microphone was the only entry action | Visible Start conversation button | An action must communicate its purpose |
| MEDIUM (fixed) | src/screens/HomeScreen.tsx:61 | Shadows clipped against the horizontal scroll and backgrounds varied with the backdrop | Clipped gradients inside each rounded card | Surfaces need consistent depth and geometry |
| MEDIUM (fixed) | src/screens/SettingsScreen.tsx:1; src/screens/SummaryScreen.tsx:1 | Older teal surfaces and controls | Shared orange palette, grouped settings and summary surfaces | Keep a coherent design system across the flow |
| MEDIUM (fixed) | src/components/SettingsDesign.tsx:26 | Intrinsic input width hid reveal controls at 320px | Shrinkable fields, visible 44px reveal buttons | Controls must remain reachable at narrow widths |
| LOW (fixed) | src/screens/InterviewScreen.tsx:188 | Small header actions | 44px close and mute buttons | Comfortable touch targets |

Verified: browser render at 390px and 320px, labels/roles through the accessibility tree, selected states, settings save/navigation, empty-key validation, close confirmation, disabled/loading interview controls, and all five typed rounds with retained answers. No browser console errors were recorded in the fixture. Three Inter weights are bundled; body copy wraps without truncation. Primary and secondary actions have distinct emphasis.

Not verified: native screen-reader operation, a full keyboard-only walkthrough, OS text scaling/reduced-motion behavior, real-device recording/pause/replay, paid provider calls, and 10% animation playback inspection. This is a scoped UI-polish review, not a full accessibility certification.

Approve for the inspected UI states. Device and assistive-technology coverage remains open.
