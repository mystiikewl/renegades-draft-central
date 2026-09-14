# Backlog — Renegades Draft Central

Prioritized remaining work. Updated 2026-09-14, after the 2026-27 season
go-live: ESPN keeper sync + finalize landed, the duplicate-season incident
was repaired (see `scripts/sql/remove-duplicate-26-27-season.sql` and
`scripts/sql/revert-stale-proposed-trade-2026-27.sql`), and the suite is
green — 150/150 tests, clean production build. The original rebuild backlog
(P0 draft-night items) is done. Effort: S (< half day), M (~1 day),
L (multi-day). Priority favors "draft night works flawlessly for 10 mates."

Offseason tooling note: ESPN's site-roster feed (what `import-nba.mjs` reads)
lags trades/signings. After offseason news, dry-run
`node --env-file=.env scripts/sync-player-teams.mjs` to diff every player
against ESPN's core athlete API + fantasy feed, and add `--apply` to write.
Fantasy-flagged "FA" players in its output are in-transit — watch those.

## P1 — Fix next

### 1. Guard `create_season` against duplicate/near-duplicate labels
- **Why:** Root cause of the 2026-09-14 incident: a hand-typed label
  ("Season 26-27" vs "2026-27") created a twin season that stole
  `is_active`, while every script addresses seasons by exact label — the
  app went blind to the real season's keepers/pool. Refuse when an active
  pre_draft season exists, and/or enforce the `YYYY-YY` label format.
- **Effort:** S · **Risk:** Low.

### 2. 2027 season rollover runbook
- **Why:** Seasons are modeled and 2025-26 is archived, but there's still no
  documented/scripted path to open 2027 (create season → carry keepers →
  import players → generate picks). Doing it ad-hoc at 11pm in October
  is how data gets destroyed.
- **Builds on:** `create_season` RPC, `finalize_keepers`, `scripts/import-*`.
- **Note:** the 26-27 near-miss (twin season, lost pick ownership, stale
  proposal resurrected onto the board) is the cautionary tale — the repair
  SQL in `scripts/sql/` doubles as a checklist of what can silently
  diverge. If the "Keeper-deadline ceremony" vision item ships, the app
  itself becomes this runbook.
- **Effort:** M · **Risk:** Data-loss risk if rushed — that's why it's here early.

### 3. Confirm `sync-keepers` edge function is deployed + auth-gated
- **Why:** `supabase/functions/sync-keepers/` exists and package.json wires the
  local fallback, but deployment/verification status was never recorded. It
  performs privileged Mgmt-API writes — must verify caller JWT/admin before
  trusting the remote path. Also: unlike the Node script, the edge port
  lacks the upcoming-season keeper inference — keep their semantics in
  sync or delete one path.
- **Effort:** S · **Risk:** Medium (privileged surface).

## P2 — Hygiene & robustness

### 4. Offline pick queue persistence + stale-guard
- **Why:** The queue lives in zustand memory only; a refresh loses queued
  picks. Persist to localStorage and drop entries older than ~10 min (a stale
  queued pick is worse than a lost one).
- **Builds on:** `src/api/offlineQueue.ts` (~105 lines, easy extension).
  First half of the "Offline-first drafting" vision item — do them together.
- **Effort:** S · **Risk:** Low.

### 5. Admin action audit log
- **Why:** `reset_draft`, `undo_last_pick`, `finalize_keepers` are destructive
  one-click ops among 10 users. An `admin_log(action, actor, payload, at)`
  row appended inside each SECURITY DEFINER fn gives post-hoc "who did what."
- **Effort:** M · **Risk:** Low (one insert per RPC).

### 6. Vendor-split the bundle
- **Why:** Route-level splitting shipped (largest route chunk: AdminPage at
  ~156 kB), but the shared index chunk is still ~494 kB (153 kB gzip) —
  recharts is the heavy suspect. A `manualChunks` vendor split would cut
  first load further.
- **Effort:** S · **Risk:** Low.

### 7. Make `finalize_keepers` honor `draft_settings.draft_type`
- **Why:** The RPC hardcodes a snake grid; 2026-27 is configured `linear`
  and its grid was built linearly. A revert + re-finalize from the app
  would silently flip the board to snake on draft night. Honor the setting,
  or raise when they disagree.
- **Effort:** S · **Risk:** Medium if left — draft-night board shape.

### 8. CI/pre-push gate: `lint && test:run && build`
- **Why:** Lint on `src/` is clean, tests are 150/150, build green — lock it
  in so it stays that way.
- **Effort:** S · **Risk:** None.

### 9. Consolidate type sources
- **Why:** Generated Supabase types vs hand-mirrored `src/api/types.ts` drift
  as migrations land. Regenerate in a script; keep hand types only for
  view-shapes (e.g. `PlayerWithStats`).
- **Effort:** M · **Risk:** Low; mechanical.

