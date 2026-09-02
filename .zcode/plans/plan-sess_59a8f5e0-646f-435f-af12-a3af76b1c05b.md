## Goal
Tables show all 13 ROTO stats (+ GP) on desktop AND mobile, with an Avg/Totals basis toggle, a rookies-only filter, and TD visible everywhere.

## 1. Shared stat-column model — `src/lib/stats.ts`
- `STAT_COLUMNS`: ordered config for the 13 league cats (+ GP) — key, label, alignment — single source of truth for both tables.
- `playerStat(p, cat, basis)`: value for a category under basis `'averages' | 'totals'` (averages = raw per-game; totals = avg × GP; DD/TD stored as totals, divided by GP in averages mode).
- `fmtStat(cat, basis, value)`: percentages 1dp, counting 1dp in avg mode / 0dp in totals mode.
- `playerValue` in `projections.ts` gains a basis parameter (default `'totals'` — Rankings z-scores recompute when the toggle flips, so composite/Sort respects the chosen basis). Existing totals tests stay green via the default.

## 2. Player Pool page
- Columns become GP + all 13 league cats in standings order (adds FG%, FT%, 3P%, TO, TD — TD was the missing one) — from the shared `STAT_COLUMNS` config; sort uses the active basis.
- Sticky header row + sticky first column (player name cell: `sticky left-0` with solid bg + shadow) so the 15-column table scrolls cleanly.
- Toolbar: position filter (existing) + **Rookies** toggle chip (filters `isRookie`) + **Avg | Totals** segmented toggle.

## 3. Rankings page
- Table already shows all 13 z columns; changes: keep z columns but also make first column (rank + name) sticky-left; add the same Rookies toggle; add the Avg/Totals toggle which drives both the z-score basis and a small right-aligned context row of raw values? — no, keep Rankings z-only (raw stats live in the dialog + pool); the toggle switches the basis the z-scores are computed on (persisted alongside the weights in localStorage).
- Header group label noting the active basis ("z on 2025-26 totals" ↔ "z on per-game averages").

## 4. Player stats dialog
- Values shown honor the current basis where trivially available (dialog gets `basis` prop from pool page) — DD/TD display per-game in avg mode.

## 5. Mobile approach
- Same table markup for all breakpoints: `overflow-x-auto` horizontal scroll + sticky name column + sticky header. Proven pattern (ESPN mobile does the same), no separate card layout to maintain. Headshot hidden below `sm` to save width (name + ROOK badge remain).

## 6. Tests & verify
- `stats.test.ts`: `playerStat` basis behavior (incl. DD/GP derivation), `fmtStat` rounding.
- `projections.test.ts`: basis param.
- Full `tsc` + vitest; visual smoke via dev server not possible here — will keep class usage conservative (Tailwind utilities already in the codebase).