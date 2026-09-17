# Rookie default ordering

Approved scope: Player Pool Rookies chip selects the active season's NBA draft order automatically, on both desktop and mobile. No extra sort control, label or pick-number badges. Existing stat-column sorting remains usable; switching Rookies off restores Value. Missing, undrafted, malformed and prior-year metadata follows current-year picks, with name tie-breaks. Preserve position/search filters and live/practice player eligibility.

Reuse players.draft_display (ESPN displayDraft), populated independently of prior-season stats: rookies have no historical NBA stats. Sync only existing rookies by UUID + ESPN ID; no new players, schema changes, league draft writes, or stats imports. Fetch snapshot before an explicit --apply, reject identity mismatch, do not erase existing metadata for absent upstream values. Confirm all 60 current-year picks and AJ Dybantsa first against live data.

Files: src/lib/playerFilters.ts + tests, src/pages/PlayerPoolPage.tsx + tests, scripts/sync-rookie-draft.mjs + node:test. Full suite/build, targeted lint, explicit app typecheck (report known baseline failures), two-axis review, scoped commit/push, isolated Netlify production build excluding other agents' changes; verify live bundle bytes.
