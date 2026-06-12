# Orchestration notes

Self-tuning log for agent orchestration in this repo (referenced by CLAUDE.md).
Add observations that change how future runs should be orchestrated.

## 2026-06-12 — Scrollytelling landing/auth rebuild (interactive session)

- Split worked well: 2-agent recon workflow (code-scout/Haiku for structure map,
  code-analyst/Sonnet for feature inventory) ran in background (~190k subagent
  tokens) while the orchestrator studied the 17 reference screenshots itself.
  Visual/design judgment does not delegate well — keep image review in the
  orchestrator; delegate codebase mapping.
- Creative single-artifact implementation (one coherent animation timeline) is
  faster done by the orchestrator than split across agents — agents fragment a
  GSAP timeline's choreography. Delegate audits, not authorship, for this kind
  of work.
- Verification without a backend: local Postgres is NOT available, so the Flask
  app can't run locally (psycopg2 connect refused). Verify auth UI flows with
  Playwright route mocking (`page.route('**/api/auth/signin', ...)`) instead of
  standing up a database. Playwright lives in a scratch dir (/tmp/ss-playwright)
  so frontend/package.json stays clean for Render builds.
- vitest: 3 failures in src/utils/format.test.ts are PRE-EXISTING on clean main
  (timezone-sensitive date assertions, e.g. '2024-01-15' parsed as UTC). Don't
  burn cycles re-diagnosing; a nightly sweep should pin the test timezone
  (TZ=UTC in the vitest script) or parse dates as local.
- Screenshots/ at repo root is user-provided design reference material; it is
  now gitignored so `git add -A` deploys never swallow it.
