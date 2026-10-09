# InterviewCoach agent context

Read `PROJECT_CONTEXT.md`, `GEMINI.md`, `PLAN.md`, `CHANGELOG.md`, and
`ARCHITECTURE.md` before making changes. Check the actual source when older
documents disagree with it.

- Work in the original InterviewCoach folder. GitHub is the shared source of
  truth; do not maintain a second folder by manually copying files.
- Preserve the existing five-round flow, models, voices, dark theme, and settings
  behavior unless the user requests a change.
- Never commit API keys, `.env`, recordings, dependencies, or generated bundles.
- Run `npm test -- --runInBand` and `npx tsc --noEmit` before committing.
- Inspect Git status first and preserve unrelated or concurrent work. Pull with
  `git pull --ff-only`; resolve divergence deliberately and never force-push.
- Update project documentation with material decisions and verified findings.
  Distinguish automated checks from real-device and live API verification.

