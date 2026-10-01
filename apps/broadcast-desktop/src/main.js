/**
 * ASC Broadcast — Electron main process.
 * Match-ID entry shell + full-window BrowserView scoring cockpit.
 * OBS via IPC → ObsController (in-cockpit Broadcast/OBS block + Settings).
 */

const { app, BrowserWindow, BrowserView, Menu, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { readObsConfig, writeObsConfig } = require('./obs-config');
const { ObsController } = require('./obs-client');
const { ObsLifecycle } = require('./obs-lifecycle');
const {
  buildHighlight,
  readExistingHighlightPath,
} = require('./innings-highlight');
const { resolveCockpitOrigin } = require('./app-config');
const { clipsRoot } = require('./clip-storage');
const {
  allowedClipPath,
  applyGlobalHardening,
  fileUrl,
  isTrustedSender,
  lockToOrigin,
  lockToShell,
  realPathOrNull,
} = require('./security');

/** Scoring cockpit origin (Expo web): hosted when packaged, local Expo web in dev. */
const COCKPIT_BASE = resolveCockpitOrigin({
  isPackaged: app.isPackaged,
  override: process.env.ASC_COCKPIT_URL,
});
const SHELL_HTML_PATH = path.join(__dirname, 'shell.html');
const SHELL_FILE_URL = fileUrl(SHELL_HTML_PATH);
const DEVTOOLS_ENABLED = !app.isPackaged;
/** Clip files OBS returned this session (may live outside userData/clips). */
const knownClipPaths = new Set();

/** No in-app chrome bar — BrowserView fills the content area. */
const SHELL_CHROME_HEIGHT = 0;

const LAST_MATCH_ID_PATH = path.join(app.getPath('userData'), 'last-match-id.txt');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserView | null} */
let panelView = null;
let panelVisible = false;

const obs = new ObsController();
const lifecycle = new ObsLifecycle(obs, () => readObsConfig(userDataDir()));
let quitting = false;
/** Match id waiting for OBS connect so ASC Overlay can be ensured. */
/** @type {string | null} */
let pendingOverlayMatchId = null;
/** @type {string} */
let lastObsConnection = obs.connection;

function userDataDir() {
  return app.getPath('userData');
}

function readLastMatchId() {
  try {
    const value = fs.readFileSync(LAST_MATCH_ID_PATH, 'utf8').trim();
    return value.length > 0 ? value : '';
  } catch {
    return '';
  }
}

function writeLastMatchId(matchId) {
  try {
    fs.mkdirSync(path.dirname(LAST_MATCH_ID_PATH), { recursive: true });
    fs.writeFileSync(LAST_MATCH_ID_PATH, matchId.trim(), 'utf8');
  } catch (err) {
    console.warn('[ASC Broadcast] could not persist last match id', err);
  }
}

function sendToShell(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(channel, payload);
}

function sendToPanel(channel, payload) {
  if (!panelView || panelView.webContents.isDestroyed()) {
    return;
  }
  panelView.webContents.send(channel, payload);
}

function pushObsStatus() {
  const snapshot = lifecycle.snapshot();
  sendToShell('asc:obs-status', snapshot);
  sendToPanel('asc:obs-status', snapshot);
}

lifecycle.onChange(() => {
  pushObsStatus();
  const now = obs.connection;
  if (now === 'connected' && lastObsConnection !== 'connected' && pendingOverlayMatchId) {
    void ensureAscOverlayForMatch(pendingOverlayMatchId);
  }
  lastObsConnection = now;
});

/**
 * Best-effort: point OBS “ASC Overlay” at this match. Soft-skips when disconnected.
 * @param {string} matchId
 */
