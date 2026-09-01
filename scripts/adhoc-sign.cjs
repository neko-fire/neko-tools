const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Electron Builder skips macOS signing when no Developer ID certificate is
// installed. That leaves the bundle carrying the linker signature inherited
// from the Electron binary, which no longer matches the rewritten bundle, so
// macOS kills the app on launch as soon as it carries a quarantine flag.
// Ad-hoc signing gives the bundle a signature of its own that validates.
function codesign(codesignArguments, description) {
  const result = spawnSync('codesign', codesignArguments, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`codesign could not ${description} (exit ${result.status}).`);
}

exports.default = function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  codesign(['--force', '--deep', '--sign', '-', appPath], `sign ${appPath}`);
  codesign(['--verify', '--deep', '--strict', appPath], `verify ${appPath}`);
  console.log(`  • ad-hoc signed    ${appPath}`);
};
