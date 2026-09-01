const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
// macOS scans a newly installed binary on its first launch, which can take
// far longer than a warm start, so the first run needs a generous budget.
const STARTUP_TIMEOUT_MS = 60_000;

let mainWindow;
let serverProcess;
let isQuitting = false;

function pythonCommand() {
  return process.env.TOOLKIT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
}

// A fixed port would let a leftover or unrelated process answer the health
// check, so the window could load a stale server instead of this one.
function reservePort() {
  return new Promise((resolve, reject) => {
    const reservation = net.createServer();
    reservation.once('error', reject);
    reservation.listen(0, HOST, () => {
      const { port } = reservation.address();
      reservation.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function checkHealth(port) {
  return new Promise((resolve) => {
    const request = http.get(`http://${HOST}:${port}/api/health`, (response) => {
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

async function waitForHealth(port) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode === null && await checkHealth(port)) return;
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`The Toolkit server stopped during startup (exit ${serverProcess.exitCode}).`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Toolkit did not become ready on port ${port}.`);
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  serverProcess = undefined;
}

function serverCommand(port) {
  if (app.isPackaged) {
    return {
      command: path.join(process.resourcesPath, 'server', 'toolkit-server', 'toolkit-server'),
      commandArguments: ['--host', HOST, '--port', String(port)],
      cwd: process.resourcesPath,
    };
  }
  return {
    command: pythonCommand(),
    commandArguments: ['-m', 'uvicorn', 'toolkit_api.main:app', '--host', HOST, '--port', String(port)],
    cwd: path.resolve(__dirname, '..'),
  };
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const { command, commandArguments, cwd } = serverCommand(port);
    serverProcess = spawn(command, commandArguments, { cwd, stdio: 'ignore' });
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
    const port = await reservePort();
    await startServer(port);
    await waitForHealth(port);
    await window.loadURL(`http://${HOST}:${port}`);
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