async function ensureAscOverlayForMatch(matchId) {
  const trimmed = String(matchId ?? '').trim();
  if (!trimmed) {
    return;
  }
  pendingOverlayMatchId = trimmed;
  if (obs.connection !== 'connected') {
    console.warn('[OBS] ASC Overlay deferred until OBS connects.');
    return;
  }
  try {
    // Refresh scene/URL config from disk in case Settings changed since connect.
    obs.applyReplaySceneConfig(readObsConfig(userDataDir()));
    await obs.ensureAscOverlay(trimmed);
  } catch (err) {
    console.warn(
      '[OBS] ensureAscOverlay failed:',
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    if (obs.connection === 'connected' && pendingOverlayMatchId === trimmed) {
      pendingOverlayMatchId = null;
    }
  }
}

function contentBounds() {
  if (!mainWindow) {
    return { x: 0, y: SHELL_CHROME_HEIGHT, width: 1280, height: 740 };
  }
  const [width, height] = mainWindow.getContentSize();
  return {
    x: 0,
    y: SHELL_CHROME_HEIGHT,
    width,
    height: Math.max(0, height - SHELL_CHROME_HEIGHT),
  };
}

function ensurePanelView() {
  if (panelView) {
    return panelView;
  }
  panelView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, 'panel-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: DEVTOOLS_ENABLED,
      additionalArguments: [`--asc-cockpit-origin=${COCKPIT_BASE}`],
    },
  });
  lockToOrigin(panelView.webContents, COCKPIT_BASE);
  panelView.webContents.on('did-finish-load', () => {
    pushObsStatus();
  });
  return panelView;
}

function layoutPanelView() {
  if (!mainWindow || !panelView || !panelVisible) {
    return;
  }
  panelView.setBounds(contentBounds());
  panelView.setAutoResize({ width: true, height: true });
}

function showPanelView() {
  if (!mainWindow || !panelView || !panelVisible) {
    return;
  }
  mainWindow.setBrowserView(panelView);
  layoutPanelView();
}

function openObsSettings() {
  if (panelVisible && panelView && !panelView.webContents.isDestroyed()) {
    sendToPanel('asc:open-obs-settings');
    return;
  }
  sendToShell('asc:open-obs-settings');
}

/**
 * Load a cockpit-origin route in the BrowserView (the auth session lives there,
 * not in the file:// shell).
 * @param {string} route
 */
function loadPanelRoute(route) {
  if (!mainWindow) {
    return;
  }
  const view = ensurePanelView();
  panelVisible = true;
  void view.webContents.loadURL(`${COCKPIT_BASE}${route}`);
  showPanelView();
  sendToShell('asc:shell-state', {
    view: 'panel',
  });
  mainWindow.setTitle('ASC Broadcast');
}

/**
 * Broadcast home: Expo /broadcast-home (scoped tournament → match picker).
 * Unauthenticated sessions are redirected to /login by RootNavigator.
 */
function showBroadcastHome() {
  loadPanelRoute('/broadcast-home');
}

/**
 * Auth gate: load Expo /login in the BrowserView before broadcast home.
 * After login, RootNavigator's Electron branch calls returnToBroadcastHome.
 * If a session already exists, the same redirect fires immediately.
 */
function showLoginGate() {
  loadPanelRoute('/login');
}

/**
 * Embed the scoring cockpit for this match (graphics + scoring + in-page OBS).
 * @param {string} matchId
 */
function loadControlPanel(matchId) {
  const trimmed = String(matchId ?? '').trim();
  if (!trimmed || !mainWindow) {
    return;
  }
  writeLastMatchId(trimmed);
  const url = `${COCKPIT_BASE}/matches/${encodeURIComponent(trimmed)}/score`;
  const view = ensurePanelView();
  panelVisible = true;
  void view.webContents.loadURL(url);
  showPanelView();
  sendToShell('asc:shell-state', {
    view: 'panel',
    matchId: trimmed,
  });
  mainWindow.setTitle(`ASC Broadcast — ${trimmed}`);
  void ensureAscOverlayForMatch(trimmed);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: 'ASC Broadcast',
    backgroundColor: '#f4f1ec',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: DEVTOOLS_ENABLED,
    },
  });
  lockToShell(mainWindow.webContents, SHELL_FILE_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    panelView = null;
    panelVisible = false;
  });

  mainWindow.on('resize', () => {
    layoutPanelView();
  });

  void mainWindow.loadFile(SHELL_HTML_PATH);
  mainWindow.webContents.once('did-finish-load', () => {
    // Login first (BrowserView). Authenticated sessions redirect to broadcast home.
    showLoginGate();
    pushObsStatus();
    void lifecycle.ensureSession().catch(() => {
      // Status already pushed (wrong password / timeout / missing OBS).
    });
  });
}

