const { app, BrowserWindow, dialog } = require('electron');
const { existsSync, copyFileSync, mkdirSync, appendFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

// Port khusus aplikasi desktop ini (beda dari port dev server 3001) supaya tidak
// bentrok kalau kebetulan dev server web/api masih jalan di komputer yang sama.
const PORT = 38271;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

// Banyak PC klinik pakai kartu grafis lawas/driver bermasalah — matikan akselerasi
// GPU supaya rendering selalu stabil (software rendering) daripada layar putih/hitam.
app.disableHardwareAcceleration();

function logError(context, err) {
  try {
    const logPath = join(app.getPath('userData'), 'error.log');
    const message = err instanceof Error ? (err.stack || err.message) : String(err);
    appendFileSync(logPath, `[${new Date().toISOString()}] ${context}: ${message}\n`);
  } catch {
    // tidak ada tempat lain untuk melapor — abaikan.
  }
}

function getServerDir() {
  // Saat sudah di-package: resources/server (di luar app.asar, sejajar dengannya).
  // Saat dev (npm run start di apps/desktop tanpa build): resources/server relatif ke folder ini.
  return app.isPackaged
    ? join(process.resourcesPath, 'server')
    : join(__dirname, '..', 'resources', 'server');
}

function ensureUserDatabase(serverDir) {
  const userDataDir = app.getPath('userData');
  mkdirSync(userDataDir, { recursive: true });
  const dbPath = join(userDataDir, 'labprima.db');
  if (!existsSync(dbPath)) {
    const templatePath = join(serverDir, 'template.db');
    copyFileSync(templatePath, dbPath);
  }
  return dbPath;
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // server belum siap, coba lagi
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function startServer() {
  const serverDir = getServerDir();
  const dbPath = ensureUserDatabase(serverDir);

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.PORT = String(PORT);
  process.env.HOST = HOST;
  process.env.CORS_ORIGIN = BASE_URL;

  const entry = join(serverDir, 'build', 'index.js');
  await import(pathToFileURL(entry).href);
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Klinik Prima Husada',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(BASE_URL);
}

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    logError('startServer', err);
    dialog.showErrorBox(
      'Gagal menjalankan server',
      err instanceof Error ? err.message : String(err),
    );
    app.quit();
    return;
  }

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    logError('waitForServer', new Error('timeout waiting for local server'));
    dialog.showErrorBox('Gagal memulai aplikasi', 'Server lokal tidak merespons. Coba buka ulang aplikasi.');
    app.quit();
    return;
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

process.on('uncaughtException', (err) => {
  logError('uncaughtException', err);
});
