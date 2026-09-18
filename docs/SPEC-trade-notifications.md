# Trade Notifications & Competing Offers

## Purpose

Two problems, one migration pair:

1. **Pending trades are invisible.** A user only learns a trade is waiting for
   them by opening `/trades`. There is no notifications table, no unread
   tracking, and no badge anywhere in the chrome. Realtime is subscribed to
   `trades` changes but only invalidates query caches.
2. **Assets are locked to one proposal at a time.** `propose_trade` rejects any
   player/pick that is already in any `status = 'proposed'` trade
   ("already in a pending trade"). A real 2026-27 case: a manager wanted to
   offer Devin Booker for a 2nd-round pick but could not, because Booker was
   already in another pending proposal.

**Product ruling (owner decision):** competing offers are allowed. Any asset
may sit in multiple pending trades at once. **First accepted trade wins; every
other pending trade containing a moved asset is cancelled automatically**, and
both parties of each cancelled trade are notified. This is the exact semantics
`admin_override_trade` already applies (migration `20260826130000`, final
UPDATE) — this spec generalizes that pattern to `accept_trade`.

Out of scope (v1): bell dropdown panel, Web Push, auto-reinstating cancelled
trades after an admin reversal, conflict handling in `trade_pick`/`swap_picks`
(both revoked from `authenticated` in `20260826130000`).

---

## Part A — Competing offers (SQL)

New migration: `supabase/migrations/20260918000000_trade_competing_offers_notifications.sql`.
Follows repo convention: full `create or replace function` bodies (latest wins
down the chain), `security definer`, `set search_path = 'public', 'auth'`,
re-grant at the end.

### A1. `trades.auto_cancelled`

```sql
alter table public.trades
  add column if not exists auto_cancelled boolean not null default false;
```

Set `auto_cancelled = true` wherever a trade is cancelled *by the system*
(conflict cancellation, draft-completion sweeps) as opposed to by a person.
`status` stays `'cancelled'` so existing UI filters and ledger queries are
unaffected. `resolved_by` stays NULL for system cancels.

### A2. Shared conflict-canceller

```sql
create or replace function public.cancel_conflicting_trades(p_accepted_trade_id uuid)
returns void
language plpgsql security definer
set search_path = 'public', 'auth'
as $$
declare
  v_season uuid;
begin
  select season_id into v_season from public.trades where id = p_accepted_trade_id;
  if v_season is null then return; end if;

  with cancelled as (
    update public.trades t
    set status = 'cancelled', resolved_at = now(), auto_cancelled = true
    where t.season_id = v_season
      and t.status = 'proposed'
      and t.id <> p_accepted_trade_id
      and exists (
        select 1
        from public.trade_assets pending
        join public.trade_assets moved on moved.trade_id = p_accepted_trade_id
        where pending.trade_id = t.id
          and (
            (pending.roster_id is not null and pending.roster_id = moved.roster_id)
            or (pending.draft_pick_id is not null and pending.draft_pick_id = moved.draft_pick_id)
          )
      )
    returning t.id, t.from_team_id, t.to_team_id
  )
  insert into public.notifications (season_id, team_id, type, trade_id, body)
  select v_season, c.from_team_id, 'trade_auto_cancelled', c.id,
         'Trade cancelled — an asset in this offer was traded elsewhere'
  from cancelled c
  union all
  select v_season, c.to_team_id, 'trade_auto_cancelled', c.id,
         'Trade cancelled — an asset in this offer was traded elsewhere'
  from cancelled c;
end;
$$;
```

(Body text can name the first overlapping `asset_label` — join one asset per
cancelled trade — but a generic string is acceptable for v1.)

### A3. `propose_trade` — drop the exclusivity checks

Recreate `propose_trade` from the `20260826130000` version with one change:
**delete the four `if exists (... status = 'proposed') raise exception '% is
already in a pending trade'` blocks** (offered rosters, offered picks,
requested rosters, requested picks). Everything else is preserved verbatim:
shadow-team check, ownership checks, `is_used` pick check, draft-completion
lock. Two proposals may now share an asset; ownership is still verified at
proposal time and again at accept time.

