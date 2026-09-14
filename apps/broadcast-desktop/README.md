# ASC Broadcast (desktop)

macOS Electron shell that hosts the existing ASC scoring **control panel**
(`https://acc-overlay.netlify.app/control.html?matchId=…`) and drives OBS
via **obs-websocket v5**. The app launches OBS in the background.

Scope: shell + control panel + OBS connect / start-stop stream +
**OBS lifecycle** (launch, hide, auto-connect, clean quit) + **Instant Replay**
(chrome one-button: save buffer → Replay scene → return to live).  
**Not in v1:** clip tagging bridge, Studio Mode / custom transition APIs,
OBS control from the hosted `control.html`.

## Dev

From the monorepo root:

```bash
pnpm install --filter @acc/broadcast-desktop...
pnpm dev:broadcast
```

Or from this package:

```bash
pnpm install
pnpm dev
```

Optional overlay URL override:

```bash
ASC_CONTROL_PANEL_URL=http://localhost:5179 pnpm dev
```

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
3. **Settings** (`⌘,`) — host / port / password, OBS app path
   (default `/Applications/OBS.app`), optional scene collection + profile,
   and Instant Replay scene/source names (`Scene` / `Replay` / `Replay Media`).
   Stored in userData (`obs-connection.json`).
4. **Start Streaming** / **Stop Streaming** against the connected OBS.
5. **Instant Replay** (when replay buffer is active) → save clip, cut to Replay
   scene, play from start; **Back to Live** or auto-return when playback ends
   (watchdog ~45s if the end event is missed).
6. **Load** → hosted `control.html?matchId=…` under the chrome.
7. On **Quit**, stop an active stream, then quit only an OBS **this app
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
