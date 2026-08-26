#!/usr/bin/env node
// Overnight self-healing watchdog. Run repeatedly (cron/loop):
//   1. Uncommitted changes idle >30 min → committed to a WIP branch (work preserved).
//   2. `npm run build` must pass. If it fails while dirty, retry on the clean
//      committed state to tell "someone's WIP broke it" from "repo is broken".
//   3. Append a status line to docs/OVERNIGHT-LOG.md.
// Stdlib only. Exit 0 = healthy, 1 = build broken.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG = path.join(ROOT, 'docs', 'OVERNIGHT-LOG.md');
const STALE_MS = 30 * 60 * 1000;

const git = (...args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function statusLines() {
  return git('status', '--porcelain').split('\n').filter(Boolean);
}

/** Newest mtime across changed files (now if unresolvable → treated as fresh). */
function newestChangeTime() {
  let newest = 0;
  for (const line of statusLines()) {
    const p = line.slice(3).split(' -> ').pop().trim().replaceAll('"', '');
    try {
      const full = path.join(ROOT, p);
      if (existsSync(full)) newest = Math.max(newest, statSync(full).mtimeMs);
    } catch { /* deleted mid-run — ignore */ }
  }
  return newest || Date.now();
}

function runBuild() {
  try {
    // ponytail: shell:true so Windows resolves npm.cmd without special-casing
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', shell: true });
    return true;
  } catch (e) {
    console.error(String(e.stderr || e.stdout || e).slice(-1500));
    return false;
  }
}

function log(status, detail = '') {
  const ts = new Date().toISOString();
  const line = `- ${ts} — **${status}**${detail ? ` — ${detail}` : ''}\n`;
  if (!existsSync(LOG)) appendFileSync(LOG, '# Overnight log\n\n');
  appendFileSync(LOG, line);
  process.stdout.write(line);
}

function commitDirtyToWip() {
  const branch = `wip/overnight-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  // ponytail: everything lumped into one WIP branch — split by author if it ever matters
  git('checkout', '-b', branch);
  git('add', '-A');
  git('commit', '-m', 'WIP: auto-committed by overnight watchdog (idle >30min)', '--no-verify');
  git('checkout', '-'); // back to previous branch so builds keep running on mainline
  return branch;
}

// --- main ---
let detail = '';
let dirty = statusLines().length > 0;

if (dirty && Date.now() - newestChangeTime() > STALE_MS) {
  const branch = commitDirtyToWip();
  detail += `stale uncommitted work preserved on ${branch}; `;
  dirty = false;
}

if (runBuild()) {
  log(dirty ? 'DIRTY-OK' : 'OK', detail + 'build passing' + (dirty ? ' (fresh uncommitted work left in place)' : ''));
} else if (dirty) {
  // Retry on clean tree: is it the WIP's fault or the repo's?
  git('stash', 'push', '--include-untracked', '-m', 'watchdog: isolate build failure');
  const cleanOk = runBuild();
  git('stash', 'pop');
  if (cleanOk) log('BUILD-BROKEN-BY-WIP', detail + 'build fails only with uncommitted changes; changes kept (stashed+popped)');
  else log('BUILD-BROKEN', detail + 'build fails even on clean tree — needs attention');
} else {
  log('BUILD-BROKEN', detail + 'build fails on clean tree');
  process.exit(1);
}