### A4. `accept_trade` — first accepted wins

Recreate from the `20260826130000` version, unchanged through asset
verification and movement, then after marking the trade `accepted`:

```sql
  update public.trades
  set status = 'accepted', resolved_by = auth.uid(), resolved_at = now()
  where id = p_trade_id;

  perform public.cancel_conflicting_trades(p_trade_id);

  insert into public.notifications (season_id, team_id, type, trade_id, body)
  values (v_trade.season_id, v_trade.from_team_id, 'trade_accepted', p_trade_id,
          'Your trade was accepted');
```

Ordering matters and is safe inside the single transaction: verify → move →
mark accepted → cancel conflicts → notify. The existing per-asset
`for update` re-verification remains the integrity backstop; the canceller
only ever touches `status = 'proposed'` rows, so a race between two accepts
serializes on the trade row lock and the loser's `status <> 'proposed'` check
raises the existing "Trade is no longer pending" error.

### A5. Notify on every human decision

Recreate `reject_trade` / `cancel_trade` from `20260826131000` (they already
carry the draft-completion lock) each with one insert appended:

| RPC              | Recipient      | `type`           | Body |
|------------------|----------------|------------------|------|
| `propose_trade`  | `to_team_id`   | `trade_proposed` | `{from team} offered you a trade` — see note |
| `accept_trade`   | `from_team_id` | `trade_accepted` | Your trade was accepted |
| `reject_trade`   | `from_team_id` | `trade_rejected` | Your trade was rejected |
| `cancel_trade`   | `to_team_id`   | `trade_cancelled`| A trade sent to your team was cancelled |

Note on `propose_trade`: `notifications` carries `actor_team_id`, so the body
can be rendered client-side from the join with `teams`; store a plain body
string anyway so the bell works even if team names change.

### A6. Admin + system paths

- `admin_override_trade`: replace the inline conflict-cancelling UPDATE with
  `perform public.cancel_conflicting_trades(v_trade_id);` (same semantics,
  now with notifications) and insert `trade_accepted` notifications to both
  teams with an admin-flavoured body.
- `admin_reverse_trade`: insert `trade_reversed` notifications to both teams.
- Draft-completion sweeps (`make_pick`, `skip_pick`, `reset_draft` already
  bulk-cancel proposed trades): add one `insert into notifications
  (...) select ... from cancelled-rows` per site with type
  `trade_auto_cancelled` and body `Draft completed — pending trades were
  cancelled`. Cheap, same pattern, prevents silent bulk cancels.
- `trade_pick` / `swap_picks`: out of scope (not callable by users).

---

## Part B — Notifications (SQL)

