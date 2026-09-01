const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

// Guards the packaging regression where Electron Builder shipped a bundle that
// still carried Electron's own linker signature. Such a bundle launches from
// the build directory but is killed by macOS once it is quarantined.
const projectDirectory = path.resolve(__dirname, '..');
const defaultAppPath = path.join(
  projectDirectory,
  'dist',
  process.arch === 'arm64' ? 'mac-arm64' : 'mac',
  'Toolkit.app',
);
const appPath = process.env.TOOLKIT_APP_PATH
  ? path.resolve(process.env.TOOLKIT_APP_PATH)
  : defaultAppPath;

function codesign(...codesignArguments) {
  return spawnSync('codesign', codesignArguments, { encoding: 'utf8' });
}

assert.ok(existsSync(appPath), `missing packaged app: ${appPath}`);
assert.ok(
  existsSync(path.join(appPath, 'Contents', 'Resources', 'server', 'toolkit-server', 'toolkit-server')),
  'packaged app is missing its bundled server executable',
);

const verification = codesign('--verify', '--deep', '--strict', appPath);
assert.equal(verification.status, 0, `packaged app has an invalid signature: ${verification.stderr.trim()}`);

const description = codesign('-dvv', appPath).stderr;
const identifier = (description.match(/^Identifier=(.+)$/m) || [])[1];
assert.equal(
  identifier,
  'com.martinbayer.toolkit',
  'packaged app carries an inherited signing identifier instead of its own',
);

console.log('packaged app signature test passed');
