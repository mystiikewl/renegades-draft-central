# Overnight Runbook — self-healing watchdog

No cron scheduler is wired into this environment yet, so the orchestrator should
loop the watchdog. It is idempotent and safe to run as often as every 5 minutes.

## What it does (per run — `scripts/watchdog.mjs`, stdlib only)

1. **Stale uncommitted work**: if the tree is dirty and no file has changed in
   >30 min, everything is committed to `wip/overnight-<timestamp>` and it checks
   back out of the previous branch, so mainline stays clean.
2. **Build gate**: runs `npm run build`.
   - Pass → logs `OK` (or `DIRTY-OK` if fresh uncommitted work was left alone).
   - Fail + dirty → stashes, retries on clean tree, pops the stash: logs
     `BUILD-BROKEN-BY-WIP` (work preserved) vs `BUILD-BROKEN` (repo itself broken).
3. Appends one line to `docs/OVERNIGHT-LOG.md`.

Exit code: `0` healthy, `1` build broken on a clean tree.

## Commands

One-shot:

```bash
node scripts/watchdog.mjs
```

Overnight loop (every 10 min for 8 h), with digest at the end — orchestrator
should run this in a background shell:

```bash
for i in $(seq 1 48); do node scripts/watchdog.mjs; sleep 600; done; \
  tail -20 docs/OVERNIGHT-LOG.md   # ← this tail is the digest to report back
```

## Recovery

- Work parked by the watchdog lives on branches named `wip/overnight-*`
  (`git branch --list 'wip/*'`). Inspect with `git log wip/overnight-...`, then
  `git cherry-pick` / merge what's wanted.
- A `BUILD-BROKEN` line means a human (or morning agent) must read the build
  error — rerun `npm run build` locally for the full output.
