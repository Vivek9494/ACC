# ASC Broadcast (desktop)

Electron shell (macOS + Windows) that embeds the ASC **scoring cockpit** (Expo web:
`/matches/:id/score`) and drives OBS via **obs-websocket v5**. OBS controls
live in the shell chrome and (inside Electron only) in a **Broadcast / OBS**
block above Main Scoreboard on the cockpit page.

Scope: broadcast home (tournament → match picker) + full-window cockpit embed + OBS connect / start-stop
stream + **OBS lifecycle** + **Instant Replay**. OBS controls and Settings live
in the cockpit **Broadcast / OBS** block (Electron only).  
The graphics-only `control.html` is unchanged and unused by the operator embed.
**Not in v1:** clip tagging bridge, Studio Mode / custom transition APIs.

## Dev

Prerequisites: API + Expo web (cockpit) running, e.g.:

```bash
pnpm db:up
pnpm dev:api
pnpm --filter @acc/mobile web   # or pnpm dev:mobile then press w — port 8081
```

Broadcast app:

```bash
pnpm install --filter @acc/broadcast-desktop...
pnpm dev:broadcast
```

Cockpit origin override (default `http://localhost:8081`):

```bash
ASC_COCKPIT_URL=http://localhost:8081 pnpm dev:broadcast
```

Sign in inside the BrowserView, then pick a tournament and match on broadcast
home (`{ASC_COCKPIT_URL}/broadcast-home`) → embeds
`{ASC_COCKPIT_URL}/matches/{id}/score`. Admin / Club Manager see every Live
tournament; scorers only the Live tournaments they're assigned to. Keep the window ≥1024px wide so the desktop
cockpit layout (and OBS block) appears.

## Package (installers)

Packaged builds load the **hosted cockpit** at `https://acc-cockpit.netlify.app`
(Netlify site built from `apps/mobile/netlify.toml`; its origin must be in the
API's `CORS_ORIGINS`). `ASC_COCKPIT_URL` still overrides it (https, or
http://localhost for testing). Dev (`electron .`) defaults to `http://localhost:8081`.

```bash
pnpm --filter @acc/broadcast-desktop dist:mac   # dist/ASC Broadcast-<v>-mac-universal.dmg
pnpm --filter @acc/broadcast-desktop dist:win   # dist/ASC Broadcast-Setup-<v>-win-x64.exe
pnpm --filter @acc/broadcast-desktop pack:mac   # unpacked universal .app only
```

- **ffmpeg** — `scripts/fetch-ffmpeg.cjs` downloads per-arch binaries (same
  release as `ffmpeg-static`) into `build/ffmpeg/`; they ship as
  `Resources/bin/ffmpeg[.exe]` outside `app.asar`, merged into one universal
  binary on macOS. Licences ship in `Resources/licenses/`.
- **macOS signing** — set `CSC_LINK` + `CSC_KEY_PASSWORD` (or `CSC_NAME` for a
  keychain identity) to sign with Developer ID + hardened runtime. Add
  `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` to notarize.
  Without them the build is ad-hoc signed (right-click → Open on first launch).
- **Windows signing** — set `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD`. Unsigned
  installers show a SmartScreen warning (More info → Run anyway).
- **CI** — `.github/workflows/broadcast-desktop.yml` (manual run or a
  `broadcast-v*` tag) builds both installers and uploads them as artifacts.

Security: the cockpit preload bridge only exists on the cockpit origin, every
IPC call re-checks the sender, navigation off the origin is blocked (https links
open in the browser), DevTools are off in packaged builds, renderer permission
requests are denied, and clip paths passed to OBS/ffmpeg must live in the app's
clips folder (or be a path OBS returned this session).

On **Windows**, OBS defaults to `C:\Program Files\obs-studio\bin\64bit\obs64.exe`
(launched with `--minimize-to-tray`, quit with a non-forced `taskkill`).

## Flow

1. App opens → sign in → broadcast home (tournament + match dropdowns, Log out,
   OBS Settings). `⌘O` returns to broadcast home.
2. **Auto-launch OBS** in the background (`open -g -j`), wait for websocket,
   auto-connect. If OBS is already running, connect to that instance.
3. **Settings** (`⌘,` or Broadcast/OBS → Settings) — host / port / password, OBS
   app path, optional scene collection + profile, Instant Replay scene/source
   names. Stored in userData (`obs-connection.json`). Also available from
   broadcast home.
4. **Start Streaming** / **Stop Streaming** / **Instant Replay** from the
   in-cockpit Broadcast/OBS block.
5. **Select a match** → scoring cockpit fills the window (no shell control bar).
6. On **Quit**, stop an active stream, then quit only an OBS **this app
   launched**. A pre-existing OBS is left running.

## Replay buffer

OBS must have **Replay Buffer enabled** in Settings → Output (max ~35s). The app:

1. Writes `RecRB=true` / `RecRBTime=35` into the OBS profile after connect
2. Calls `StartReplayBuffer` over obs-websocket
3. Shows **Replay ready** when `GetReplayBufferStatus.outputActive` is true

`--startreplaybuffer` is passed on launch, but only works if the buffer is already enabled in OBS Output settings. A running OBS session that had Replay Buffer off still needs **Apply** in Settings (or an OBS restart) before the buffer becomes available.

## Instant Replay (OBS prerequisite)

Create once in the OBS scene collection:

1. Scene named exactly **`Replay`** (or the name saved in Settings).
2. Inside it, an **ffmpeg_source** media source named exactly **`Replay Media`**
   (file path left blank — the app sets `local_file` per clip).
3. Live program scene named **`Scene`** (or the configured live scene name).
4. **Studio Mode OFF** for v1 (app warns if it is on).

Flow on **Instant Replay**: `SaveReplayBuffer` → `ReplayBufferSaved` path →
`SetInputSettings` → `SetCurrentProgramScene` (Replay) →
`TriggerMediaInputAction` RESTART → return on `MediaInputPlaybackEnded`
(or **Back to Live** / 45s watchdog).

```
open -g -j -a /Applications/OBS.app --args \
  --startreplaybuffer --minimize-to-tray --disable-missing-files-check \
  [--collection NAME] [--profile NAME]
```

`--disable-shutdown-check` is **not** supported on OBS 32+ (removed).
Clean quit via AppleScript clears the `.sentinel` file instead.
