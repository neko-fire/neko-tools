const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const smokeTestPath = path.join(__dirname, 'packaged-server-smoke.cjs');
const port = 18765;

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function runSmokeAgainstFailedExecutable() {
  return new Promise((resolve, reject) => {
    const smoke = spawn(process.execPath, [smokeTestPath], {
      env: { ...process.env, TOOLKIT_SERVER_PATH: '/usr/bin/false' },
      stdio: 'ignore',
    });
    smoke.once('error', reject);
    smoke.once('exit', (code) => resolve(code));
  });
}

async function main() {
  const impostor = http.createServer((request, response) => {
    if (request.url === '/api/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"status":"ok"}');
      return;
    }
    response.writeHead(404).end();
  });
  await listen(impostor);
  try {
    const exitCode = await runSmokeAgainstFailedExecutable();
    assert.notEqual(
      exitCode,
      0,
      'smoke test accepted a pre-existing health server after its spawned executable failed',
    );
  } finally {
    await close(impostor);
  }
}

main().then(
  () => console.log('packaged server smoke regression test passed'),
  (error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  },
);
