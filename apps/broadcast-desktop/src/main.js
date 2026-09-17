/**
 * ASC Broadcast — Electron main process.
 * Match-ID entry shell + full-window BrowserView scoring cockpit.
 * OBS via IPC → ObsController (in-cockpit Broadcast/OBS block + Settings).
 */

const { app, BrowserWindow, BrowserView, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { readObsConfig, writeObsConfig } = require('./obs-config');
const { ObsController } = require('./obs-client');
const { ObsLifecycle } = require('./obs-lifecycle');
const {
  buildHighlight,
  readExistingHighlightPath,
} = require('./innings-highlight');

/** Scoring cockpit origin (Expo web). Deployable URL swapped via env later. */
const COCKPIT_BASE =
  process.env.ASC_COCKPIT_URL?.replace(/\/$/, '') || 'http://localhost:8081';

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
});

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
    },
  });
  panelView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });
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

function hidePanelView() {
  if (!mainWindow || !panelView) {
    return;
  }
  mainWindow.removeBrowserView(panelView);
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

function showMatchIdEntry() {
  panelVisible = false;
  hidePanelView();
  sendToShell('asc:shell-state', {
    view: 'match',
    lastMatchId: readLastMatchId(),
  });
  if (mainWindow) {
    mainWindow.setTitle('ASC Broadcast');
  }
}

/**
 * Auth gate: load Expo /login in the BrowserView before match entry.
 * After login, RootNavigator's Electron branch calls returnToBroadcastHome → match entry.
 * If a session already exists, the same redirect fires immediately.
 */
function showLoginGate() {
  if (!mainWindow) {
    return;
  }
  const view = ensurePanelView();
  panelVisible = true;
  void view.webContents.loadURL(`${COCKPIT_BASE}/login`);
  showPanelView();
  sendToShell('asc:shell-state', {
    view: 'panel',
  });
  mainWindow.setTitle('ASC Broadcast');
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
    },
  });

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

  void mainWindow.loadFile(path.join(__dirname, 'shell.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    // Login first (BrowserView). Authenticated sessions redirect to match entry.
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
          label: 'Enter Match ID…',
          accelerator: 'CmdOrCtrl+O',
          click: () => showMatchIdEntry(),
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
        { role: 'toggleDevTools' },
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

function registerIpc() {
  ipcMain.on('asc:load-control-panel', (_event, matchId) => {
    loadControlPanel(matchId);
  });
  ipcMain.on('asc:show-match-entry', () => {
    showMatchIdEntry();
  });

  ipcMain.handle('asc:obs-get-config', () => readObsConfig(userDataDir()));
  ipcMain.handle('asc:obs-save-config', (_event, raw) => {
    const config = writeObsConfig(userDataDir(), raw);
    obs.applyReplaySceneConfig(config);
    return config;
  });
  ipcMain.handle('asc:obs-get-status', () => lifecycle.snapshot());

  ipcMain.handle('asc:obs-connect', async () => {
    await handleConnect();
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-disconnect', async () => {
    await obs.disconnect();
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-start-stream', async () => {
    await obs.startStream();
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-stop-stream', async () => {
    await obs.stopStream();
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-start-replay-buffer', async () => {
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
  ipcMain.handle('asc:obs-instant-replay', async () => {
    await obs.startInstantReplay();
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-save-boundary-clip', async (_event, payload) => {
    return obs.saveBoundaryClip(payload, userDataDir());
  });
  ipcMain.handle('asc:obs-play-delivery-clip', async (_event, payload) => {
    await obs.playDeliveryClip(payload ?? {});
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:obs-play-file', async (_event, filePath) => {
    await obs.playFileOnAir(typeof filePath === 'string' ? filePath : '');
    return lifecycle.snapshot();
  });
  ipcMain.handle('asc:build-highlight', async (_event, payload) => {
    const matchId = payload && typeof payload.matchId === 'string' ? payload.matchId : '';
    const matchFolderStamp =
      payload && typeof payload.matchFolderStamp === 'string' ? payload.matchFolderStamp : '';
    const clipPaths = payload && Array.isArray(payload.clipPaths) ? payload.clipPaths : [];
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
  ipcMain.handle('asc:build-innings-highlight', async (_event, payload) => {
    const matchId = payload && typeof payload.matchId === 'string' ? payload.matchId : '';
    const matchFolderStamp =
      payload && typeof payload.matchFolderStamp === 'string' ? payload.matchFolderStamp : '';
    const clipPaths = payload && Array.isArray(payload.clipPaths) ? payload.clipPaths : [];
    return buildHighlight({
      matchId,
      matchFolderStamp,
      clipPaths,
      kind: 'innings-1',
      userDataDir: userDataDir(),
    });
  });
  ipcMain.handle('asc:get-highlight', async (_event, payload) => {
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
  ipcMain.handle('asc:get-innings-highlight', async (_event, matchId) => {
    const id = typeof matchId === 'string' ? matchId : '';
    const highlightPath = readExistingHighlightPath(userDataDir(), id, '', 'innings-1');
    return {
      highlightPath,
      status: highlightPath ? 'ready' : 'empty',
      kind: 'innings-1',
    };
  });
  ipcMain.handle('asc:obs-return-to-live', async () => {
    await obs.returnToLive({ reason: 'manual' });
    return lifecycle.snapshot();
  });
}

app.whenReady().then(() => {
  app.setName('ASC Broadcast');
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
