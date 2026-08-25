# Backlog — Renegades Draft Central (2026 rebuild)

Prioritized improvement backlog. Audited 2026-08-26 against `feature/draft-central-work`.
Effort: S (< half day), M (~1 day), L (multi-day). Priority is opinionated toward
"draft night works flawlessly for 10 mates" over speculative features.

Context: 2025's systemic failures (client-side draft rules, no seasons, permissive RLS)
are largely FIXED in this rebuild — server-authoritative RPCs (`make_pick`, `undo_last_pick`,
`trade_pick`, `swap_picks`, keeper flow), a `seasons` table, read-only RLS with RPC-only
writes, single realtime layer invalidating TanStack Query, offline pick queue.
The backlog below covers what remains.

---

## P0 — Draft-night critical

### 1. Team-scoped pick controls in the UI ⭐ ready to delegate
- **Why:** `make_pick` RPC validates turns server-side, but every user still sees "Draft"
  buttons on any open pick; clicking gives an error toast instead of hiding the control.
  Confusing on draft night.
- **Builds on:** `useProfile` + `teams.team_id` on profiles; `make_pick` turn logic in
  `20260825000003_functions.sql`; DraftPage pick mutation wiring.
- **Spec:** Compute "my team id" from profile; derive current-pick team from
  `draft_settings.draft_order` + picks count (snake). Expose `canPickNow` from a small hook;
  pass to pool/board so only the on-clock team sees enabled pick buttons. Everyone else sees
  "On the clock: <Team>" read-only.
- **Effort:** M · **Risk:** Low — pure UI gating, server already enforces truth.

### 2. Undo affordance visible to everyone (not just admin) ⭐ ready to delegate
- **Why:** Misclicks happen; today only the admin page reaches `undo_last_pick`. A 60-second
  "Undo last pick" button on the Draft page after *any* pick (admin-or-last-picker) removes
  the "find the admin" stall.
- **Builds on:** existing `useUndoLastPick` mutation in `src/api/mutations.ts`; RPC exists.
- **Spec:** Show undo button when `draft_picks.length > 0` and draft status is `in_progress`;
  gate visibility to admin OR the team that made the last pick; confirm dialog before firing.
- **Effort:** S · **Risk:** Low. Consider tightening the RPC later to a time window if abused.

### 3. Realtime connection status indicator ⭐ ready to delegate
- **Why:** The whole board depends on the single `draft-${seasonId}` channel
  (`src/api/realtime.ts`). If it silently drops, users see stale boards and double-pick
  errors feel like bugs. Need visible connected/reconnecting state.
- **Builds on:** `useDraftRealtime`; Supabase channel `subscribe((status) => …)` callback.
- **Spec:** Capture subscribe status into a zustand store (pattern already used by
  `offlineQueue.ts`); render a small dot/banner on DraftPage ("Live" / "Reconnecting…").
  Also invalidate all season keys on `SUBSCRIBED` re-entry to heal missed events.
- **Effort:** S · **Risk:** Low.

### 4. Draft board mobile layout ⭐ ready to delegate
- **Why:** The draft happens in a lounge with phones out. Board must be readable/scannable
  at 390px. Current desktop table doesn't survive narrow screens.
- **Builds on:** `MobileTable` pattern from feature `shared/` folders; existing
  `use-mobile` hook; PickClock component styling.
- **Spec:** On `<md`: rounds become vertical list of picks grouped by round, sticky
  on-clock banner top. No new deps — Tailwind responsive classes only.
- **Effort:** M · **Risk:** Low, additive CSS/layout.

### 5. End-to-end test for the core pick flow ⭐ ready to delegate
- **Why:** Zero tests cover making a pick / wrong-turn rejection / undo. This is THE domain
  action; regressions here ruin draft night and nothing catches them.
- **Builds on:** existing Vitest+RTL setup; mock pattern in `src/api/mutations.test.tsx`
  (supabase rpc mocks already established there).
- **Spec:** Test `useMakePick` success → invalidation of qk keys; network error → queued via
  `queuePick`; RPC rejection → toast, not queued; `undo_last_pick` happy path. Reuse the
  supabase mock helpers from mutations.test.tsx rather than inventing new ones.
- **Effort:** M · **Risk:** None.

## P1 — Pre-draft ops

### 6. Deploy + auth-gate `sync-keepers` edge function
- **Why:** Function written but marked "DEPLOYMENT PENDING"; it performs Mgmt-API SQL writes,
  must verify caller JWT/admin before deploy. Until deployed, keeper sync is a local script
  run from a laptop.
- **Builds on:** `supabase/functions/sync-keepers/index.ts`; `_shared` auth helpers pattern
  from invite-user/admin-actions era.
- **Effort:** S · **Risk:** Medium — it's a privileged function; gate on admin JWT or keep
  invoke-only-via-dashboard with secret check.

### 7. Season reset runbook (2027 non-destructive rollover)
- **Why:** Seasons are modeled now but there's no documented/scripted path to open 2027:
  create season row, carry keepers, re-import players, regenerate snake picks. Doing this
  ad-hoc at 11pm next October is how data gets destroyed.
- **Builds on:** `create_season` RPC, `finalize_keepers`, import scripts.
- **Effort:** M · **Risk:** Data-loss risk if rushed; that's why it's documented early.

### 8. Idempotent player import + populate `player_seasons` stats
- **Why:** Pool query prefers active-season stats but imports historically skipped stat rows;
  missing stats degrade the stats dialog just shipped. Import should upsert (never wipe) and
  always write `player_seasons(season_id, stats)`.
