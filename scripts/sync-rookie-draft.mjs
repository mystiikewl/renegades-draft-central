#!/usr/bin/env node
// Draft bio sync independent of season stats: rookies have no prior NBA stats.
// node --env-file=.env scripts/sync-rookie-draft.mjs [--apply]
import { mkdir, writeFile } from 'node:fs/promises';
import { mgmtClient, esc } from './lib/supabase-mgmt.mjs';

const db = mgmtClient();
const players = await db.query('select id, espn_id, name, draft_display from players where experience = 0 order by name');
const results = [];
const failures = [];
// ponytail: sequential requests for ~75 rookies; snapshots survive interruptions.
await mkdir('data', { recursive: true });
for (const player of players) {
  try {
    if (!/^\d+$/.test(player.espn_id ?? '')) throw new Error('Missing numeric ESPN id');
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${player.espn_id}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'curl/8.0.0' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`ESPN HTTP ${response.status}`);
    const { athlete } = await response.json();
    if (String(athlete?.id) !== player.espn_id) throw new Error('ESPN identity mismatch');
    const display = athlete.displayDraft;
    if (display != null && (typeof display !== 'string' || display.length > 120)) throw new Error('Invalid draft description');
    results.push({ ...player, fetched_draft_display: display ?? null, source_url: url });
  } catch (err) {
    failures.push({ name: player.name, error: err.message });
  }
  await writeFile('data/rookie-draft-snapshot.json', JSON.stringify({ fetched_at: new Date().toISOString(), results, failures }, null, 2));
}
console.log(JSON.stringify({ requested: players.length, fetched: results.length, withDraft: results.filter(r => r.fetched_draft_display).length, failures }));
if (failures.length) throw new Error('Incomplete fetch; no database writes made. See data/rookie-draft-snapshot.json');
const changes = results.filter(r => r.fetched_draft_display && r.fetched_draft_display !== r.draft_display);
if (process.argv.includes('--apply') && changes.length) {
  // Update existing identities only; never insert or touch league draft/season rows.
  const values = changes.map(r => `('${esc(r.id)}'::uuid, '${esc(r.espn_id)}', '${esc(r.fetched_draft_display)}')`).join(',');
  const updated = await db.query(`update players p set draft_display = v.display from (values ${values}) as v(id, espn_id, display) where p.id = v.id and p.espn_id = v.espn_id and p.experience = 0 returning p.id`);
  if (updated.length !== changes.length) throw new Error(`Updated ${updated.length}/${changes.length}; player identities changed during sync`);
  console.log(`Updated ${updated.length} draft descriptions`);
} else console.log(`${changes.length} changes${process.argv.includes('--apply') ? '' : ' (dry run; use --apply)'}`);
