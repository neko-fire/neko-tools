# Toolkit

A small local utility app with two tools: a **UTC timestamp converter** and a
**UUIDv7 generator**. It runs either in the browser or as a macOS desktop app.

Python owns all conversion and ID generation, so both surfaces behave
identically — the frontend never converts a timestamp or mints an ID itself.

## TL;DR

```bash
python3 -m pip install -e '.[dev]'   # one-time
npm install                          # one-time

npm run web          # browser at http://127.0.0.1:8000
npm run desktop      # desktop app, against your local Python
npm run package:mac  # build the installable macOS app + DMG
```

## What it does

**Timestamp converter** — accepts a Unix timestamp (seconds or milliseconds,
detected automatically) or an ISO 8601 date/time, and returns UTC ISO, the time
in a chosen zone, Unix seconds, Unix milliseconds, and a relative description
("3 days ago"). A time zone selector lists the platform's IANA zones and starts
on your computer's own zone. Every output value has its own Copy button.

**UUIDv7 generator** — generates 1–100 time-sortable UUIDv7 values in
generation order. Copy one, copy all, or clear the list. Nothing is persisted;
the list is gone after a reload or restart.

## Requirements

- macOS on Apple Silicon (the build targets the host architecture)
- Python 3.11+ and Node.js 18+

Running the *packaged* app needs no Python at all — the server is bundled into
it.

## Run it in the web

```bash
python3 -m pip install -e '.[dev]'   # one-time
npm run web
```

Then open <http://127.0.0.1:8000>. The server reloads on file changes, so this
is the fastest loop for working on the UI in `static/`.

To run the desktop shell against your local Python instead:

```bash
npm install    # one-time, installs Electron
npm run desktop
```

## Build the macOS app

```bash
python3 -m pip install -e '.[dev]'   # one-time, provides PyInstaller
npm install                          # one-time
npm run package:mac
```

That single command runs four stages:

1. **`package:server`** — PyInstaller bundles the FastAPI server, the Python
   runtime, and `static/` into a standalone executable at
   `build/server/toolkit-server/`.
2. **`test:packaged-server`** — launches that executable in a clean
   environment (only `HOME`, `PATH=/usr/bin:/bin`, `TMPDIR`) on a per-run port
   and requires `GET /api/health` to answer `200` from that exact process.
3. **`electron-builder --mac`** — wraps it into `Toolkit.app` and a DMG, then
   ad-hoc signs the bundle via the `afterPack` hook.
4. **`test:packaged-app`** — fails the build if the app's code signature is
   invalid.

Results:

- `dist/mac-arm64/Toolkit.app` — the app bundle
- `dist/Toolkit-0.1.0-arm64.dmg` — the installer

**To install:** open the DMG and drag **Toolkit** to Applications. A DMG you
built yourself is not quarantined, so it opens normally.

Because the UI is bundled into the server executable, changes to `static/`
require a rebuild before they appear in the packaged app.

## Code signing and Gatekeeper

There is no Apple Developer ID on this machine, so Electron Builder skips
signing. Left alone that ships a bundle still carrying Electron's own linker
signature, which no longer matches the rewritten bundle — macOS then kills the
app on launch with *"Toolkit is damaged and can't be opened."*

`scripts/adhoc-sign.cjs` runs as an `afterPack` hook and ad-hoc signs the
bundle so its signature is valid, and `npm run test:packaged-app` fails the
build if that ever regresses.

Ad-hoc signing is not notarization. If the DMG travels over the internet or
AirDrop it arrives quarantined, and Gatekeeper will refuse it. Clear the flag:

```bash
xattr -dr com.apple.quarantine /Applications/Toolkit.app
```

Distributing to other people properly would need a paid Developer ID
certificate plus notarization.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run web` | Run the browser app with reload on port 8000 |
| `npm run desktop` | Run the Electron app against local Python |
| `npm run test:python` | Run the Python test suite |
| `npm run package:server` | Build the standalone server executable |
| `npm run test:packaged-server` | Launch that executable in a clean environment |
| `npm run test:packaged-app` | Verify the packaged app's code signature |
| `npm run package:mac` | Full chain: server, smoke test, DMG, signature check |

## Layout

```
toolkit_api/            FastAPI app
  features/             conversion and generation logic (+ manifest)
  routes/               /api/convert, /api/uuids
static/                 framework-free UI (index.html, app.js, styles.css)
electron/main.cjs       desktop shell: starts the server, loads the page
scripts/build-server.cjs   PyInstaller build
scripts/adhoc-sign.cjs     afterPack ad-hoc signing hook
tests/                  Python tests, packaging tests, manual smoke checks
```

Each future tool gets a route module, a frontend panel, and a
`toolkit_api/features/manifest.py` entry. No plugin framework.

## API

- `GET /api/health` → `{"status": "ok"}`
- `POST /api/convert` → `{"value": "...", "local_timezone": "Europe/Berlin"}`
- `POST /api/uuids` → `{"count": 3}`

Validation errors return `422` with a `detail` string phrased as a recovery
instruction.

## Manual checks

`tests/ui-smoke.md` covers the browser UI and accessibility;
`tests/electron-smoke.md` covers the desktop app and the packaged build.
