const assert = require('node:assert');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

// Guards the packaging regressions that only show up in a built bundle: a
// signature macOS will reject once the app is quarantined, a missing page
// asset, or a binary that only runs on the machine that built it.
const projectDirectory = path.resolve(__dirname, '..');
const appPath = process.env.TOOLKIT_APP_PATH
  ? path.resolve(process.env.TOOLKIT_APP_PATH)
  : path.join(projectDirectory, 'dist', 'Toolkit.app');

const built = existsSync(appPath);
const options = { skip: built ? false : `no built app at ${appPath} (run npm run build)` };

test('the bundle carries every file the page needs', options, () => {
  for (const relativePath of [
    'Contents/MacOS/Toolkit',
    'Contents/Info.plist',
    'Contents/Resources/icon.icns',
    'Contents/Resources/static/index.html',
    'Contents/Resources/static/styles.css',
    'Contents/Resources/static/app.js',
    'Contents/Resources/static/toolkit-core.js',
  ]) {
    assert.ok(existsSync(path.join(appPath, relativePath)), `missing ${relativePath}`);
  }
});

test('the page references no absolute or remote assets', options, () => {
  const html = readFileSync(path.join(appPath, 'Contents', 'Resources', 'static', 'index.html'), 'utf8');

  // file:// has no document root, so an absolute path silently loads nothing.
  assert.doesNotMatch(html, /(?:src|href)="\//, 'absolute asset path will not resolve under file://');
  assert.doesNotMatch(html, /(?:src|href)="https?:/, 'the app must not depend on the network');
});

test('the app runs on both architectures', options, () => {
  const architectures = spawnSync('lipo', ['-archs', path.join(appPath, 'Contents', 'MacOS', 'Toolkit')], {
    encoding: 'utf8',
  }).stdout.trim().split(/\s+/);

  assert.ok(architectures.includes('arm64'), `missing arm64 slice: ${architectures}`);
  assert.ok(architectures.includes('x86_64'), `missing x86_64 slice: ${architectures}`);
});

test('the signature validates and is the app\'s own', options, () => {
  const verification = spawnSync('codesign', ['--verify', '--deep', '--strict', appPath], { encoding: 'utf8' });
  assert.equal(verification.status, 0, `invalid signature: ${verification.stderr.trim()}`);

  const description = spawnSync('codesign', ['-dvv', appPath], { encoding: 'utf8' }).stderr;
  const identifier = (description.match(/^Identifier=(.+)$/m) || [])[1];
  assert.equal(identifier, 'com.martinbayer.toolkit', 'bundle carries an inherited signing identifier');
});
