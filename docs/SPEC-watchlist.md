# User Watchlist

## Purpose

Users had no way to flag players across the app — every feature (Player Lab,
Rankings, Team Builder, the draft lists) made you re-find the same targets from
scratch. The watchlist is a per-user, per-season shortlist of players that:

1. is one click away everywhere a player row renders (star toggle), and
2. shows up directly inside player search — watchlist matches sort first, and
   the watchlist itself is offered as one-tap quick picks on focus.

**Foundation note:** the `user_favourites` table has existed since the 2026
rebuild (`20260825000001_init_schema.sql`, commented *"watchlist per user per
season"*) with RLS allowing own-row writes, but no client code ever used it.
This feature wires it up; the only SQL change is tightening reads.

Out of scope (v1): dedicated Watchlist page (the Player Pool "★ Watchlist"
filter chip + search quick picks cover it), Trade Center badges on rostered
players, realtime multi-device sync, sharing watchlists.

---

## SQL

Migration: `supabase/migrations/20260918000001_watchlist_select_own.sql`.

`user_favourites` keeps its shape — no table changes:

```sql
create table public.user_favourites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.players  (id) on delete cascade,
  season_id  uuid not null references public.seasons  (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, player_id, season_id)
);
```

Policy change: `favourites_select` (`using (true)`) is replaced by
`favourites_select_own` (`using (profile_id = auth.uid())`) so users only ever
see their own rows — matching the insert/delete policies, which were already
own-row-only. Direct client writes remain sanctioned: this is *"the one table
users write directly"*, so no RPCs are added.

---

## Client API

New module `src/api/favourites.ts` (pattern of `notifications.ts`):

- `useFavourites(seasonId)` — season-scoped select, newest first. RLS scopes
  rows to the caller.
- `useFavouriteIds(seasonId)` — derived `Set<player_id>` for O(1) star checks
  in long lists.
- `useToggleFavourite(seasonId)` — direct `.insert()` / `.delete()` mutation,
  `profile_id` taken from `useAuth()`; invalidates via
  `invalidateTables(qc, seasonId, 'user_favourites')`; toasts on error only
  (a star toggle must not be noisy).

Wiring:

- `qk.favourites(seasonId)` added to the key registry in `src/api/queries.ts`.
- `user_favourites` added to the `LeagueTable` union + `TABLE_KEYS` in
  `src/api/invalidation.ts`, but deliberately **not** to `REALTIME_TABLES`:
  rows are per-user and invisible to other members, so mutations invalidating
  directly is sufficient (no other client needs to react).
- `UserFavourite` type in `src/api/types.ts`.

---

## UI

Two shared primitives in `src/components/player/`:

- **`WatchlistStar`** — self-contained star toggle (`playerId` + `playerName`
  props; auth/season/data hooks inside). Calls `stopPropagation` +
  `preventDefault`, so it can live inside clickable rows, table cells and
  `Link`s. Filled + `text-primary` when watched; proper `aria-pressed` and
  `aria-label`.
- **`PlayerSearch`** — the autocomplete extracted from Player Lab's private
  component. Owns its query/dropdown state; filters with the shared
  `matchesSearch`. Watchlist-aware: watchlist matches sort first, and with an
  empty query the dropdown offers up to six watchlist players under a
  "Watchlist" label as one-tap picks. Option rows are a container with a pick
  button and a star sibling (never a button inside a button).

Surfaces:

| Surface | Change |
|---|---|
| Player Lab | Shared `PlayerSearch` (replaces the private copy); star next to the selected player's name; compare select pins watchlist players under a "★ Watchlist" group. |
| Player Pool | "★ Watchlist" filter chip; star in each row's sticky player cell. |
| Player dialog (`PlayerStatsDialog`) | Star in the header — shared by Pool, Live Draft and Practice Draft. |
| Draft list (`DraftPlayerList`) | Star per row (Live Draft + Practice Draft inherit). |
| Rankings | Star beside each row's `Link` (mobile cards and desktop table). |
| Team Builder (`SlotPickerDialog`) | Star beside each search result. |

Watchlist data is season-scoped (`useActiveSeason`); it follows the active
season like everything else.

---

## Team fit panel (Player Lab)

A secondary visualization under the shape radar: what the selected player does
to the viewer's **real** roster. All math is reused, not new:

- `impact(currentPlayers, candidate, baseline, cats)` (Team Builder's
  category-delta math) drives per-category bars — counting cats vs. the
  league baseline, percentages attempt-weighted. Bars scale within their own
  group (counting / percentage) and colour by helpful vs. harmful (`to`
  inverted). `flipsVsBaseline` renders a "flips" tag.
- `standingsSwing()` (`rotoStandings.ts`) re-runs the projected league table
  with the candidate added and diffs the viewer's team row: headline
  standings-points gain and rank move, plus per-category points chips.
- **Swap weakest mode**: ranks the viewer's rostered players by
  `leagueValueScores` composite and drops the weakest before recomputing —
  "add him, drop X" in one view.

States: skeleton while rosters/teams load; claim-team prompt without
`profile.team_id`; Team Builder prompt with no roster rows yet (pre-draft).
Component: `src/components/player/TeamImpactPanel.tsx` (self-contained —
takes `candidate` + `pool`, pulls its own auth/season/roster/team data).

---

## Category market context (Player Lab)

A card below Team fit: whether the selected player's category strengths are
**scarce** (premium) or **replaceable** (commodity) league-wide, and whether
the viewer's roster actually needs them — one buy/avoid verdict row per strong
category, max 5 rows. Pure lib: `src/lib/categoryMarket.ts`.

Market depth per category (the metric):

- A **provider** is any player with `zScores(pool, cat, 'totals')` ≥ 1
  (`PROVIDER_Z`). Depth = provider **share** of the pool: `scarce` < 8%
  (`SCARCE_SHARE`) ≤ `moderate` ≤ 15% < `deep` (`DEEP_SHARE`).
- **Top-heaviness**: gap between the top provider's z and the ~5th-best z
  (`dropOff` ≥ 0.75 = `TOP_HEAVY_DROP` → `topHeavy`) — a lone elite tier with
  a steep cliff behind it. A moderate-but-top-heavy market counts as thin for
  the verdict. Raw provider count and providers-per-team are shown for
  intuition.

Candidate context: his pool rank + midrank percentile in each category where
his own z ≥ 1 (`strongCategories`, best first, capped at `MAX_ROWS`); if
nothing clears the bar, his top 3 render with a "relative strengths only"
note.

Roster need: `buildNeeds()` (`draftIntelligence.ts`) — need side only, not the
Decision Board's needs-based `categoryMarkets`. The strategy preset follows
the Decision Board's saved lens (`draft-intelligence:${seasonId}:strategy`
pref), defaulting to `balanced`.