### B1. Table

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  type text not null check (type in (
    'trade_proposed', 'trade_accepted', 'trade_rejected',
    'trade_cancelled', 'trade_auto_cancelled', 'trade_reversed'
  )),
  trade_id uuid references public.trades (id) on delete cascade,
  actor_team_id uuid references public.teams (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_team_created_idx on public.notifications (team_id, created_at desc);
create index notifications_team_unread_idx on public.notifications (team_id) where read_at is null;
```

### B2. RLS + realtime

Read-only for clients; all writes happen inside the security-definer trade
RPCs, matching the repo's write model.

```sql
alter table public.notifications enable row level security;

create policy "teams can read own notifications"
on public.notifications for select to authenticated
using (team_id = (select team_id from public.profiles where id = auth.uid()));

alter publication supabase_realtime add table public.notifications;
```

Supabase Realtime enforces the same RLS on `postgres_changes`, so clients only
ever receive their own rows.

### B3. Mark-read RPC

```sql
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql security definer
set search_path = 'public', 'auth'
as $$
declare
  v_my_team uuid := (select team_id from public.profiles where id = auth.uid());
begin
  if v_my_team is null then raise exception 'You must belong to a team'; end if;
  update public.notifications
  set read_at = now()
  where team_id = v_my_team and read_at is null
    and (p_ids is null or id = any (p_ids));
end;
$$;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
```

---

## Part C — Client

### C1. Data access — `src/api/notifications.ts` (new)

- `NotificationRow` type mirroring B1.
- `useNotifications()` — TanStack Query, key `qk.notifications` (add to the
  `qk` object in `src/api/queries.ts`), `select` exposes `unreadCount`.
- `useMarkNotificationsRead()` — mutation wrapping `mark_notifications_read`
  (no args = mark all), invalidates `qk.notifications` on success.

### C2. Realtime plumbing

- `src/api/invalidation.ts`: add `'notifications'` to the `LeagueTable`
  union and `TABLE_KEYS` (`qk.notifications`), and append
  `{ table: 'notifications', seasonScoped: false }` to `REALTIME_TABLES`.
  The existing shared `draft-${seasonId}` channel in `src/api/realtime.ts`
  then pushes badge updates with zero new channel code. RLS keeps delivery
  per-team.

### C3. `src/components/layout/NotificationBell.tsx` (new)

- Lucide `Bell` icon button in the **desktop + mobile header right cluster**
  (`src/app/AppShell.tsx`, next to `PwaInstallButton`). The mobile bottom nav
  stays untouched — trades already live under the `League` item.
- Count badge (shadcn `Badge`, absolute top-right, hidden at 0, caps at `9+`)
  styled like the IG bubble: small filled dot-count on the icon corner.
- onClick: `navigate({ to: '/trades' })`. Marking read happens on the Trade
  Center (C4), so the badge means "activity you have not seen in the Trade
  Center".
- Renders only when `profile?.team_id` exists (same gate as the rest of the
  header cluster).

### C4. `src/pages/TradeCenterPage.tsx`

- After the trades query succeeds, fire-and-forget
  `markNotificationsRead()` (guard against duplicate calls per mount).
- Outgoing/history rows: render `auto_cancelled` trades with an explicit
  "Cancelled — asset traded elsewhere" state so an auto-cancel never reads
  like the counterparty rejected it.
- Proposal form: since exclusivity is gone, add a client-side hint (data is
  already in the fetched trades list) when a selected asset is in another
  pending trade: *"Also in a pending trade — whichever deal completes first
  wins; the other is cancelled automatically."*

### C5. Suppressed double-noise

`TradeAnnouncementBanner` stays accepted-trades-only. No change.

---

## Acceptance criteria

1. Proposing Devin Booker to Team A while already pending with Team B
   succeeds; both trades list as `proposed`.
2. Team B accepts its Booker deal: Booker moves, Team A's trade flips to
   `status='cancelled', auto_cancelled=true`, and both Team A parties receive
   `trade_auto_cancelled` notifications. Accepting Team A's stale trade then
   fails with "Trade is no longer pending".
3. The same first-wins behaviour covers **picks** (any `draft_pick_id`
   overlap), not just players.
4. Every lifecycle event inserts a notification row for the correct team:
   proposed → recipient; accepted/rejected → proposer; cancelled → recipient;
   auto-cancelled → both parties; admin override/reverse → both parties;
   draft-completion sweep → both parties of each swept trade.
5. Bell badge shows the unread count live (realtime insert) without refresh;
   opening `/trades` clears it.
6. Non-member cannot read another team's notifications (RLS), and cannot call
   `mark_notifications_read` against another team's ids (rows untouched).
7. Draft-completion lock is preserved on all four human RPCs; the 2026-27
   season's 90-keeper state is untouched (additive migration only).

## Verification

- Extend `npm run test:e2e:trade` with scenario 1–3 (two proposals sharing an
  asset → accept one → assert the other's status/`auto_cancelled` and the
  notification rows).
- Manual SQL smoke: run the migration against a staging branch, replay the
  Booker scenario with two test accounts, check the publication lists
  `notifications` (`select * from pg_publication_tables`).

## Rollout

Single additive migration + client bundle; RPC signatures unchanged, so
deploy order is irrelevant. Existing `proposed` trades keep working. The only
behaviour change visible to users is friendlier: the "already in a pending
trade" error disappears.
