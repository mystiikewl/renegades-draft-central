# Backlog — Renegades Draft Central

Prioritized remaining work. Updated 2026-09-02, after the draft-intelligence
suite merge (PR #20) and the legacy/2025-app cleanup. The original rebuild
backlog (P0 draft-night items) is done: team-scoped pick controls, undo for
everyone, realtime connection badge (`RealtimeBadge`), mobile draft board,
and pick-flow tests all shipped. Effort: S (< half day), M (~1 day),
L (multi-day). Priority favors "draft night works flawlessly for 10 mates."

Known-wonky right now: 18 tests fail across 5 files because their
`vi.mock('@/api/queries')` blocks predate `usePracticeDraftPool` (and friends)
— the app code is fine, the mocks are stale.

Offseason tooling note: ESPN's site-roster feed (what `import-nba.mjs` reads)
lags trades/signings. After offseason news, dry-run
`node --env-file=.env scripts/sync-player-teams.mjs` to diff every player
against ESPN's core athlete API + fantasy feed, and add `--apply` to write.
Fantasy-flagged "FA" players in its output are in-transit — watch those.

## P1 — Fix next

### 1. Repair the 18 stale-mock test failures
- **Why:** `npm run test:run` is red: DraftPage, PlayerPoolPage,
  draftFlow.integration, HubPages, SlotPickerDialog tests mock
  `@/api/queries` with explicit export lists missing newer hooks
  (`usePracticeDraftPool`, …). Until fixed, real regressions hide in the noise.
- **Effort:** S · **Risk:** None — additive mock entries + assertions.

### 2. 2027 season rollover runbook
- **Why:** Seasons are modeled and 2025-26 is archived, but there's still no
  documented/scripted path to open 2027 (create season → carry keepers →
  import players → generate snake picks). Doing it ad-hoc at 11pm in October
  is how data gets destroyed.
- **Builds on:** `create_season` RPC, `finalize_keepers`, `scripts/import-*`.
- **Effort:** M · **Risk:** Data-loss risk if rushed — that's why it's here early.

### 3. Confirm `sync-keepers` edge function is deployed + auth-gated
- **Why:** `supabase/functions/sync-keepers/` exists and package.json wires the
  local fallback, but deployment/verification status was never recorded. It
  performs privileged Mgmt-API writes — must verify caller JWT/admin before
  trusting the remote path.
- **Effort:** S · **Risk:** Medium (privileged surface).

## P2 — Hygiene & robustness

### 4. Offline pick queue persistence + stale-guard
- **Why:** The queue lives in zustand memory only; a refresh loses queued
  picks. Persist to localStorage and drop entries older than ~10 min (a stale
  queued pick is worse than a lost one).
- **Builds on:** `src/api/offlineQueue.ts` (~105 lines, easy extension).
- **Effort:** S · **Risk:** Low.

### 5. Admin action audit log
- **Why:** `reset_draft`, `undo_last_pick`, `finalize_keepers` are destructive
  one-click ops among 10 users. An `admin_log(action, actor, payload, at)`
  row appended inside each SECURITY DEFINER fn gives post-hoc "who did what."
- **Effort:** M · **Risk:** Low (one insert per RPC).

### 6. Code-split the bundle
- **Why:** Production build emits a single ~935 kB JS chunk (277 kB gzip).
  Route-level lazy imports or `manualChunks` (recharts is the heavy suspect)
  would cut first load meaningfully.
- **Effort:** S–M · **Risk:** Low.

### 7. CI/pre-push gate: `lint && test:run && build`
- **Why:** Lint on `src/` is clean (11 warnings, mostly shadcn react-refresh
  noise); tests/build are green once #1 lands. Lock it in so it stays that way.
- **Effort:** S · **Risk:** None.

### 8. Consolidate type sources
- **Why:** Generated Supabase types vs hand-mirrored `src/api/types.ts` drift
  as migrations land. Regenerate in a script; keep hand types only for
  view-shapes (e.g. `PlayerWithStats`).
- **Effort:** M · **Risk:** Low; mechanical.

### 9. Remove unreferenced public assets / dead files
- **Why:** `public/nba_player_stats_complete.csv` ships with the deployed site
  (anything in `public/` is served) and nothing references it; the root
  `integrations/supabase/services/draftService.ts` is a 162-line 2025 leftover
  no module imports. Delete both (or move the CSV into `scripts/` if the
  import pipeline still wants it).
- **Effort:** S · **Risk:** None after a grep double-check.

## P3 — Nice-to-have (post-draft)

### 10. Draft clock with pause
- **Why:** PickClock exists with tests; the league drafts untimed so it stays
  dormant and settings-driven. Revisit only if the format changes.
- **Effort:** M · **Risk:** None while dormant.

### 11. PWA install + "you're on the clock" push
- **Why:** Delight for remote/hybrid drafts; web-push via edge fn on turn
  change. Explicit YAGNI while the draft is in-person.
- **Effort:** L · **Risk:** Complexity.