## P3 — Nice-to-have (post-draft)

### 10. Draft clock with pause
- **Why:** PickClock exists with tests; the league drafts untimed so it stays
  dormant and settings-driven. Revisit only if the format changes — or if
  "Commissioner TV mode" ships, where a countdown is part of the show.
- **Effort:** M · **Risk:** None while dormant.

### 11. PWA install + "you're on the clock" push
- **Why:** Delight for remote/hybrid drafts; web-push via edge fn on turn
  change. Explicit YAGNI while the draft is in-person. Shares groundwork
  with "Offline-first drafting."
- **Effort:** L · **Risk:** Complexity.

## Vision — make it great (2026-09-14 brainstorm, unspecced)

Raw ideas from the production-readiness session, ordered by theme. None are
specced — each needs a grilling pass (scope, data model, UI sketch) before
promotion into P1–P3. "Builds on" points at seams that already exist.

### The big-screen era

**V1. Commissioner TV mode.** Projector-first layout for the room's big
screen: giant pick grid, on-the-clock countdown (see P3 #10), last-five
ticker, and a live "now drafting" card in team colours. Everyone drafts from
phones; the TV is the theater. Highest enjoyability-per-line-of-code — all
data already flows through Supabase realtime.
- **Builds on:** realtime layer, `DraftTurnBanner`, `lib/teamColours`. · M.

**V2. Pick-drop hype moments.** Animate each pick onto the board: headshot
card slide-in, team-colour flash, optional sound sting, confetti for keeper
reveals. Draft night is a show; make the app clap.
- **Builds on:** draft board components. · S–M.

**V3. Auto-banter engine.** Badge live picks as STEAL / REACH +N ROUNDS by
comparing pick slot vs the value bundle's board position; add inline emoji
reactions per pick (small table + realtime subscription) so phones light up
on every selection. Hands ten mates their ammunition.
- **Builds on:** player-value interface (`169391b`), ESPN projections. · S–M.

### Make everyone genuinely better at drafting

**V4. Live category race.** Recompute projected ROTO standings as each pick
lands and show the climb in realtime. Turns a category-league draft into a
spectator sport.
- **Builds on:** `lib/rotoStandings`, projections module. · M.

**V5. Draft report cards.** The moment the draft ends: per-team grades, best
value pick, biggest reach, projected finish, bust-watch — as a shareable
card image for the group chat.
- **Builds on:** value bundle + final rosters. · M.

**V6. Dress rehearsal night.** One commissioner click snapshots the league
(keepers, rosters, pool) into a throwaway shadow season; everyone drafts in
the real UI for practice; it evaporates after. Run it the week before and
draft-night nerves disappear.
- **Builds on:** e2e harness + throwaway-season pattern (`e2e-trade-draft-integrity.mjs`),
  E2E Shadow Squad. · M.

**V7. Rival-mimic bots.** Practice opponents trained on each rival's actual
tendencies from archived drafts — Mamba's bot reaches for his favorites in
round 2 because the real one always does. Chaotic, personal, hilarious.
- **Builds on:** `lib/practiceDraft` engine, archived seasons. · M–L.

### Accessibility — draft night is a hostile environment

**V8. Offline-first drafting.** Service worker + cached readable board +
persisted pick queue + reconnect sync banner. Venue wifi will die in round 4;
this is what "draft night works flawlessly" actually means. Supersedes P2 #4
(do them together).
- **Builds on:** `src/api/offlineQueue.ts`, realtime badge. · M.

**V9. One-thumb mode.** Bottom-sheet player picker with a sticky Draft
button — draft an entire round while holding a beer.
- **Builds on:** mobile board (8668673), `useIsMobile`. · S–M.

**V10. Real a11y pass.** Keyboard-first pick flow, focus management on the
board, `aria-live` pick announcements ("With the 6th pick, Mamba Mentality
selects…"), colour-blind-safe team encoding (colours + initials/patterns),
reduced-motion respected. The play-by-play doubles as theater.
- **Builds on:** `lib/teamColours` (add secondary encodings). · M.

### The league lives all year

**V11. Draft museum.** Replay any archived season's draft pick-by-pick with
clock timings, all-time reaches/steals leaderboard, franchise-history
superlatives. Free content from data already kept.
- **Builds on:** archived seasons + rosters tables. · M.

**V12. Keeper-deadline ceremony.** Turn KeeperManager into an offseason
workflow: countdown, GM reminders, and a dramatic all-at-once keeper-reveal
night (cards flipping). Retires the 2027 rollover runbook risk (P1 #2) —
the app becomes the runbook.
- **Builds on:** KeeperManager, `assign_keeper`/`finalize_keepers` RPCs. · M.

**Pick-three if rationed:** V1 (TV mode), V8 (offline-first), V3 (auto-banter)
— one makes it a show, one makes it unbreakable, one makes it funny.
