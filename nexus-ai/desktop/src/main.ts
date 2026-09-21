import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, Notification, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

const DEV = !!process.env.NEXUS_DEV;
const DEV_URL = 'http://localhost:3000';
const API = 'http://localhost:5000';

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let backendProc: ChildProcess | null = null;

// Simple persisted settings (avoids electron-store ESM friction)
const settingsPath = () => path.join(app.getPath('userData'), 'nexus-settings.json');
function loadSettings(): Record<string, any> {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')); } catch { return {}; }
}
function saveSettings(s: Record<string, any>) {
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
}

function pingBackend(): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`${API}/api/status`, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

async function ensureBackend() {
  if (await pingBackend()) return;
  // In prod, spawn the backend if the bundle exists
  const serverJs = path.join(__dirname, '..', '..', 'backend', 'dist', 'server.js');
  if (!DEV && fs.existsSync(serverJs)) {
    backendProc = spawn(process.execPath, [serverJs], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'ignore', detached: true
    });
    backendProc.unref();
    // wait for it to come up
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await pingBackend()) break;
    }
  }
}

function loadIcon(): Electron.NativeImage {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  // 16px fallback dot
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKUlEQVR4nGP8//8/AzGAiShVDAwM/0kBI0YMjAx0Bvz//58BqKqqAgCCoB/9mX1KAAAAAABJRU5ErkJggg=='
  );
}

function createWindow(startHidden: boolean) {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#04071100',
    show: !startHidden,
    icon: loadIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (DEV) {
    win.loadURL(DEV_URL);
  } else {
    win.loadFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
  }

  win.on('close', (e) => {
    // minimize to tray instead of quit
    if (!(app as any).isQuitting) {
      e.preventDefault();
      win?.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    win.show();
    win.focus();
    win.webContents.send('nexus:toggle-mic');
  }
}

app.whenReady().then(async () => {
  const startMinimized = process.argv.includes('--minimized') || loadSettings().startMinimized;
  await ensureBackend();
  createWindow(!!startMinimized);

  tray = new Tray(loadIcon());
  tray.setToolTip('NEXUS AI');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / Hide (Ctrl+Space)', click: toggleWindow },
    { type: 'separator' },
    {
      label: 'Launch at login', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked });
        const s = loadSettings(); s.openAtLogin = item.checked; saveSettings(s);
      }
    },
    {
      label: 'Start minimized', type: 'checkbox',
      checked: !!loadSettings().startMinimized,
      click: (item) => { const s = loadSettings(); s.startMinimized = item.checked; saveSettings(s); }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { (app as any).isQuitting = true; app.quit(); } }
  ]));
  tray.on('click', toggleWindow);

  // Global Ctrl+Space — show+focus window and toggle mic
  globalShortcut.register('Control+Space', toggleWindow);

  ipcMain.handle('nexus:notify', (_e, title: string, body: string) => {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  });
  ipcMain.handle('nexus:set-open-at-login', (_e, on: boolean) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    const s = loadSettings(); s.openAtLogin = !!on; saveSettings(s);
    return true;
  });
  ipcMain.handle('nexus:get-open-at-login', () => app.getLoginItemSettings().openAtLogin);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  backendProc?.kill();
});

app.on('window-all-closed', () => { /* keep running in tray */ });
