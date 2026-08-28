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
const port = 18765;

function getHealth() {
  return new Promise((resolve, reject) => {
    const request = http.get(`http://127.0.0.1:${port}/api/health`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.setTimeout(500, () => request.destroy(new Error('health request timed out')));
    request.on('error', reject);
  });
}

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await getHealth();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError || new Error('packaged server did not become ready');
}

function stopServer(server) {
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  return new Promise((resolve) => setTimeout(() => {
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
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
  const server = spawn(serverPath, ['--host', '127.0.0.1', '--port', String(port)], {
    cwd: cleanDirectory,
    env: environment,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  try {
    const health = await waitForHealth();
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
