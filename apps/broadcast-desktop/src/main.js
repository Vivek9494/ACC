/**
 * ASC Broadcast — Electron main process.
 * Step 1: hosted control panel. Step 2: obs-websocket v5 control.
 * Step 3: OBS lifecycle (background launch / auto-connect / clean quit).
 * Instant Replay: save buffer → Replay scene → auto/manual return to live.
 * Not in this step: clip tagging bridge, Studio Mode transitions.
 */

const { app, BrowserWindow, BrowserView, Menu, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { readObsConfig, writeObsConfig } = require('./obs-config');
const { ObsController } = require('./obs-client');
const { ObsLifecycle } = require('./obs-lifecycle');

const CONTROL_PANEL_BASE =
  process.env.ASC_CONTROL_PANEL_URL?.replace(/\/$/, '') ||
  'https://acc-overlay.netlify.app';

/** Must match `header` height in shell.html / shell.css */
const SHELL_CHROME_HEIGHT = 132;

const LAST_MATCH_ID_PATH = path.join(app.getPath('userData'), 'last-match-id.txt');

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {BrowserView | null} */
let panelView = null;
let panelVisible = false;
let settingsOpen = false;

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

function pushObsStatus() {
  sendToShell('asc:obs-status', lifecycle.snapshot());
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
  return panelView;
}

function layoutPanelView() {
  if (!mainWindow || !panelView || !panelVisible || settingsOpen) {
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
  if (!mainWindow || !panelView || !panelVisible || settingsOpen) {
    return;
  }
  mainWindow.setBrowserView(panelView);
  layoutPanelView();
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
 * @param {string} matchId
 */
function loadControlPanel(matchId) {
  const trimmed = String(matchId ?? '').trim();
  if (!trimmed || !mainWindow) {
    return;
  }
  writeLastMatchId(trimmed);
  const url = `${CONTROL_PANEL_BASE}/control.html?matchId=${encodeURIComponent(trimmed)}`;
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
    sendToShell('asc:shell-state', {
      view: 'match',
      lastMatchId: readLastMatchId(),
    });
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
                click: () => sendToShell('asc:open-obs-settings'),
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
                click: () => sendToShell('asc:open-obs-settings'),
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
  ipcMain.handle('asc:obs-return-to-live', async () => {
    await obs.returnToLive({ reason: 'manual' });
    return lifecycle.snapshot();
  });

  ipcMain.on('asc:settings-open', (_event, open) => {
    settingsOpen = Boolean(open);
    if (settingsOpen) {
      hidePanelView();
    } else {
      showPanelView();
    }
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