- **Builds on:** `scripts/import-*` pipeline (do not touch while other workers own scripts/;
  schedule after), `player_seasons` schema.
- **Effort:** M · **Risk:** Medium — touches live player table; run against staging ref first.

### 9. Onboarding: claim-team link + status page
- **Why:** New mates need an invite → login → see "you're on Team X, waiting for draft" path
  without admin hand-holding. Current onboarding context exists but flow is thin
  (`OnboardingPage.tsx` is 68 lines).
- **Builds on:** `claim_team` RPC, `OnboardingContext`, ProtectedRoute.
- **Spec:** Invite URL carries `?team=<id>`; post-login page shows claimed team, keeper
  count, draft date; unclaimed users get a pick-your-team list of unclaimed teams.
- **Effort:** M · **Risk:** Low.

### 10. Rosters page polish: trade/keeper provenance badges
- **Why:** `rosters.acquisition` enum (draft/keeper/trade) already stores how each player
  arrived; rosters page renders none of it. Free information, real league-chat value.
- **Builds on:** `RostersPage.tsx`, `RosterEntry` type.
- **Effort:** S · **Risk:** None.

## P2 — Hygiene & robustness

### 11. Delete dead code sweep
- **Why:** Audit listed ~900 abandoned lines + ~30 unused shadcn components + root
  `integrations/` duplicate + mockData. Some was pruned pre-rebuild (wipe_public.sql suggests
  fresh start); do a final sweep: knip or manual grep for unreferenced files, delete.
  Smaller bundle, fewer decoys.
- **Builds on:** everything; purely subtractive.
- **Effort:** S–M · **Risk:** Low if verified by build + grep.

### 12. Consolidate type sources to one generated file
- **Why:** Generated `types.ts` vs `src/api/types.ts` hand mirrors will drift as migrations
  land (they already have). Regenerate Supabase types in CI or a script; keep hand types only
  for view-shapes (e.g. `PlayerWithStats`).
- **Effort:** M · **Risk:** Low; mechanical.

### 13. ErrorBoundary coverage on every route
- **Why:** One `ErrorBoundary` component + tests exist; ensure App.tsx wraps each route
  (especially Draft) so a render crash shows a reload card instead of white-screen on
  draft night.
- **Builds on:** `src/components/ErrorBoundary.tsx`, `src/App.tsx` route table.
- **Effort:** S · **Risk:** None.

### 14. Offline queue persistence + stale-guard
- **Why:** Queue lives in zustand memory only; refresh loses queued picks. Persist to
  localStorage and drop entries older than ~10 min (a stale queued pick is worse than a
  lost one — the moment has passed).
- **Builds on:** `offlineQueue.ts` (105 lines, easy extension); zustand persist middleware
  already available? (check zustand version — vanilla `JSON.stringify` to localStorage is
  fine too).
- **Effort:** S · **Risk:** Low.

### 15. Admin action audit log table
- **Why:** `reset_draft`, `undo_last_pick`, finalize_keepers are destructive one-click ops
  among 10 users. An `admin_log(action, actor, payload, at)` row appended inside each
  SECURITY DEFINER fn gives post-hoc "who did what" without changing any UI behavior.
- **Builds on:** all RPC migrations; one shared insert line per function.
- **Effort:** M · **Risk:** Low.

### 16. Lint zero-warnings gate
- **Why:** Outstanding ESLint warnings hide new ones. Fix or `// eslint-disable` with reason,
  then make CI/pre-push run `lint && test:run && build`. TS-error hygiene worker is adjacent —
  coordinate.
- **Effort:** S · **Risk:** None.

### 17. Swap the two remaining toast/UI duplicates
- **Why:** 2025 audit flagged dual toast systems and dual responsive hooks; verify the rebuild
  actually kept only sonner + one use-mobile, delete stragglers if found.
- **Effort:** S · **Risk:** None. (Verify first — may already be done.)

## P3 — Nice-to-have (post-draft)

### 18. League analysis page v2
- **Why:** Fun between-season content: standings simulation from rosters, keeper value vs
  ESPN ADP, trade history timeline. High delight, zero draft-night urgency.
- **Builds on:** `rosters`, `draft_picks`, `player_seasons.stats`; old LeagueAnalysis concepts.
- **Effort:** L · **Risk:** Scope creep; timebox.

### 19. Draft clock w/ pause (if league ever wants timed draft)
- **Why:** PickClock component exists with tests; slow-draft decision removed urgency. Keep in
  reserve — enabling it is settings-driven if the group changes format.
- **Effort:** M · **Risk:** None while dormant.

### 20. PWA install + push "you're on the clock"
- **Why:** Delight for remote/hybrid drafts. Web-push via Supabase edge fn on turn change.
  Speculative until the league actually drafts remotely — defer.
- **Effort:** L · **Risk:** Complexity; explicitly YAGNI for an in-person draft.

---

## Delegation notes

Top-5 "ready to delegate" items (#1–#5) are spec'd above to start-from-doc-alone. All five
touch only `src/pages/DraftPage.tsx` wiring, `src/api/*`, and new colocated test files —
coordinate sequencing since other workers currently own AdminPage, PlayerPoolPage, admin/*
and player/* components. None require migration changes except #8/#15 (P1/P2).

**Suggested order tonight:** #5 (tests first, they lock behavior) → #3 → #2 → #1 → #4.
