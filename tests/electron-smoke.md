# Electron smoke check

## Development

Run `npm run desktop` from the repository root.

1. A window titled **Toolkit** opens on the local Toolkit URL and shows the
   Timestamp converter and UUIDv7 generator panels.
2. Close the Toolkit window, then verify that its local server child process is
   no longer running.
3. Launch the app twice in a row. Each launch picks its own free port, so a
   leftover server can never be mistaken for the one just started.

## Packaged build

First install development dependencies with
`python3 -m pip install -e '.[dev]'`, then run `npm run package:mac`. This
builds the host-architecture PyInstaller executable, smoke-tests it in a clean
environment, packages the DMG, and verifies the app's code signature.

Automated stages (part of `npm run package:mac`):

- `npm run test:packaged-server` launches the bundled executable with only
  `HOME`, `PATH=/usr/bin:/bin`, and `TMPDIR`, on a per-run port, and requires
  `GET /api/health` to return `200` from that exact process.
- `npm run test:packaged-app` requires `codesign --verify --deep --strict` to
  pass and the signing identifier to be `com.martinbayer.toolkit`, not an
  identifier inherited from Electron.

Then confirm by hand:

1. Open `dist/Toolkit-0.1.0-arm64.dmg` and drag **Toolkit** to Applications.
2. Launch it and confirm both panels work with no Python installed on the host.
3. Quit the app and confirm no `toolkit-server` process remains.

A DMG you built locally is not quarantined and opens normally. A DMG that
arrives over the internet or AirDrop is quarantined, and because the app is
ad-hoc signed rather than notarized Gatekeeper will refuse to launch it until
the flag is cleared with
`xattr -dr com.apple.quarantine /Applications/Toolkit.app`.
