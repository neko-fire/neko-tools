# Electron smoke check

Run `npm run desktop` from the repository root.

1. A window titled **Toolkit** opens at the local Toolkit URL and shows the Time
   Converter and UUID Generator panels.
2. Close the Toolkit window, then verify that its local server child process is
   no longer running.
3. For the packaged app, confirm `Toolkit.app/Contents/Resources/server/toolkit-server/toolkit-server`
   exists and that the app opens with no Python installation or Python packages
   available on the host.

For a distributable artifact, first install development dependencies with
`python -m pip install -e '.[dev]'`, then run `npm run package:mac`. This builds
the current-architecture PyInstaller executable, smoke-tests it with a clean
environment, packages it in the DMG, and opens no dependency on host Python.