async function handleConnect() {
  await lifecycle.ensureSession();
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              {
                label: 'OBS Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => openObsSettings(),
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Broadcast Home…',
          accelerator: 'CmdOrCtrl+O',
          click: () => showBroadcastHome(),
        },
        { type: 'separator' },
        {
          label: 'Start / Connect OBS',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            void handleConnect().catch(() => {
              // status already pushed
            });
          },
        },
        {
          label: 'Disconnect OBS',
          click: () => {
            void obs.disconnect();
          },
        },
        ...(!isMac
          ? [
              { type: 'separator' },
              {
                label: 'OBS Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => openObsSettings(),
              },
            ]
          : []),
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(DEVTOOLS_ENABLED ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/** Channels the file:// shell preload also calls; all others are cockpit-only. */
const SHELL_CHANNELS = new Set([
  'asc:obs-get-config',
  'asc:obs-save-config',
  'asc:obs-get-status',
  'asc:obs-connect',
  'asc:obs-disconnect',
  'asc:obs-start-stream',
  'asc:obs-stop-stream',
  'asc:obs-start-replay-buffer',
  'asc:obs-instant-replay',
  'asc:obs-return-to-live',
]);

/** @param {Electron.IpcMainEvent | Electron.IpcMainInvokeEvent} event @param {string} channel */
function trustedSender(event, channel) {
  const ok = isTrustedSender(event, {
    cockpitOrigin: COCKPIT_BASE,
    shellFileUrl: SHELL_FILE_URL,
    allowShell: SHELL_CHANNELS.has(channel),
  });
  if (!ok) {
    console.warn(`[ASC Broadcast] blocked ${channel} from ${event.senderFrame?.url ?? 'unknown frame'}`);
  }
  return ok;
}

/**
 * @param {string} channel
 * @param {(event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown} handler
 */
function handleTrusted(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trustedSender(event, channel)) {
      throw new Error('ASC Broadcast bridge is only available on the scoring cockpit.');
    }
    return handler(event, ...args);
  });
}

/**
 * @param {string} channel
 * @param {(event: Electron.IpcMainEvent, ...args: any[]) => void} listener
 */
function onTrusted(channel, listener) {
  ipcMain.on(channel, (event, ...args) => {
    if (trustedSender(event, channel)) {
      listener(event, ...args);
    }
  });
}

/** @param {unknown} candidate */
function clipPathOrNull(candidate) {
  return allowedClipPath(candidate, {
    clipsRoot: clipsRoot(userDataDir()),
    knownPaths: knownClipPaths,
  });
}

/** @param {unknown} raw */
function allowedClipPaths(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.flatMap((candidate) => {
    const allowed = clipPathOrNull(candidate);
    if (!allowed && typeof candidate === 'string' && candidate.trim()) {
      console.warn(`[ASC Broadcast] ignoring clip outside the clips folder: ${candidate}`);
    }
    return allowed ? [allowed] : [];
  });
}

