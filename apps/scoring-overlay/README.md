# ASC Live Scoring Strip (OBS overlay)

Transparent Browser Source page for ASC live matches. Subscribes to the existing NestJS Socket.IO **`/live`** feed (same protocol as the mobile guest live score).

## Strip layout (Theme 1 — lower third)

Full-width three-part strip (~100px), anchored bottom on a 1920×1080 transparent canvas:

1. **Left angled navy panel** — two batsmen (striker ▸ in yellow), name + runs + balls; ASC logo puck (`?ascLogo=`)
2. **Center black slanted notch** — team · score · overs · sub-line (auto: NEED / CRR|RRR; operator overrides for toss, chase, boundaries)
3. **Right angled navy panel** — bowler name + R-W figures + overs; this-over ball circles (wd/nb add circles without advancing the 6-count); bowling team logo puck

Tokens: `src/theme1/tokens.css` + `src/theme1/strip.css` (ASC navy `#1a4d8f`, checker texture).

## Quick start

```bash
cd apps/scoring-overlay
pnpm install
pnpm dev
```

Open:

```
http://localhost:5178/?matchId=YOUR_MATCH_UUID
```

Optional API override (local backend):

```
http://localhost:5178/?matchId=YOUR_MATCH_UUID&api=http://localhost:3001
```

Production default API: `https://acc-api-production.up.railway.app`

Build static files:

```bash
pnpm build
# output in dist/ — host anywhere (S3, Railway static, nginx…)
pnpm preview
```

## OBS Browser Source

| Setting | Value |
|--------|--------|
| **URL** | `https://<your-host>/?matchId=<match-uuid>` |
| **Width** | `1920` |
| **Height** | `1080` |
| **Custom CSS** | (optional) ensure body background stays transparent |
| **Shutdown source when not visible** | Off (recommended) so reconnect stays warm |
| **Refresh browser when scene becomes active** | Optional |

The page HTML/body background is **transparent** — only the bottom score strip is opaque. Position the source full frame; the strip is anchored to the bottom.

### Match ID

Copy the match UUID from the ACC app (match detail URL / admin) into `matchId`.

### Production CORS

Socket.IO and scorecard REST honor production `CORS_ORIGINS`. If the overlay is hosted on a new domain, add that origin to the API’s `CORS_ORIGINS` allowlist. Auth is **not** required for `/live` or `GET /matches/:id/scorecard`.

## Protocol (reference)

- Connect: `io("{api}/live", { transports: ["websocket"] })`
- Join: emit `live:subscribe` with `{ matchId }` on connect **and** reconnect
- State: listen `live:state` → `{ matchId, state: ScorecardResponse, updatedAt }`
- Seed: Redis snapshot on subscribe + optional `GET /matches/:matchId/scorecard`
- On disconnect: keep last frame; show subtle “Reconnecting…” (never blank/error)

## Graphics + control (Milestone 3)

Same Netlify site / origin as the score strip:

| Page | URL |
|------|-----|
| Score strip | `/?matchId=…` |
| Graphics (OBS) | `/graphics.html?matchId=…` |
| Control panel | `/control.html?matchId=…` |

**V1 graphics (manual):** partnership, fall of wicket, batsman card, bowler card (this match), **bowler career stats**, **batsman career stats**, innings break. **Toss** and **Runs to win** are strip-only (replace CRR | overs remaining on the score bar).

- **Single OBS source (recommended):** root `/?matchId=…` renders the score strip **and** full-screen graphics via a shared `graphics-stage` layer (centered above the strip). `graphics.html` remains available and uses the same module.
- Live data from `/live` + scorecard (partnership / FOW / innings / this-match figures).
- **In-play batsman card:** this-innings only (full name + runs*(balls); Dot Balls / 2s / 4s / 6s / SR). No career/broadcast-stats fetch. Dot balls derived as `balls − ones − twos − threes − fours − sixes`.
- Career photo + summary via `GET /broadcast/players/:userId/stats?ballType=LEATHER|TENNIS` (includes batting innings/30s/50s/HS context, bowling average, economy, and underlying bowling totals for live merge) — used by career cards only.
- Photo missing → initials fallback. One full-screen graphic on air at a time; **Hide all** clears cards + strip overrides.
- **Toss (strip):** Show/Hide replaces the CRR row with “X won the toss and chose to bat/bowl”.
- **Runs to win (strip):** Show/Hide replaces the CRR row with “NEED X OFF Y” (updates live while on).
- **Bowler Career Stats:** shown on the **score strip page** (`/?matchId=…`) as a bottom navy/purple bar (Matches / Wickets / Average / Economy / Best). Figures **include the current match live** (career totals + this-match bowling, recomputed from underlying runs/balls/wickets). Replaces the strip while on air; strip returns on Hide. Show disabled until career bowling stats exist for the match ball type.
- **Batsman Career Stats:** full-screen card on the **root strip page** and `graphics.html` via the shared graphics stage (photo, LEATHER/TENNIS CAREER header, innings / runs / avg / SR / 30s / 50s, highest score + optional opponent/venue). Centered above the strip; strip keeps updating. Graphics fetch/render is **isolated** (try/catch). Uses the **match ball type only**. Independent of the in-play batsman card. Show disabled until career batting stats exist for that ball type.

**Control panel (operator):** sticky on-air dock + one-tap **Take off air**; section highlight when that graphic is live; live previews; Show disabled until data is ready; batsman/bowler pickers grouped (crease / this innings / all).

Local:

```bash
pnpm --filter @acc/scoring-overlay dev
# Control:  http://localhost:5179/control.html?matchId=UUID
# Graphics: http://localhost:5179/graphics.html?matchId=UUID
# Optional local API: &api=http://localhost:3001
```
