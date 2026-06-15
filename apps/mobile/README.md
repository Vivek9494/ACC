# @acc/mobile

Expo React Native app for ACC.

## Google Maps (production / EAS builds)

The tournament location map uses `react-native-maps`. **Expo Go on iOS** uses Apple Maps by default and works without extra setup for development.

For **Android Expo Go** and **production EAS builds**, add Google Maps SDK keys:

1. Create API keys in [Google Cloud Console](https://console.cloud.google.com/) with **Maps SDK for Android** and **Maps SDK for iOS** enabled.
2. Restrict each key to your app (Android package `com.atmiya.acc`, iOS bundle `com.atmiya.acc`).
3. Replace the placeholders in `app.json`:
   - `expo.ios.config.googleMapsApiKey` — iOS Maps SDK key
   - `expo.android.config.googleMaps.apiKey` — Android Maps SDK key

For EAS, you can inject keys via `eas.json` env and a dynamic `app.config.js` if you prefer not to commit secrets.

## Environment variables

Copy `.env.example` to `.env`:

| Variable | Purpose |
| -------- | ------- |
| `EXPO_PUBLIC_API_URL` | ACC API base URL (required) |

Location **search** (autocomplete) uses the **server** `GOOGLE_PLACES_KEY` — the mobile app never sees it. Map **tiles** use the keys above in `app.json`.

## Run locally

```bash
pnpm dev:mobile   # from repo root, or `pnpm start` in apps/mobile
```

Scan the QR code with **Expo Go** on your phone. Ensure `EXPO_PUBLIC_API_URL` points at your machine's LAN IP (not `localhost`) when testing on a physical device.
