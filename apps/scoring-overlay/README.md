# ASC Live Scoring Strip (OBS overlay)

Transparent Browser Source page for ASC live matches. Subscribes to the existing NestJS Socket.IO **`/live`** feed (same protocol as the mobile guest live score).

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

## Graphics + control (Milestone 3 — Phase A)

Same Netlify site / origin as the score strip:

| Page | URL |
|------|-----|
| Score strip | `/?matchId=…` |
| Graphics (OBS) | `/graphics.html?matchId=…` |
| Control panel | `/control.html?matchId=…` |

Phase A validates the `graphics:command` relay with a **HELLO** show/hide graphic.

Local:

```bash
pnpm --filter @acc/scoring-overlay dev
# Control:  http://localhost:5178/control.html?matchId=UUID&api=http://localhost:3001
# Graphics: http://localhost:5178/graphics.html?matchId=UUID&api=http://localhost:3001
```

Public career card stats: `GET /broadcast/players/:userId/stats?ballType=LEATHER|TENNIS`