function registerIpc() {
  onTrusted('asc:load-control-panel', (_event, matchId) => {
    loadControlPanel(matchId);
  });
  onTrusted('asc:show-broadcast-home', () => {
    showBroadcastHome();
  });

  handleTrusted('asc:obs-get-config', () => readObsConfig(userDataDir()));
  handleTrusted('asc:obs-save-config', (_event, raw) => {
    const config = writeObsConfig(userDataDir(), raw);
    obs.applyReplaySceneConfig(config);
    const matchId = pendingOverlayMatchId || readLastMatchId();
    if (matchId && obs.connection === 'connected') {
      void ensureAscOverlayForMatch(matchId);
    }
    return config;
  });
  handleTrusted('asc:obs-get-status', () => lifecycle.snapshot());

  handleTrusted('asc:obs-connect', async () => {
    await handleConnect();
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-disconnect', async () => {
    await obs.disconnect();
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-start-stream', async () => {
    await obs.startStream();
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-stop-stream', async () => {
    await obs.stopStream();
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-start-replay-buffer', async () => {
    lifecycle.replayBufferWarning = '';
    try {
      await obs.ensureReplayBuffer();
      lifecycle.replayBufferWarning = '';
    } catch (err) {
      lifecycle.replayBufferWarning =
        err instanceof Error
          ? err.message
          : 'Could not start the OBS replay buffer.';
      throw new Error(lifecycle.replayBufferWarning);
    } finally {
      lifecycle.emit();
    }
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-instant-replay', async () => {
    await obs.startInstantReplay();
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-save-boundary-clip', async (_event, payload) => {
    // Soft-skip when OBS is down — auto-clip is best-effort; do not reject IPC
    // (Electron logs "Error occurred in handler" for every rejected invoke).
    if (obs.connection !== 'connected') {
      console.warn('[OBS] Skipping boundary clip — not connected to OBS.');
      return null;
    }
    if (!obs.replayBufferActive) {
      console.warn('[OBS] Skipping boundary clip — replay buffer is not active.');
      return null;
    }
    const saved = await obs.saveBoundaryClip(payload, userDataDir());
    const savedReal = saved?.videoPath ? realPathOrNull(saved.videoPath) : null;
    if (savedReal) {
      knownClipPaths.add(savedReal);
    }
    return saved;
  });
  handleTrusted('asc:obs-play-delivery-clip', async (_event, payload) => {
    const videoPath = clipPathOrNull(payload?.videoPath);
    if (!videoPath) {
      throw new Error('That clip is not in the ASC Broadcast clips folder.');
    }
    await obs.playDeliveryClip({ ...payload, videoPath });
    return lifecycle.snapshot();
  });
  handleTrusted('asc:obs-play-file', async (_event, filePath) => {
    const allowed = clipPathOrNull(filePath);
    if (!allowed) {
      throw new Error('That clip is not in the ASC Broadcast clips folder.');
    }
    await obs.playFileOnAir(allowed);
    return lifecycle.snapshot();
  });
  handleTrusted('asc:build-highlight', async (_event, payload) => {
    const matchId = payload && typeof payload.matchId === 'string' ? payload.matchId : '';
    const matchFolderStamp =
      payload && typeof payload.matchFolderStamp === 'string' ? payload.matchFolderStamp : '';
    const clipPaths = allowedClipPaths(payload?.clipPaths);
    const kind = payload && payload.kind === 'full-match' ? 'full-match' : 'innings-1';
    return buildHighlight({
      matchId,
      matchFolderStamp,
      clipPaths,
      kind,
      userDataDir: userDataDir(),
    });
  });
  // Back-compat alias for older preloads.
  handleTrusted('asc:build-innings-highlight', async (_event, payload) => {
    const matchId = payload && typeof payload.matchId === 'string' ? payload.matchId : '';
    const matchFolderStamp =
      payload && typeof payload.matchFolderStamp === 'string' ? payload.matchFolderStamp : '';
    const clipPaths = allowedClipPaths(payload?.clipPaths);
    return buildHighlight({
      matchId,
      matchFolderStamp,
      clipPaths,
      kind: 'innings-1',
      userDataDir: userDataDir(),
    });
  });
  handleTrusted('asc:get-highlight', async (_event, payload) => {
    const matchId =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload.matchId === 'string'
          ? payload.matchId
          : '';
    const matchFolderStamp =
      payload && typeof payload === 'object' && typeof payload.matchFolderStamp === 'string'
        ? payload.matchFolderStamp
        : '';
    const kind =
      payload && typeof payload === 'object' && payload.kind === 'full-match'
        ? 'full-match'
        : 'innings-1';
    const highlightPath = readExistingHighlightPath(
      userDataDir(),
      matchId,
      matchFolderStamp,
      kind,
    );
    return {
      highlightPath,
      status: highlightPath ? 'ready' : 'empty',
      kind,
    };
  });
  handleTrusted('asc:get-innings-highlight', async (_event, matchId) => {
    const id = typeof matchId === 'string' ? matchId : '';
    const highlightPath = readExistingHighlightPath(userDataDir(), id, '', 'innings-1');
    return {
      highlightPath,
      status: highlightPath ? 'ready' : 'empty',
      kind: 'innings-1',
    };
  });
  handleTrusted('asc:obs-return-to-live', async () => {
    await obs.returnToLive({ reason: 'manual' });
    return lifecycle.snapshot();
  });
}

app.whenReady().then(() => {
  app.setName('ASC Broadcast');
  applyGlobalHardening(app, COCKPIT_BASE);
  registerIpc();
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  void lifecycle
    .shutdown({ stopStream: true })
    .catch((err) => {
      console.warn('[ASC Broadcast] OBS shutdown failed', err);
    })
    .finally(() => {
      app.quit();
    });
});
