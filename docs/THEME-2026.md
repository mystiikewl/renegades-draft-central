# Renegades Draft Central — Design Spec v2

**The product:** a live draft war room for a 10-team friends dynasty league.
Used hardest for ~3 hours once a year, browsed casually before that. Design for
the draft night first: fast scanning, big clear states, thumbs on phones,
one team on the clock and everyone watching.

**Identity in one line:** broadcast-dark war room with a friendly edge —
deep space-navy surfaces, one electric blue for everything you can click,
gold reserved like a spotlight for whoever is on the clock.

---

## 1. Dials

| Dial | Value | Why |
|---|---|---|
| Visual density | **7** | Draft boards are data. Tight rows, aligned numbers, no wasted chrome. |
| Design variance | **3** | Muscle memory under a shot clock. Components always look the same. |
| Motion intensity | **3** | Motion = information (pick landed, turn flipped, clock urgent). Nothing decorative moves. |

## 2. Theme: dark-only, locked

No light mode. No toggle. Draft night is at night; the casual browsing season
is short enough that one excellent theme beats two mediocre ones.

Base family: deep desaturated navy-charcoal (not pure black, not blue-bright).
It photographs well on TVs/laptops in a lounge room and keeps gold/blue vivid.

## 3. Color tokens

### The accent law
Three colors, three meanings, globally locked:

| Token | HSL | Hex ref | Means |
|---|---|---|---|
| `--primary` (blue) | `213 94% 62%` | ≈ `#2E8BFF` | Interactive. Buttons, links, focus rings, active tab, your-pick highlight. Clickable = blue. |
| `--draft-active` (gold) | `40 95% 60%` | ≈ `#F5B32E` | On-the-clock + timer urgency ONLY. If gold shows and no one must act, it's a bug. |
| `--draft-picked` (green) | `152 60% 46%` | ≈ `#2EBD7B` | Completed picks, confirmed keepers. |

Plus `--destructive` red for rollback/delete. Everything else neutral.

Rules:
1. Gold is scarce by design. One element per screen max.
2. Blue never marks status; status never looks clickable.
3. No gradients except one subtle vertical wash on the page background. No glows, no neon text, no glassmorphism.

### Neutral ramp (single cool family)
```
--background      222 47% 5%
--card            222 38% 9%
--surface-hover   220 28% 13%
--border          220 18% 19%
--muted-foreground 218 12% 64%
--foreground      210 20% 96%
```

### Position badge ramp (desaturated, AA on card surface)
```
PG #6C97F2 · SG #E57A66 · SF #52BE93 · PF #D4A54A · C #A98BE0
G/F/UTIL → muted gray badge
```
Tinted-bg + tinted-text pairs, 11px semibold, pill shape.

## 4. Typography

Single family: **Inter**, self-hosted (`@fontsource-variable/inter`). No second font.

- **All numerals in tables/stats/timer:** `.tnum { font-variant-numeric: tabular-nums }`. Non-negotiable — misaligned digits are the fastest way to make a draft board feel cheap.
- **Display moments** (page titles, empty-state headlines): Inter 700 at larger sizes with `tracking-tight` — same family, bigger weight. No display face needed.
- Sentence case everywhere. Uppercase only for position badges and table column headers (11px, `tracking-wide`, muted).

Scale:
```
display    28/34 · 700 · tracking-tight
section    18/24 · 600
body       14/20 · 400
data cell  14/20 · tnum
label      12/16 · 500
micro      11/14 · muted (timestamps/helpers)
```

## 5. Shape & elevation

You like round corners — they're also the friendliness cue that separates this
from a trading terminal. Locked scale:

```
controls (buttons, inputs, selects)   10px
cards, modals, sheets                 16px
position badges, chips                pill
```

- Elevation = 1px border + slightly lighter surface. Drop shadows only on overlays (popover, modal, toast).
- Spacing on a 4px grid. Table rows ≥44px on touch screens (draft night = thumbs); desktop board rows may compress to 36px.

## 6. States (every interactive element ships all six)

default · hover (`--surface-hover`) · active press (`scale-[0.98]`) ·
focus-visible (2px blue ring, 2px offset) · disabled (45% opacity) · loading.

Draft-specific states:
- **Your pick:** blue left-edge bar + soft blue row tint + gold timer ring. The hero moment of the whole product.
- **Pick lands:** row flashes green once (600ms), settles to normal. Everyone's board updates via realtime — the flash is how you know it's live.
- **Timer ≤10s:** gold ring pulses (1s), stops on pick, collapses under `prefers-reduced-motion`.
- **Loading:** skeletons shaped like real rows. Never spinners inside the board.
- **Offline/reconnect:** persistent banner. Realtime drops silently otherwise.
- **Empty states:** composed, with the action that fills them ("Set your keepers →").

## 7. Motion spec (complete list)

| Moment | Spec |
|---|---|
| Pick lands | bg-color flash green → settle, 600ms, once |
| Turn change | clock banner crossfade, 250ms ease-out |
| Timer urgency | gold ring pulse 1s loop, reduced-motion → static |
| Modal/sheet/drawer | fade + scale 0.98→1, 200ms cubic-bezier(0.16,1,0.3,1) |
| Tab switch | content fade 150ms |

That's all. No scroll effects, no parallax, no loops.

## 8. Copy voice (language, not just pixels)

- Plain, direct, a bit dry-funny where it doesn't distract. It's a mates' league, not a bank.
- Buttons are verbs: "Claim team", "Lock keepers", "Make pick".
- Errors say what happened and what to do: "That player was just taken. Pick someone else."
- Numbers over adjectives: "Round 3 · Pick 4" not "You're doing great!"
- No emoji in chrome. No exclamation-mark stacking. Team trash-talk belongs in team names, which users control.

## 9. Bans (review checklist)

No emoji in UI · no decorative dots · no uppercase eyebrow labels · no em-dashes ·
no gradient washes beyond the page background · no glassmorphism · no shimmer loops ·
no fake-precise numbers · lucide icons only, uniform `strokeWidth={1.75}` ·
no light mode · no second accent color sneaking in.

## 10. Implementation map (first frontend PR)

1. Replace `:root` tokens in `src/index.css` with §3 ramp + accents; delete `--primary-glow`.
2. Tailwind config: `borderRadius` tokens (lg:16px, default:10px), drop Montserrat/Poppins families.
3. `npm i @fontsource-variable/inter`; import in `main.tsx`; remove Google Fonts link from `index.html`; add `.tnum` utility.
4. Rebuild components against these tokens as part of the schema-v2 rebuild — do not restyle legacy components.

*Skipped: light mode, logo/mark design, illustration style. Add when there's real need.*
