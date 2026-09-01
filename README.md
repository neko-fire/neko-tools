# Toolkit

A local dark-mode utility app with a UTC timestamp converter and a UUIDv7
generator. Runs in the browser or as a macOS desktop app. Python owns all
conversion and ID generation, so both surfaces behave identically.

## TL;DR

```bash
python3 -m pip install -e '.[dev]'   # one-time
npm install                          # one-time
npm run web                          # browser at http://127.0.0.1:8000
npm run desktop                      # desktop app (development)
npm run package:mac                  # build dist/Toolkit-0.1.0-arm64.dmg
```

Install the built app by opening the DMG and dragging **Toolkit** to
Applications. A DMG you built yourself is not quarantined, so it opens
normally.

## Requirements

- macOS on Apple Silicon (the build targets the host architecture)
- Python 3.11+ and Node.js 18+
- No Python installation is needed to *run* the packaged app; the server is
  bundled into it.

## Architecture

- **Backend** — FastAPI app (`toolkit_api/`) serving JSON endpoints and the
  static UI. `POST /api/convert`, `POST /api/uuids`, `GET /api/health`.
- **Frontend** — framework-free HTML/CSS/JS in `static/`. It treats API
  responses as authoritative and never converts or generates IDs itself.
- **Desktop shell** — `electron/main.cjs` starts the bundled server on a free
  port, waits for `/api/health`, then loads the local page.
- **Packaging** — PyInstaller bundles the server into a standalone executable;
  Electron Builder wraps it into `Toolkit.app` and a DMG.

Each future tool gets a backend route module, a frontend panel, and a
`toolkit_api/features/manifest.py` entry. No plugin framework.

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

## Code signing

There is no Apple Developer ID on this machine, so Electron Builder skips
signing. Left alone that ships a bundle still carrying Electron's own linker
signature, which no longer matches the rewritten bundle — macOS then kills the
app on launch with "Toolkit is damaged and can't be opened."

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

## Manual checks

`tests/ui-smoke.md` covers the browser UI and accessibility;
`tests/electron-smoke.md` covers the desktop app and the packaged build.
