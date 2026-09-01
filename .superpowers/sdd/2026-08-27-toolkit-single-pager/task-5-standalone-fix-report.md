# Task 5 — Standalone Electron Server Packaging Report

## Outcome

Implemented the standalone-server packaging path and rebuilt the arm64 DMG.
The final clean-environment health probe passed for both the build output and
the executable copied into `Toolkit.app`.

## Design implemented

- `scripts/build-server.cjs` builds a current-host-architecture PyInstaller
  **one-directory** server at `build/server/toolkit-server/toolkit-server`.
  The one-directory form was selected after the one-file bootloader failed in
  this environment with `Failed to initialize sync semaphore` / `semctl:
  Operation not permitted`.
- The bundle includes Python, FastAPI/Uvicorn/uuid6, Toolkit code, and `static/`.
  `toolkit_api.main` uses PyInstaller's `sys._MEIPASS/static` when frozen.
- Packaged Electron launches only
  `Contents/Resources/server/toolkit-server/toolkit-server`; development retains
  the documented local `python -m uvicorn ...` command.
- `package:mac` first builds and runs the standalone smoke test, then invokes
  Electron Builder. It no longer copies Python source, `pyproject.toml`, or
  loose static files into Electron resources.
- Added `tests/packaged-server-smoke.cjs`, which launches the executable from a
  fresh temporary working directory with only `HOME`, `PATH=/usr/bin:/bin`, and
  `TMPDIR`, then requires `GET /api/health` to return `200` and
  `{"status":"ok"}`.

## RED evidence

Command:

```text
node tests/packaged-server-smoke.cjs
```

Output:

```text
AssertionError [ERR_ASSERTION]: missing bundled server executable:
/Users/martinbayer/mainworkspace/toolkit/.worktrees/toolkit-single-pager/build/server/toolkit-server
```

After changing the expected packaging layout to the one-directory executable,
the test again failed before its implementation output existed:

```text
AssertionError [ERR_ASSERTION]: missing bundled server executable:
/Users/martinbayer/mainworkspace/toolkit/.worktrees/toolkit-single-pager/build/server/toolkit-server/toolkit-server
```

## Build evidence

Command:

```text
npm run package:server
```

Relevant output:

```text
PyInstaller: 6.22.2
Python: 3.14.6
Platform: macOS-26.6-arm64-arm-64bit-Mach-O
EXE target arch: arm64
Build complete! The results are available in: .../build/server
```

Artifact inspection:

```text
build/server/toolkit-server/toolkit-server: Mach-O 64-bit executable arm64
```

A direct clean-environment launch of this executable remained running until
terminated by the task harness, which establishes that the bundled server can
start without a host Python interpreter path:

```text
env -i HOME=/private/tmp PATH=/usr/bin:/bin TMPDIR=/private/tmp \
  ./build/server/toolkit-server/toolkit-server --host 127.0.0.1 --port 18765
```

## GREEN / final package evidence

The final required command was:

```text
npm run package:mac
```

It rebuilt the arm64 PyInstaller server, passed the required smoke-test stage,
and completed Electron Builder:

```text
npm notice run toolkit-desktop@0.1.0 test:packaged-server
npm notice run node tests/packaged-server-smoke.cjs
packaged server smoke test passed
• packaging       platform=darwin arch=arm64 electron=37.10.3 appOutDir=dist/mac-arm64
• building        target=DMG arch=arm64 file=dist/Toolkit-0.1.0-arm64.dmg
• building block map  blockMapFile=dist/Toolkit-0.1.0-arm64.dmg.blockmap
```

The final resource-path assertion was also run with:

```text
TOOLKIT_SERVER_PATH='dist/mac-arm64/Toolkit.app/Contents/Resources/server/toolkit-server/toolkit-server' \
  npm run test:packaged-server
```

It printed `packaged server smoke test passed`; the resource executable was
identified as `Mach-O 64-bit executable arm64`. Electron is configured to launch
that exact path in packaged mode. The package no longer declares loose
`toolkit_api`, `static`, or `pyproject.toml` resources, so it has no runtime
dependency on a host Python installation or host-installed Python packages.

## Changed files

- `.gitignore`
- `electron/main.cjs`
- `package.json`
- `pyproject.toml`
- `scripts/build-server.cjs`
- `tests/packaged-server-smoke.cjs`
- `tests/electron-smoke.md`
- `toolkit_api/main.py`
- `toolkit_api/server.py`

## Signing limitation

PyInstaller reported `Code signing identity: None`; it ad-hoc signed the arm64
server executable. No Developer ID signing, notarization, or stapling was
configured or verified. This is separate from the unresolved health probe.

## Commit

- `4c1e4f7 fix: bundle standalone Electron server`
- This report is committed separately immediately after this update.

## Round 1: Smoke-test false-positive hardening

### Issue

The first smoke test used the fixed port `18765` and accepted only an HTTP
health response. A pre-existing process on that port could therefore satisfy
the assertion even if the bundled executable failed immediately.

### RED reproduction

Added `tests/packaged-server-smoke-regression.cjs`. It binds an impostor HTTP
server on `127.0.0.1:18765`, returns the expected health JSON, and invokes the
smoke test with `TOOLKIT_SERVER_PATH=/usr/bin/false`.

Command:

```text
node tests/packaged-server-smoke-regression.cjs
```

Pre-fix output:

```text
AssertionError [ERR_ASSERTION]: smoke test accepted a pre-existing health server after its spawned executable failed
```

### Fix

`tests/packaged-server-smoke.cjs` now:

- reserves an OS-selected loopback port for each run and passes that exact port
  to the executable and health client;
- rejects startup immediately when the spawned child has exited or been
  signalled;
- asserts that the child remains alive at the instant its `200` health response
  is accepted; and
- starts the child in a dedicated process group and terminates that group during
  cleanup, preventing later runs from inheriting a stale server.

This combination binds the health response to the process under test by an
isolated per-run port and lifecycle checks; the fixed-port impostor cannot
satisfy it.

### GREEN evidence

Focused regression:

```text
node tests/packaged-server-smoke-regression.cjs
packaged server smoke regression test passed
```

Bundled-build smoke:

```text
npm run test:packaged-server
INFO:     Uvicorn running on http://127.0.0.1:52148 (Press CTRL+C to quit)
INFO:     127.0.0.1:52151 - "GET /api/health HTTP/1.1" 200 OK
packaged server smoke test passed
```

Package verification:

```text
npm run package:mac
PyInstaller: 6.22.2
Platform: macOS-26.6-arm64-arm-64bit-Mach-O
EXE target arch: arm64
packaged server smoke test passed
• building        target=DMG arch=arm64 file=dist/Toolkit-0.1.0-arm64.dmg
```

Copied-resource clean-environment verification:

```text
TOOLKIT_SERVER_PATH='dist/mac-arm64/Toolkit.app/Contents/Resources/server/toolkit-server/toolkit-server' npm run test:packaged-server
INFO:     Uvicorn running on http://127.0.0.1:63811 (Press CTRL+C to quit)
INFO:     127.0.0.1:63832 - "GET /api/health HTTP/1.1" 200 OK
packaged server smoke test passed
```

### Round 1 commit

Recorded after this report update is committed.
