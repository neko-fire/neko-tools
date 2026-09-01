const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const projectDirectory = path.resolve(__dirname, '..');
const serverPath = process.env.TOOLKIT_SERVER_PATH
  ? path.resolve(process.env.TOOLKIT_SERVER_PATH)
  : path.join(projectDirectory, 'build', 'server', 'toolkit-server', 'toolkit-server');
const host = '127.0.0.1';

function reservePort() {
  return new Promise((resolve, reject) => {
    const reservation = http.createServer();
    reservation.once('error', reject);
    reservation.listen(0, host, () => {
      const { port } = reservation.address();
      reservation.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function getHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.get(`http://${host}:${port}/api/health`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.setTimeout(500, () => request.destroy(new Error('health request timed out')));
    request.on('error', reject);
  });
}

async function waitForHealth(port, server) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`bundled server exited before becoming healthy (exit=${server.exitCode}, signal=${server.signalCode})`);
    }
    try {
      return await getHealth(port);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError || new Error('packaged server did not become ready');
}

function stopServer(server) {
  const signal = (name) => {
    if (server.pid && process.platform !== 'win32') {
      try {
        process.kill(-server.pid, name);
        return;
      } catch {
        // The child may have exited before its process group was signalled.
      }
    }
    server.kill(name);
  };
  if (server.exitCode === null && server.signalCode === null) signal('SIGTERM');
  return new Promise((resolve) => setTimeout(() => {
    if (server.exitCode === null && server.signalCode === null) signal('SIGKILL');
    server.unref();
    resolve();
  }, 500));
}

async function main() {
  assert.ok(existsSync(serverPath), `missing bundled server executable: ${serverPath}`);

  const cleanDirectory = mkdtempSync(path.join(os.tmpdir(), 'toolkit-server-smoke-'));
  const environment = {
    HOME: cleanDirectory,
    PATH: '/usr/bin:/bin',
    TMPDIR: os.tmpdir(),
  };
  const port = await reservePort();
  const server = spawn(serverPath, ['--host', host, '--port', String(port)], {
    cwd: cleanDirectory,
    detached: process.platform !== 'win32',
    env: environment,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  try {
    const health = await waitForHealth(port, server);
    assert.equal(server.exitCode, null, 'bundled server exited before its health response was accepted');
    assert.equal(server.signalCode, null, 'bundled server was signalled before its health response was accepted');
    assert.equal(health.statusCode, 200);
    assert.deepEqual(JSON.parse(health.body), { status: 'ok' });
  } finally {
    await stopServer(server);
  }
}

main().then(
  () => console.log('packaged server smoke test passed'),
  (error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  },
);
