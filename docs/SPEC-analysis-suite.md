# Feature spec — Analysis suite (Team Builder, projections, sim)

User request (Arana): ESPN-style "Team Building Tool" + analysis surfaces for the league:
draft-strategy mapping, mid-draft "what if I draft X" impact, saveable setups,
projections/rankings views, draft-day simulation.

## What we already have (build on these)
- `player_seasons.stats` JSONB per player per season; `parseStats()` in `src/lib/stats.ts`
  maps ESPN keys -> display fields. All math can be client-side over one pool fetch.
- `usePlayerPool` query (pool = all players minus rostered) and `useRosters`.
- Draft settings: league_size 10, roster_size 18, keeper_limit 9 → 9 live rounds.
- shadcn/ui everywhere; TanStack Query for data.

## Scope slices (each independently shippable)

### Slice A — Team Builder page (`/team-builder`) [M]
The core tool. Grid: rows = roster slots (C/PG/SG/SF/PF/util × rounds config), columns =
optional category toggles (pts/reb/ast/stl/blk/tp/to/pcts). Users:
- configure categories + rounds (defaults from draft_settings),
- click a slot → pick a player from pool search → fills row,
- see cumulative projected totals + per-category ranks of their hypothetical team vs
  a "average team" baseline computed from the pool,
- **save/load builds**: localStorage keyed `tbuilder:<seasonId>:<slot>` (no DB table needed
  yet — personal tool). // ponytail: localStorage first; move to a user_builds table if sharing is requested.
- Mid-draft mode: read real rosters via useRosters so your actual picks pre-fill.

### Slice B — Player impact preview ("what if I draft X") [S]
On the Team Builder AND pool dialog: selecting a player shows delta on each category total +
whether it flips any category rank vs baseline. Pure function in `src/lib/projections.ts`
over existing stats. Reuses Slice A's math module.

### Slice C — Projections & rankings view [M]
`/rankings`: sortable table of players with z-score style ranking per category (mean/σ across
pool), composite score with user-adjustable category weights (sliders), persisted to
localStorage like Slice A. Builds on same `projections.ts`.

### Slice D — Draft-day simulation [L, defer]
Monte-Carlo snake sim over rankings with positional scarcity heuristics. High effort,
medium value for a 10-mate offline draft — do after A–C prove out.

## Shared foundation (build first)
`src/lib/projections.ts`:
- `categoryTotals(players)` → totals per enabled cat
- `baseline(pool, teams)` → average-team totals
- `zScores(pool, cat)` → per-cat z-score map
- `impact(currentTeam, candidate, cats)` → delta + rank flips
One pure module + unit test file. Everything else is UI over it.
