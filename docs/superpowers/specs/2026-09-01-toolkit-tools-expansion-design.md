# Toolkit tools expansion + tabbed layout

## Goal

Grow Toolkit from two tools to nine, and restructure the page from a
two-column grid into a tabbed layout so the app is usable at half the
width of a 13" MacBook Air screen.

## Current architecture (unchanged by this work)

- `native/main.swift` — an `NSWindow` hosting a `WKWebView` that loads
  the bundled `static/index.html`. No server, no network access.
- `static/toolkit-core.js` — all conversion/generation logic as pure
  functions, no DOM, no dependencies. Loaded as a plain script and
  `require`d directly by tests.
- `static/app.js` — wires the page's DOM to `toolkit-core.js`.
- `static/index.html` / `static/styles.css` — markup and styling.

Adding a tool still means a function in `toolkit-core.js`, a panel in
`index.html`, and its wiring in `app.js`. This work does not introduce
a plugin framework or a manifest — tools stay hand-wired.

## Layout

Replace the two-column `.tool-grid` with a sidebar + content layout:

- `<nav class="tool-nav">` lists all 9 tools as buttons (Timestamp,
  UUIDv7, JSON, Encode/Decode, JWT, Regex, Hash, Diff, Case).
- All 9 `.tool-panel` articles live in the content area; only the
  selected tool's panel is visible (`hidden` attribute toggled, the
  same mechanism `#convert-result` already uses).
- Clicking a nav button shows its panel, hides the rest, marks the
  button active/`aria-selected`, and stores the choice in
  `localStorage` (`toolkit.activeTool`) so relaunching the app reopens
  the last tool. No tool *input or output values* are persisted —
  only which tab was active. An invalid or missing stored value falls
  back to the first tool.
- Existing panel-internal styling (forms, result rows, buttons) is
  reused as-is for the new tools.

## Window sizing (native/main.swift)

13" MacBook Air logical width is 1440pt (M1) or 1470pt (M2/M3), so a
half-screen split gives roughly 720–735pt of width. Current sizing
(`760×620` minimum, `1180×780` default) does not fit that.

- Default size: `700×820`.
- Minimum size: `480×560`.

## Shared helpers

Going from 2 to 9 tools would otherwise repeat the copy-button wiring
in `app.js` nine times. Generalize the existing `copyText` pattern
into one reusable helper that binds a "Copy" button to a text source
and a status element. This is a DRY pass on existing conventions, not
a new abstraction layer — tools are still individually wired.

## New tools

Each ships as a pure function in `toolkit-core.js` with unit tests,
a panel in `index.html`, and wiring in `app.js`.

### JSON formatter/validator
- Input: a textarea of raw JSON.
- Actions: **Format** (2-space pretty-print) and **Minify**.
- Output: read-only result with a Copy button.
- Errors: the native `JSON.parse` error message is shown as-is — no
  custom line/column computation.

### Encode/Decode
- One panel: a mode select (Base64 / URL / Hex) and an
  Encode/Decode direction toggle.
- Input text, output text, Copy button.
- Errors: invalid input for the decode direction (bad Base64 padding,
  invalid hex characters, malformed `%XX` sequences) is caught and
  shown as a message.

### JWT decoder
- Input: a textarea for the token.
- Output: header and payload, each pretty-printed JSON with its own
  Copy button. A permanent "Signature not verified" note — this tool
  decodes only, it never validates a signature.
- If the payload has `exp`, `iat`, or `nbf`, also render each as a
  human-readable UTC date next to the raw number, using the existing
  timestamp-formatting logic.
- Errors: a token that isn't three dot-separated segments, or a
  segment that isn't valid base64url-encoded JSON, produces an error
  message.

### Regex tester
- Inputs: a pattern field, flag checkboxes (`g`, `i`, `m`, `s`, `u`),
  and a test-string textarea.
- Output: a list of matches (index, matched text, capture groups),
  and the test string re-rendered with matches highlighted inline.
- Errors: an invalid pattern (`new RegExp` throws) produces an error
  message.

### Hash generator
- Input: text.
- Output: SHA-1, SHA-256, SHA-384, and SHA-512 hex digests, one
  result row per algorithm (same layout style as the timestamp
  converter's result rows), each with its own Copy button.
- Implementation: `crypto.subtle.digest`. This is the first
  asynchronous tool in the app — its submit handler awaits all four
  digests before rendering.
- MD5 is intentionally excluded: the Web Crypto API doesn't implement
  it, and it is unsuitable for integrity use. Adding it would mean
  hand-rolling MD5 in JS solely to support a broken legacy algorithm.

### Diff viewer
- Inputs: two textareas (Text A, Text B).
- Output: a line-by-line diff — unchanged lines plain, additions and
  removals color-coded.
- Implementation: a small LCS-based line-diff function, hand-written
  in `toolkit-core.js` with no dependency. Sized for clipboard-length
  text, not large files.

### Case converter
- Input: text.
- Output rows: camelCase, PascalCase, snake_case, kebab-case,
  CONSTANT_CASE, Title Case — same result-row style as the timestamp
  tool, each with a Copy button.
- Tokenizes on whitespace, punctuation, and camelCase word boundaries.

## Testing

- Every new pure function gets unit tests in
  `tests/toolkit-core.test.js`, following the existing style: happy
  path, edge cases, and error messages.
- `tests/ui-smoke.md` gets new sections covering tab navigation and
  each new tool.
- `tests/packaged-app.test.js` needs no changes — the bundle still
  ships the same three static files, no new assets.

## Out of scope

- A plugin/extension framework or tool manifest.
- Persisting any tool's input or output values across reloads or
  restarts (only the active tab selection persists).
- MD5 support.
- A global hotkey, command palette, or other app-shell features beyond
  the tab layout and window sizing described above.