Verdict (`categoryVerdict`, precedence order): punt need → **punting**;
percentile ≥ 65 + thin + priority → **premium**; ≥ 65 + thin → **hold**; deep
+ not-priority → **replaceable**; ≥ 65 + priority → **value fill**; else
**filler**.

States: same guard ladder as Team fit (skeleton / claim-team prompt /
Team Builder prompt), plus a muted note when the player has no provider-level
categories. Component:
`src/components/player/CategoryMarketPanel.tsx` (self-contained — takes
`candidate` + `pool`, pulls its own auth/season/roster/team data).

---

## Player switcher bar (Player Lab)

The header search is the only selector at the top of a long page, so a slim
sticky switcher follows the reader. It renders **only after the header (with
its big search) has scrolled away** — an IntersectionObserver on the header
sentinel (`rootMargin: -96px 0px 0px 0px`) unmounts it at the top of the page
so the two searches never show at once. It sticks below the global tool nav
(`top-12`; AnalysisNav is ~48px and keeps `z-30` above the bar's `z-20`),
matching its `bg-background/95 backdrop-blur border-b` style. Content:
current-player chip (headshot + name; tap scrolls back to top), ◀ ▶ arrows
that cycle the watchlist by name (whole pool as fallback when nothing is
watched, wrapping both ends), and the shared `PlayerSearch` in compact mode.

Extras: pressing `/` anywhere on the page focuses whichever search is on
screen (switcher input when the bar is up, header input otherwise; ignored
inside inputs/textareas/selects). Similar-shapes match cards gained a corner
"View" action that promotes the match to the main player (the card body still
sets it as comparison), so browsing can chain from the bottom of the page.

Components: `src/components/player/PlayerSwitcherBar.tsx` (presentational —
visibility and the `/` shortcut live in `PlayerLabPage.tsx`);
`PlayerSearch` grew optional `compact` and `inputRef` props, both
backwards-compatible.


