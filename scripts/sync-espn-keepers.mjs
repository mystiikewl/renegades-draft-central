#!/usr/bin/env node
/**
 * Thin non-interactive wrapper around syncLeague for the 2026 ESPN season.
 * Run: npm run sync-keepers   (or: node --env-file=.env scripts/sync-espn-keepers.mjs)
 * Safe to re-run: upserts only, never inserts teams.
 */
import { syncLeague } from './import-league.mjs';

const result = await syncLeague({ season: 2026, dryRun: process.argv.includes('--dry-run') });
console.log('\nDone:', result);
