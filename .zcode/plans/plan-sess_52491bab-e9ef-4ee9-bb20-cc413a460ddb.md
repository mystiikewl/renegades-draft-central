# Clean up legacy CSV players

## Key findings
- **The player pool already hides them**: `usePlayerPool` filters `espn_id is not null`, so Rankings/Team Builder/Pool never show legacy players. No query change needed.
- **The real exposure is 9 roster rows** pointing at legacy players (they show on Rosters page, Power Rankings, and keeper-candidate lists):
  - **Mergeable twins** (same player, different name): Carlton Carrington ↔ Bub Carrington (rostered in the *active* season — this one matters), Nicolas Claxton ↔ Nic Claxton, Ron Holland II ↔ Ronald Holland II
  - **Archive rows with no ESPN row in our DB** (ESPN name differs or player left): Jaden Ivey, Jimmy Butler, Jonathan Kuminga, Cam Thomas, GG Jackson II, Thanasis Antetokounmpo — all only on the inactive 2025-26 season
- All 262 legacy players keep their 2025 stats (`player_seasons`) — that's history, not clutter.

## Changes

### 1. Extend `fix-players.mjs` alias map + run it
Add first-name aliases: `carlton→bub`, `ron→ronald` (`nicolas→nic` already exists). Re-run — this merges the three twins, re-pointing the active-season Carrington trade row, the 2025-26 roster rows, and player_seasons onto the ESPN rows, then deletes the orphans.

### 2. espn_id backfill for the remaining 6 rostered legacy players
New `--claim` mode in fix-players (or small addition): for espn-null players that appear on any roster, search the ESPN fantasy feed (`kona_player_info`, which we already page in import-projections) by last name, match on first-initial + last-name uniqueness, and **claim the espn_id on the archive row** (linking, not merging — the row keeps its name/history but becomes ESPN-visible and draft-eligible). Expected: Ivey/Butler/Kuminga/Thomas/GG Jackson get ids; Thanasis (out of the league) stays as pure history.
- GG Jackson note: ESPN lists him as "Gregory Jackson" — the last-name+initial match catches this.

### 3. Leave the rest alone
The ~250 unreferenced legacy players stay in the DB (2025 stats history) but are already invisible in every pickable list. No deletion — nothing to gain, and stats pages may still want them.

### 4. Verify + commit
Re-run the roster/legacy queries: expect 0 espn-null players on active-season rosters, and only Thanasis-like true-history rows on inactive seasons. `tsc` + tests green.