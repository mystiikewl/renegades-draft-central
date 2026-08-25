# Audit — 2026 Rebuild Baseline

Audited 2026-08-25 on `feature/draft-central-work` (last state: 2025 season codebase).
This is the baseline for the complete 2026 rebuild. Findings are severity-ranked; the
recommendation at the end is rebuild-vs-preserve.

---

## Executive summary

The app *worked* for 2025, but it's held together by UI convention rather than enforced rules.
The three systemic problems:

1. **Nothing enforces draft rules server-side.** Pick turn validation lives in dead client code;
   RLS lets any authenticated user update any player or draft pick; rollback RPCs have no admin
   check. The draft is "correct" only because your friends behaved.
2. **Seasons aren't modeled.** `players` carries global drafted state (`is_drafted`, `drafted_by_team_id`),
   `'2025-26'` is hardcoded in components, and `player_seasons` exists in the schema but is never
   populated. There is no non-destructive path to 2026.
3. **The codebase is mid-refactor in at least three places.** Abandoned DraftTabs service layer
   (~900 dead lines), duplicate realtime layers fetching the same data, a dead pick-confirmation
   path containing the only turn-check logic.

Plus one urgent item independent of the rebuild: **a hardcoded service-role key committed in
`scripts/import-players.js`** (JWT exp 2035) and unauthenticated edge functions.

---

## 🔴 Critical findings

### Security
- **Service-role key committed** in `scripts/import-players.js` (hardcoded JWT, expires 2035). Rotate immediately and move to env vars.
- **Edge functions unauthenticated**: `supabase/functions/invite-user` and `admin-actions` never verify caller JWT. Anyone with the URL can invite users, assign teams, or DELETE users/teams (`admin-actions` uses the service-role client). `src/pages/api/admin/invite-user.ts` explicitly skips auth ("we are proceeding with the assumption...").
- **RLS on `players`/`draft_picks` is `auth.role() = 'authenticated'`** (first migration, never tightened): any logged-in user can flip `is_drafted`, steal players, or draft for other teams.
- **`rollback_draft_picks` / `preview_draft_rollback` are SECURITY DEFINER with no admin check** — any authenticated user can wipe draft state.
- **Self-promotion to admin possible**: profiles self-UPDATE policy has no column restriction, so a user can set their own `is_admin = true`.
- **Hardcoded admin emails** (`ataha91@gmail.com` / `ataha425@gmail.com` — note: two different addresses, one likely stale) baked into RLS policies and `handle_new_user`.
- **Broken by construction**: `invite_and_assign_user_to_team(text, int)` takes `team_id int` but teams use UUIDs — the API route calling it can never work.

### Domain / data model
- **No seasons table.** Season is free-text on `keepers`/`draft_picks`/`draft_settings`; `players` has none. Drafted state is global on `players`. A 2026 reset is destructive (bulk UPDATE + delete picks) and loses 2025 rosters.
- **Draft truth split three ways**: `draft_picks.player_id/is_used`, `players.is_drafted/drafted_by_team_id`, and `keepers` — no trigger or constraint keeps them in sync; rollback functions manually juggle all three.
- **`profiles` key confusion** (`id` random uuid + `user_id` FK): code alternates between `id = auth.uid()` and `user_id = auth.uid()` depending on migration vintage — root cause of the 8+ `claim_team` fix-up migrations.

### Draft-day UX
- **The only turn-check pick path is dead code.** `handleConfirmPick` in `useDraftPageData.ts:174-282` (validates "is it your turn", optimistic updates, rollback) is never invoked. The live path (`PlayerDetailsModal.handleConfirmSelection`) only checks the user has a team.
- **No draft clock.** `pick_time_limit_seconds` exists in settings and is admin-editable, but no countdown is rendered anywhere. No pause/resume either — for an *offline in-person* draft.
- **No user-facing undo** — misclicks require finding the admin on draft day.

---

## 🟠 Major findings

### Frontend architecture
- **~900 dead/abandoned lines**: `DraftTabs-refactored.tsx`, `services/draftTabService.ts` (396), `useDraftTabService.ts`, `useRealTimeDraftTabs.ts` (309, only used for connection status — its data is fetched then discarded). Refactor plan md admits phases 5–7 never done.
- **God-hook + prop drilling**: `useDraftPageData.ts` (350 lines) composes 8+ hooks into a kitchen-sink return; `DraftTabsProps` takes ~20 props including `navigate` and `isMobile`.
- **Duplicate realtime layers**: 5 hooks + 2 subscription services doing overlapping jobs; `DraftTabs` subscribes via `useRealTimeDraftTabs` while `useDraftPageData` fetches the same data via TanStack Query — double subscriptions, double fetches.
- **Service layer not enforced**: raw `supabase.from(...)` calls scattered in hooks (`useRankingImpact` with `as any` casts, `useDraftState`, API routes) despite a well-organized `src/integrations/supabase/services/`.
- **~4,500+ lines of unused shadcn components** (~30 files incl. `sidebar.tsx` at 761 lines, the largest file in the repo); root `integrations/` directory duplicating `src/integrations/`; dead `src/data/mockData.ts`; Lovable og-image/meta still in `index.html`.
- **`ProtectedRoute` anti-pattern**: `navigate()` inside `useEffect` + renders `null` (blank frame, back-button quirks).
- **Three type sources** for the same domain: generated `types.ts`, hand-written `schema/` mirrors, `src/types/`.

