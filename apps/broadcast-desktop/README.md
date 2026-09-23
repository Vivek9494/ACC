# ASC Broadcast (desktop)

macOS Electron shell that embeds the ASC **scoring cockpit** (Expo web:
`/matches/:id/score`) and drives OBS via **obs-websocket v5**. OBS controls
live in the shell chrome and (inside Electron only) in a **Broadcast / OBS**
block above Main Scoreboard on the cockpit page.

Scope: match-ID entry + full-window cockpit embed + OBS connect / start-stop
stream + **OBS lifecycle** + **Instant Replay**. OBS controls and Settings live
in the cockpit **Broadcast / OBS** block (Electron only).  
The public graphics-only `control.html` is **retired** (use the cockpit Overlay Control).
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

Load a Match ID → embeds `{ASC_COCKPIT_URL}/matches/{id}/score`. Sign in inside
the BrowserView when prompted. Keep the window ≥1024px wide so the desktop
cockpit layout (and OBS block) appears.

## Package (.app)

```bash
pnpm --filter @acc/broadcast-desktop pack:mac
```

Output: `apps/broadcast-desktop/dist/mac-arm64/ASC Broadcast.app`  
Unsigned (`identity: null`) for local use.

## Flow

1. App opens → Match ID form + OBS chrome.
2. **Auto-launch OBS** in the background (`open -g -j`), wait for websocket,
   auto-connect. If OBS is already running, connect to that instance.
3. **Settings** (`⌘,` or Broadcast/OBS → Settings) — host / port / password, OBS
   app path, optional scene collection + profile, Instant Replay scene/source
   names. Stored in userData (`obs-connection.json`). Same form on the Match ID
   entry screen before load.
4. **Start Streaming** / **Stop Streaming** / **Instant Replay** from the
   in-cockpit Broadcast/OBS block.
5. **Load** → scoring cockpit fills the window (no shell control bar).
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
