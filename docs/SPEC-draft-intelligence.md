# Draft Intelligence Suite

## Purpose

The app previously exposed Rankings, Player Lab, Team Builder and Power Rankings as separate reports. Each tool was useful, but users had to decide which report to open and mentally carry context between them.

Draft Intelligence turns those reports into one decision workflow:

1. Start with the current live roster or active practice-draft roster.
2. Select a build strategy.
3. Review category needs, recommended players and positional cliffs.
4. Open a player in Player Lab or test the player in Team Builder.
5. Return to the same analysis workspace through the persistent analysis navigation.

## Decision Board outputs

### Category priorities

The model compares the current roster with average-team pace at the same roster completion percentage. Counting categories scale with roster completion. Shooting percentages remain rates and are compared directly.

A category can be:

- **Priority** — materially behind pace.
- **Watch** — modestly behind pace.
- **Healthy** — at or ahead of pace.
- **Punt** — intentionally removed by the selected strategy.

### Recommended next picks

Each available player receives a deterministic score:

- **55% strategy-adjusted value** — weighted 13-category z-score.
- **35% roster fit** — contribution to the categories currently behind pace.
- **10% positional scarcity** — separation from replacement depth at the player's primary position.

The interface exposes the component scores, categories helped, category risks and tier breaks. The score is a decision aid, not a hidden AI recommendation.

### Category market

For the highest-priority roster gaps, the board shows the best remaining category contributors. This answers a different question from overall rankings: “Who can fix this category now?”

### Position scarcity

For each primary position, urgency is based on the value drop from the best available player to the fourth option. This highlights draft windows where waiting may materially weaken the available tier.

## Projection corrections

The shared projection engine now:

- keeps percentage baselines as percentages instead of dividing them by league size;
- weights team shooting percentages by attempt volume when attempts are available;
- derives attempts from makes and percentage when needed;
- uses volume-adjusted percentage impact in player z-scores;
- renders percentage values correctly in the league forecast.

These changes affect Rankings, Team Builder, practice-draft CPU evaluation, Draft Intelligence and League Forecast because they share the same projection functions.

## Practice-draft context

When a practice session is active, Draft Intelligence follows the simulated board:

- CPU and user picks are removed from availability;
- the user's keepers and simulated selections form the current roster;
- recommendations update as the practice draft advances;
- no simulation data is written to the live league.

## Known limits

The model does not currently forecast:

- injuries or games missed beyond the imported projection inputs;
- NBA rotation or role changes;
- trades, suspensions or shutdown risk;
- category correlations beyond their direct z-score contribution;
- opponent-specific likely picks between the user's turns.

## Suggested next reports

The current architecture can support the following without creating another disconnected page:

1. **Pick-window survival** — estimate whether a target is likely to remain available at the user's next pick.
2. **Opponent need map** — infer which categories and positions each team is likely to target.
3. **Draft value ledger** — compare selection slot with model rank and track reaches, value picks and team draft grades.
4. **Scenario simulator** — run repeated CPU drafts from the current board to compare candidate paths rather than one next pick.
5. **Projection confidence** — show how much a ranking depends on games played, shooting volume or a small number of volatile categories.
