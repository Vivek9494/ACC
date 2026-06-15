# @acc/api

NestJS backend for ACC.

## Google Places proxy

Location search for the Add Tournament form is proxied so the API key never ships to mobile:

| Endpoint | Purpose |
| -------- | ------- |
| `GET /places/autocomplete?q=&sessionToken=` | Autocomplete suggestions |
| `GET /places/details?placeId=&sessionToken=` | Formatted address + lat/lng |
| `GET /places/reverse?latitude=&longitude=` | Reverse geocode after map drag |

All require JWT auth. Rate limited via Redis (`PLACES_RATE_LIMIT` in `@acc/types`).

Set in `.env` (see `.env.example`):

```
GOOGLE_PLACES_KEY=your-server-key
```

Enable **Places API (New)** and **Geocoding API** on the key. Restrict by server IP in production.

If unset, `/places/*` returns `503 PLACES_UNAVAILABLE`.

## Run locally

```bash
pnpm dev:api   # from repo root
```

Apply migrations after pulling schema changes:

```bash
pnpm exec prisma migrate deploy
```