### Backend
- **Migration hygiene**: duplicate timestamp `20250816003302_` (two files — nondeterministic order); `draft_settings`, `player_seasons`, `draft_picks.overall_pick` used by migrations but created via dashboard (out-of-band drift); rollback functions reference `overall_pick` which no migration creates; `is_admin` added three times; column dropped then re-added (`double_doubles`).
- **`import-players.js` is destructive and lossy**: wipes ALL players on each run (cascades → wipes keepers, nulls draft_picks); never populates `player_seasons`; skips malformed CSV rows silently; no transactionality.
- **Draft order/pick machine entirely client-side** — no server function validates "is it this team's turn".

### UX / flows
- **`canMakePick` not team-scoped** — every user sees pick controls on any open pick.
- **OnClockBanner "Make Your Pick" CTA is a no-op** (`navigate('/draft#players')` / `window.location.hash` — tabs aren't hash-driven).
- **`DraftBoard.tsx` (516 lines) has zero mobile handling** — the most important draft-day surface is desktop-only.
- **Admin fragility**: full draft reset uses `window.confirm()` and toasts success even on failure (no try/catch); `DraftPicksTrader`/`DraftRollbackManager` (433/579 lines) do direct client table writes with string-parsed inputs; "pull to refresh" = `window.location.reload()` (loses form state).
- **Onboarding**: no invite-link entry for new users (admin must invite AND assign team); keeper limit hardcoded to 9; post-claim profile read races `refreshProfile()`; redirect via `setTimeout` hack.
- **Hardcoded `'2025-26'`** in `useDraftPageData`, `OnClockBanner`, `PlayerDetailsModal`, `useLeagueAnalysisData`.
- **Offline handling is superficial**: `navigator.onLine` only; no pick queuing/retry; the Draft page has no ErrorBoundary — a render crash takes out the board on draft day.

### Tests
7 test files, essentially render-smoke coverage. **Zero tests** for: making a pick, pick conflicts, rollback, pick trading, draft order, keeper management, all realtime hooks, `useDraftPageData`. The core domain action (a pick) is untested.

---

## 🟡 Minor findings (selected)

- Duplicate ErrorBoundary ×3; two toast systems mounted simultaneously (Toaster + Sonner); two `use-toast` files; two responsive systems (`use-mobile` + `use-responsive`) with `isMobile` prop-drilled.
- Debug `console.log`s in production path (`useDraftPageData.ts:147-149` logs full player array).
- "Analytics view coming soon" placeholder in PlayerPool; `any[]`-typed visualization data.
- Conflict between two members emails as admin token; `teams.owner_email` duplicates FK relationship.
- CORS `*` on edge functions; missing `search_path` on newer SECURITY DEFINER functions.

---

## 2026 rebuild recommendation

**Keep: the domain concept, the league, the Supabase project (with fixes), and roughly the visual language. Rebuild: schema season-modeling, all draft logic as server-side RPCs, the data/realtime layer, and the Draft page.**

Suggested rebuild pillars:

1. **Security first (do before anything else, even pre-rebuild)**: rotate the service-role key, auth-gate edge functions, fix the profiles self-admin hole.
2. **Model seasons properly**: `seasons` table; drafted state moves to a per-season join (season, team, player); `player_seasons` becomes the home of stats; 2025 becomes archived read-only data, 2026 a fresh row. Idempotent player import.
3. **Server-authoritative draft**: a single `make_pick` SECURITY DEFINER RPC owning turn validation, state transitions, and clock; UI becomes a projection. Realtime invalidation through one abstraction (TanStack Query + Supabase channels), one pattern.
4. **Draft-day experience**: visible clock w/ pause, team-scoped pick controls, user-facing undo window, mobile-first draft board, ErrorBoundary + offline queue on the draft page.
5. **Clean slate frontend hygiene**: delete dead code (~30 unused ui components, mockData, refactored-tabs layer, plan mds, root `integrations/`), enforce the service layer, single type source (generated), declarative route guards, and tests around pick/rollback/trade flows from day one.
