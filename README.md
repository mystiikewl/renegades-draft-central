# Renegades Draft Central

Web app for a private NBA ESPN dynasty league (ESPN league ID **201**): live
draft board with server-authoritative picks, keeper management, a practice
draft simulator with CPU teams, and a league analytics suite. Built for the
2026-27 season; 2025-26 data is archived and read-only.

## Stack

- **Vite + React 18 + TypeScript** (SWC)
- **Tailwind CSS 3** + **shadcn/ui** (Radix primitives), lucide icons
- **TanStack Router** (`src/app/router.tsx`) + **TanStack Query v5**
- **Supabase** — Postgres, Auth, Realtime, Edge Functions
- **zustand** — offline pick queue + practice draft session state
- **Vitest** + React Testing Library; deployed on **Netlify**

### Architecture in one paragraph

Every draft mutation (picks, undo, trades, keepers, draft order/status) is a
`SECURITY DEFINER` Postgres RPC — the client never writes draft tables
directly, so rules like turn order hold even if the UI lies. All reads go
through `src/api/`, cached by TanStack Query and kept fresh by a single
realtime channel per season that invalidates query keys. Picks made while
offline are queued client-side and flushed on reconnect. See
[`docs/AUDIT-2026-rebuild-baseline.md`](docs/AUDIT-2026-rebuild-baseline.md)
for why the app is built this way.

## Getting started

```sh
npm i
cp .env.example .env   # fill in values (see below)
npm run dev
```

Environment variables (`.env`, gitignored):

| Variable | Used by | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | app | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | app | anon key (RLS applies) |
| `SUPABASE_ACCESS_TOKEN` | scripts only | management API, for import/SQL scripts |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |
| `npm run test` / `npm run test:run` | Vitest watch / CI run |
| `npm run import-players` | Seed player data into Supabase |
| `npm run sync-keepers` | Sync ESPN keepers (edge function or local script) |
| `npm run test:e2e:trade` | End-to-end trade/draft integrity check against the DB |

Other one-off scripts live in `scripts/` (imports, dedupe, SQL runner, draft
simulation). Never run draft mutations against the archived 2025-26 season.

## Project docs

- [`docs/BACKLOG.md`](docs/BACKLOG.md) — prioritized remaining work
- [`docs/SPEC-draft-intelligence.md`](docs/SPEC-draft-intelligence.md),
  [`docs/SPEC-analysis-suite.md`](docs/SPEC-analysis-suite.md) — feature specs
- [`docs/AUDIT-2026-rebuild-baseline.md`](docs/AUDIT-2026-rebuild-baseline.md)
  — the 2025 audit that motivated the rebuild
- [`docs/history/`](docs/history/) — phase handoffs and overnight logs from
  the rebuild (historical)

## Deployment

Netlify (`netlify.toml`): build command `npm run build`, publish `dist/`.
The site needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in the
Netlify environment. SPA fallback (`/* → /index.html`) is configured.

## Origin

Originally scaffolded via Lovable; fully rebuilt in-repo for 2026. Lovable is
no longer part of the workflow.
