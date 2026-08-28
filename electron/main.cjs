const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 8765;
const HEALTH_URL = `http://${HOST}:${PORT}/api/health`;
const STARTUP_TIMEOUT_MS = 10_000;

let mainWindow;
let serverProcess;
let isQuitting = false;

function pythonCommand() {
  return process.env.TOOLKIT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

function checkHealth() {
  return new Promise((resolve) => {
    const request = http.get(HEALTH_URL, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(500, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForHealth() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await checkHealth()) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Toolkit did not become ready at ${HEALTH_URL}.`);
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  serverProcess = undefined;
}

function serverCommand() {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, 'server', 'toolkit-server', 'toolkit-server'),
      arguments: ['--host', HOST, '--port', String(PORT)],
      cwd: process.resourcesPath,
    };
  }
  return {
    command: pythonCommand(),
    arguments: ['-m', 'uvicorn', 'toolkit_api.main:app', '--host', HOST, '--port', String(PORT)],
    cwd: path.resolve(__dirname, '..'),
  };
}

function startServer() {
  return new Promise((resolve, reject) => {
    const { command, arguments, cwd } = serverCommand();
    serverProcess = spawn(command, arguments, { cwd, stdio: 'ignore' });
    serverProcess.once('error', (error) => {
      stopServer();
      reject(new Error(`Could not run ${command}: ${error.message}`));
    });
    serverProcess.once('spawn', resolve);
  });
}

function recoveryPage(error) {
  const message = String(error.message || error).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const html = `<!doctype html><html><body style="margin:0;background:#101113;color:#f4f4f5;font:16px -apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;height:100vh"><main style="max-width:480px;padding:32px"><h1>Unable to start Toolkit</h1><p>Please quit and restart the app. If this continues, reinstall Toolkit.</p><p style="color:#a1a1aa;font-family:ui-monospace,monospace">${message}</p></main></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Toolkit',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#101113',
    width: 1180,
    height: 780,
    minWidth: 760,
    minHeight: 620,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
    if (!isQuitting) stopServer();
  });
  return mainWindow;
}

async function openToolkitWindow() {
  const window = createWindow();
  try {
    await startServer();
    await waitForHealth();
    await window.loadURL(`http://${HOST}:${PORT}`);
  } catch (error) {
    stopServer();
    await window.loadURL(recoveryPage(error));
  }
}

app.whenReady().then(openToolkitWindow);

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    openToolkitWindow();
  }
});
