# Toolkit

A small macOS utility app with two tools: a **UTC timestamp converter** and a
**UUIDv7 generator**.

It is a native window around a local HTML page. There is no server, no bundled
runtime, and no network access — the whole app is 404 KB.

## TL;DR

```bash
npm test             # run the test suite (Node's built-in runner, no installs)
npm run dev          # open the page in Safari, the fastest loop for UI work
npm run build        # build dist/Toolkit.app
npm run package:mac  # build, test, and produce the DMG
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

- macOS 12 or later (Intel or Apple silicon — the app ships universal)
- To build: the Xcode Command Line Tools (`xcode-select --install`)
- To run the tests: Node.js 18+

No Python, no `npm install` — the project has zero dependencies.

## How it is put together

```
native/main.swift       the app: an NSWindow hosting a WKWebView
native/Info.plist       bundle metadata
native/assets/icon.icns app icon
static/toolkit-core.js  timestamp + UUIDv7 logic, no DOM access
static/app.js           wires the page to the core
static/index.html       the single page
static/styles.css       styling
scripts/build-app.sh    compiles the universal binary, assembles the .app
scripts/build-dmg.sh    wraps the .app into a DMG
tests/                  logic tests, packaging tests, manual smoke checks
```

`toolkit-core.js` holds all the logic and touches neither the DOM nor the
network, so the tests import it directly with no browser and no harness. It is
loaded as a plain `<script>` in the app and via `require` in tests.

Adding a tool means a function in `toolkit-core.js`, a panel in `index.html`,
and its wiring in `app.js`. No plugin framework.

## Build the macOS app

```bash
npm run package:mac
```

Three stages:

1. **`build`** — `swiftc` compiles `native/main.swift` once per architecture,
   `lipo` fuses them into a universal binary, and the `.app` is assembled and
   ad-hoc signed.
2. **`test`** — the logic suite plus `tests/packaged-app.test.js`, which checks
   the built bundle: every asset present, no absolute or remote asset paths,
   both architecture slices, and a valid signature with the app's own
   identifier.
3. **`dmg`** — wraps the app into `dist/Toolkit-0.1.0.dmg`.

Results:

- `dist/Toolkit.app` — 404 KB
- `dist/Toolkit-0.1.0.dmg` — 184 KB

**To install:** open the DMG and drag **Toolkit** to Applications. A DMG you
built yourself is not quarantined, so it opens normally.

## Code signing and Gatekeeper

There is no Apple Developer ID on this machine, so `scripts/build-app.sh`
ad-hoc signs the bundle. An unsigned bundle is killed by macOS the moment it
carries a quarantine flag, and `tests/packaged-app.test.js` fails the build if
the signature ever regresses.

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
| `npm test` | Run the logic and packaging tests |
| `npm run dev` | Open `static/index.html` in Safari |
| `npm run build` | Build `dist/Toolkit.app` |
| `npm run dmg` | Wrap the built app into a DMG |
| `npm run start` | Launch the built app |
| `npm run package:mac` | Full chain: build, test, DMG |

## Notes on the logic

Both features are pure functions, so the page computes them itself:

- **Timestamps** use `Intl.DateTimeFormat` for zone offsets, including the
  second-precision Local Mean Time offsets that zones carried before they
  standardized (`Africa/Cairo` was `+02:05:09` until 1900). Inputs are accepted
  for years 1–9999.
- **UUIDv7** takes its randomness from `crypto.getRandomValues` and puts a
  counter in `rand_a`, so IDs minted inside the same millisecond still sort in
  generation order.

## Manual checks

`tests/ui-smoke.md` covers the UI, the app window, and accessibility.
