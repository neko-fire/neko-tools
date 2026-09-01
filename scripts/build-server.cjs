const { mkdirSync, rmSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectDirectory = path.resolve(__dirname, '..');
const buildDirectory = path.join(projectDirectory, 'build');
const distDirectory = path.join(buildDirectory, 'server');
const pyinstallerDirectory = path.join(buildDirectory, 'pyinstaller');
const pyinstallerConfigDirectory = path.join(buildDirectory, 'pyinstaller-config');
const python = process.env.TOOLKIT_PYTHON || process.env.PYTHON || 'python3';
const staticData = `${path.join(projectDirectory, 'static')}${path.delimiter}static`;

rmSync(distDirectory, { force: true, recursive: true });
rmSync(pyinstallerDirectory, { force: true, recursive: true });
rmSync(pyinstallerConfigDirectory, { force: true, recursive: true });
mkdirSync(distDirectory, { recursive: true });
mkdirSync(pyinstallerDirectory, { recursive: true });
mkdirSync(pyinstallerConfigDirectory, { recursive: true });

const result = spawnSync(python, [
  '-m', 'PyInstaller',
  '--noconfirm',
  '--clean',
  '--name', 'toolkit-server',
  '--add-data', staticData,
  '--paths', projectDirectory,
  '--distpath', distDirectory,
  '--workpath', pyinstallerDirectory,
  '--specpath', pyinstallerDirectory,
  path.join(projectDirectory, 'toolkit_api', 'server.py'),
], {
  cwd: projectDirectory,
  env: { ...process.env, PYINSTALLER_CONFIG_DIR: pyinstallerConfigDirectory },
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
