# Toolkit tools expansion + tabbed layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow Toolkit from 2 tools to 9 (JSON formatter, encode/decode, JWT decoder, regex tester, hash generator, diff viewer, case converter), restructure the page into a sidebar-tabbed layout, and shrink the native window to fit half of a 13" MacBook Air screen.

**Architecture:** Toolkit is a native macOS shell (Swift + WKWebView) around one static HTML page. This plan adds 7 pure functions to the existing `static/toolkit-core.js` module (no DOM, no dependencies), restructures `static/index.html`/`static/app.js`/`static/styles.css` from a two-column grid into a sidebar + single-active-panel layout, and adjusts `native/main.swift`'s window sizing.

**Tech Stack:** Vanilla JS (zero dependencies), Swift/Cocoa/WebKit, Node's built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-09-01-toolkit-tools-expansion-design.md`

## Global Constraints

- Zero dependencies — no npm packages, no new files beyond what's listed here.
- `static/toolkit-core.js` stays free of DOM access and module syntax (plain script in the app, `require`d directly by tests).
- Tools stay hand-wired: a function in `toolkit-core.js`, a panel in `index.html`, wiring in `app.js` — no plugin framework or manifest.
- No network access from the page.
- Native window: default size `700×820`, minimum size `480×560` (`native/main.swift`).
- MD5 is excluded from the hash generator.
- Node.js 18+ is required to run tests (`node --test`).

---

## Task 1: Native window sizing

**Files:**
- Modify: `native/main.swift:36,42`
- Modify: `tests/ui-smoke.md` (window section)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed by later tasks — this task is independent of the rest of the plan.

- [ ] **Step 1: Change the window's default size and minimum size**

In `native/main.swift`, inside `buildWindow()`:

```swift
    private func buildWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 700, height: 820),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Toolkit"
        window.contentMinSize = NSSize(width: 480, height: 560)
        window.backgroundColor = backgroundColor
        window.center()
        // Reopens where it was last left instead of always centered.
        window.setFrameAutosaveName("ToolkitMainWindow")
        return window
    }
```

(Only the `contentRect` width/height on the `NSRect` line and the `contentMinSize` line change — everything else in the function stays as-is.)

- [ ] **Step 2: Build the app**

Run: `npm run build`
Expected: builds `dist/Toolkit.app` with no errors.

- [ ] **Step 3: Manually verify the new size**

Run: `npm run start`
Expected: the window opens noticeably narrower than before (roughly 700pt wide — comfortably under half of a 1440–1470pt-wide 13" MacBook Air screen). Drag-resize it smaller; it should refuse to go below ~480×560.

- [ ] **Step 4: Update the manual smoke checklist**

In `tests/ui-smoke.md`, under "## The app window", add a new checklist item after the existing "window opens titled **Toolkit**..." item:

```markdown
2. The window opens at roughly 700×820 — small enough to sit in one half of a
   13" MacBook Air screen in Split View. Resizing below roughly 480×560 is
   refused.
```

(Renumber the remaining items in that section by one.)

- [ ] **Step 5: Commit**

```bash
git add native/main.swift tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat(native): shrink window to fit a 13-inch MacBook Air half-screen split

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sidebar tab shell

Restructures the existing two tools (Timestamp, UUIDv7) into a sidebar + single-active-panel layout, and adds the shared copy-button delegation every later tool will rely on.

**Files:**
- Modify: `static/index.html` (whole-page structure)
- Modify: `static/app.js` (whole file)
- Modify: `static/styles.css` (layout rules)
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: `ToolkitCore.convertTimestamp`, `ToolkitCore.generateUuid7Batch` (existing, unchanged).
- Produces (for every later task):
  - Nav pattern: add one `<li role="presentation"><button class="nav-item" type="button" role="tab" data-tool="<id>" aria-selected="false">Label</button></li>` per tool inside `.nav-list`.
  - Panel pattern: add one `<article class="tool-panel" id="tool-<id>" data-tool-panel="<id>" aria-labelledby="<id>-title" hidden>...</article>` per tool inside `.tool-content`.
  - Copy-button pattern: any button with class `copy-one` and a `data-copy-target="<id-of-element-with-the-text>"` attribute is wired automatically — no per-tool `addEventListener` needed. Optionally set `data-copy-label="Some Label"` when the button has no sibling `<dt>` to read a label from (see `copyResultValue` below).
  - `setError(element, message)` (existing helper, unchanged) — still the way to show/hide a `.form-error` element.
  - `copyText(text, successMessage, statusElement)` (existing helper, now requires all three arguments — no default `statusElement` anymore).

- [ ] **Step 1: Restructure `static/index.html`**

Replace the file's `<body>` contents (currently `<main class="page-shell" aria-label="Neko Toolkit"><section class="tool-grid" aria-label="Toolkit features">...two articles...</section></main>`) with:

```html
  <body>
    <div class="app-shell">
      <nav class="tool-nav" aria-label="Tools">
        <p class="nav-title">Toolkit</p>
        <ul class="nav-list" role="tablist">
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="timestamp" aria-selected="true">Timestamp</button>
          </li>
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="uuid" aria-selected="false">UUIDv7</button>
          </li>
        </ul>
      </nav>
      <main class="tool-content" aria-label="Neko Toolkit">
        <article class="tool-panel" id="tool-timestamp" data-tool-panel="timestamp" aria-labelledby="time-title">
          <div class="panel-heading">
            <p class="panel-kicker">01 / TIME</p>
            <h2 id="time-title">Timestamp converter</h2>
            <p>Use a Unix timestamp or ISO date/time. Results always come from the API.</p>
          </div>
          <form id="convert-form" novalidate>
            <label for="timestamp">Timestamp or ISO date/time</label>
            <input id="timestamp" name="timestamp" type="text" inputmode="text" autocomplete="off" aria-describedby="timestamp-help timestamp-error" required />
            <p class="helper" id="timestamp-help">Examples: <code>0</code>, <code>1700000000000</code>, or <code>2024-01-01T00:00:00Z</code>.</p>
            <p class="form-error" id="timestamp-error" role="alert" hidden></p>

            <label for="timezone">Display time zone</label>
            <select id="timezone" name="timezone" aria-describedby="timezone-help"></select>
            <p class="helper" id="timezone-help">Defaults to this computer&rsquo;s time zone.</p>

            <button class="button button-primary" type="submit">Convert timestamp</button>
          </form>
          <section class="result-card" id="convert-result" aria-live="polite" aria-label="Conversion result" hidden>
            <dl class="result-list">
              <div class="result-row">
                <dt>UTC ISO</dt>
                <dd>
                  <span class="result-value" id="result-utc"></span>
                  <button class="button button-secondary copy-one" type="button" data-copy-target="result-utc" aria-label="Copy UTC ISO value">Copy</button>
                </dd>
              </div>
              <div class="result-row">
                <dt id="result-local-label">Local time</dt>
                <dd>
                  <span class="result-value" id="result-local"></span>
                  <button class="button button-secondary copy-one" type="button" data-copy-target="result-local" aria-label="Copy local time value">Copy</button>
                </dd>
              </div>
              <div class="result-row">
                <dt>Unix seconds</dt>
                <dd>
                  <span class="result-value" id="result-seconds"></span>
                  <button class="button button-secondary copy-one" type="button" data-copy-target="result-seconds" aria-label="Copy Unix seconds value">Copy</button>
                </dd>
              </div>
              <div class="result-row">
                <dt>Unix milliseconds</dt>
                <dd>
                  <span class="result-value" id="result-milliseconds"></span>
                  <button class="button button-secondary copy-one" type="button" data-copy-target="result-milliseconds" aria-label="Copy Unix milliseconds value">Copy</button>
                </dd>
              </div>
              <div class="result-row">
                <dt>Relative</dt>
                <dd>
                  <span class="result-value" id="result-relative"></span>
                  <button class="button button-secondary copy-one" type="button" data-copy-target="result-relative" aria-label="Copy relative time value">Copy</button>
                </dd>
              </div>
            </dl>
          </section>
          <p class="status" id="convert-status" aria-live="polite"></p>
        </article>

        <article class="tool-panel" id="tool-uuid" data-tool-panel="uuid" aria-labelledby="uuid-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">02 / IDENTIFIERS</p>
            <h2 id="uuid-title">UUIDv7 generator</h2>
            <p>Generate time-sortable identifiers in this browser session.</p>
          </div>
          <form id="uuid-form" novalidate>
            <label for="uuid-count">How many UUIDs?</label>
            <input id="uuid-count" name="uuid-count" type="number" min="1" max="100" step="1" inputmode="numeric" value="3" aria-describedby="uuid-help uuid-error" required />
            <p class="helper" id="uuid-help">Choose between 1 and 100 identifiers.</p>
            <p class="form-error" id="uuid-error" role="alert" hidden></p>
            <button class="button button-primary" type="submit">Generate UUIDs</button>
          </form>

          <section class="id-output" aria-labelledby="generated-title">
            <div class="output-heading">
              <h3 id="generated-title">Generated IDs</h3>
              <div class="output-actions">
                <button id="copy-all" class="button button-secondary" type="button" disabled>Copy all</button>
                <button id="clear-ids" class="button button-quiet" type="button" disabled>Clear</button>
              </div>
            </div>
            <p class="status" id="uuid-status" aria-live="polite">No IDs generated in this session.</p>
            <ul class="id-list" id="id-list" aria-live="polite" aria-label="Generated UUIDs"></ul>
          </section>
        </article>
      </main>
    </div>
    <script src="toolkit-core.js" defer></script>
    <script src="app.js" defer></script>
  </body>
```

Everything inside the two `<article>` elements is unchanged except: the `<article>` tags themselves now carry `id="tool-<id>"` and `data-tool-panel="<id>"`, and the UUID one carries a static `hidden` attribute (so it doesn't flash visible before `app.js` runs).

- [ ] **Step 2: Rewrite `static/app.js`**

Replace the whole file with:

```js
(() => {
  'use strict';

  const TOOL_STORAGE_KEY = 'toolkit.activeTool';

  const generatedIds = [];
  const convertForm = document.querySelector('#convert-form');
  const uuidForm = document.querySelector('#uuid-form');
  const timestampInput = document.querySelector('#timestamp');
  const timezoneSelect = document.querySelector('#timezone');
  const countInput = document.querySelector('#uuid-count');
  const timestampError = document.querySelector('#timestamp-error');
  const uuidError = document.querySelector('#uuid-error');
  const convertResult = document.querySelector('#convert-result');
  const convertStatus = document.querySelector('#convert-status');
  const resultLocalLabel = document.querySelector('#result-local-label');
  const idList = document.querySelector('#id-list');
  const uuidStatus = document.querySelector('#uuid-status');
  const copyAllButton = document.querySelector('#copy-all');
  const clearButton = document.querySelector('#clear-ids');

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const resultFields = {
    utc_iso: document.querySelector('#result-utc'),
    local_time: document.querySelector('#result-local'),
    unix_seconds: document.querySelector('#result-seconds'),
    unix_milliseconds: document.querySelector('#result-milliseconds'),
    relative_time: document.querySelector('#result-relative'),
  };

  function populateTimezones() {
    const supported = typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [];
    const zones = [...new Set(['UTC', detectedTimezone, ...supported])].sort();
    timezoneSelect.replaceChildren(...zones.map((zone) => {
      const option = document.createElement('option');
      option.value = zone;
      option.textContent = zone;
      return option;
    }));
    timezoneSelect.value = detectedTimezone;
  }

  function setError(element, message) {
    element.textContent = message;
    element.hidden = !message;
  }

  function convert(value = timestampInput.value, timezone = timezoneSelect.value) {
    setError(timestampError, '');
    convertStatus.textContent = '';
    try {
      const result = ToolkitCore.convertTimestamp(value, timezone);
      Object.entries(resultFields).forEach(([key, element]) => { element.textContent = String(result[key]); });
      resultLocalLabel.textContent = timezone === detectedTimezone ? 'Local time' : `Time in ${timezone}`;
      convertResult.hidden = false;
      return result;
    } catch (error) {
      convertResult.hidden = true;
      // The core already phrases its errors as recovery instructions.
      setError(timestampError, error.message);
      timestampInput.setAttribute('aria-invalid', 'true');
      timestampInput.focus();
      return null;
    } finally {
      if (timestampError.hidden) timestampInput.removeAttribute('aria-invalid');
    }
  }

  function renderIds() {
    idList.replaceChildren();
    generatedIds.forEach((id) => {
      const item = document.createElement('li');
      item.className = 'id-row';
      const value = document.createElement('code');
      value.className = 'id-value';
      value.textContent = id;
      const copyButton = document.createElement('button');
      copyButton.className = 'button button-secondary copy-one';
      copyButton.type = 'button';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', `Copy ${id}`);
      copyButton.addEventListener('click', () => copyText(id, `Copied ${id}.`, uuidStatus));
      item.append(value, copyButton);
      idList.append(item);
    });
    const hasIds = generatedIds.length > 0;
    copyAllButton.disabled = !hasIds;
    clearButton.disabled = !hasIds;
  }

  function generateIds(count = countInput.value) {
    setError(uuidError, '');
    try {
      generatedIds.splice(0, generatedIds.length, ...ToolkitCore.generateUuid7Batch(Number(count)));
      renderIds();
      uuidStatus.textContent = `Generated ${generatedIds.length} UUID${generatedIds.length === 1 ? '' : 's'} in this session.`;
      return [...generatedIds];
    } catch (error) {
      setError(uuidError, `${error.message} Enter a whole number from 1 to 100 and try again.`);
      countInput.setAttribute('aria-invalid', 'true');
      countInput.focus();
      return [];
    } finally {
      if (uuidError.hidden) countInput.removeAttribute('aria-invalid');
    }
  }

  async function copyText(text, successMessage, statusElement) {
    try {
      await navigator.clipboard.writeText(text);
      statusElement.textContent = successMessage;
      return true;
    } catch (error) {
      statusElement.textContent = 'Copy failed. Select the value and copy it manually.';
      return false;
    }
  }

  // Works for any tool's copy button: a `data-copy-label` on the button wins;
  // otherwise the label comes from the sibling <dt> in the same .result-row
  // (this is what lets the Timestamp tool's "Local time" / "Time in <zone>"
  // label stay live without the button needing to know about it).
  function copyResultValue(button) {
    const value = document.getElementById(button.dataset.copyTarget).textContent;
    const label = button.dataset.copyLabel || button.closest('.result-row').querySelector('dt').textContent;
    const statusElement = button.closest('.tool-panel').querySelector('.status');
    return copyText(value, `Copied ${label}.`, statusElement);
  }

  function clearIds() {
    generatedIds.splice(0, generatedIds.length);
    renderIds();
    uuidStatus.textContent = 'Generated IDs cleared from this session.';
  }

  // --- Tab navigation ---

  const navButtons = [...document.querySelectorAll('.nav-item')];
  const toolPanels = new Map(
    [...document.querySelectorAll('[data-tool-panel]')].map((panel) => [panel.dataset.toolPanel, panel]),
  );

  function activateTool(tool) {
    if (!toolPanels.has(tool)) return;
    navButtons.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tool === tool)));
    toolPanels.forEach((panel, name) => { panel.hidden = name !== tool; });
    try {
      localStorage.setItem(TOOL_STORAGE_KEY, tool);
    } catch (error) {
      // localStorage can be unavailable (private mode); the tab still works this session.
    }
  }

  function restoreActiveTool() {
    let stored = null;
    try {
      stored = localStorage.getItem(TOOL_STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    activateTool(toolPanels.has(stored) ? stored : navButtons[0].dataset.tool);
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', () => activateTool(button.dataset.tool));
  });

  // Delegated so every current and future tool's Copy buttons work with zero
  // per-tool wiring, as long as they carry class="copy-one" + data-copy-target.
  document.querySelector('.tool-content').addEventListener('click', (event) => {
    const button = event.target.closest('.copy-one[data-copy-target]');
    if (button) copyResultValue(button);
  });

  populateTimezones();
  restoreActiveTool();

  convertForm.addEventListener('submit', (event) => { event.preventDefault(); convert(); });
  uuidForm.addEventListener('submit', (event) => { event.preventDefault(); generateIds(); });
  copyAllButton.addEventListener('click', () => copyText(generatedIds.join('\n'), `Copied all ${generatedIds.length} IDs.`, uuidStatus));
  clearButton.addEventListener('click', clearIds);

  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool };
})();
```

- [ ] **Step 3: Update `static/styles.css`**

Remove these two rules entirely (the layout they supported no longer exists):

```css
.page-shell { width: min(100% - 2rem, 76rem); margin: 0 auto; padding: clamp(2rem, 6vw, 5rem) 0; }
```
```css
.tool-grid { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Add in their place (same position in the file):

```css
.app-shell { display: flex; min-height: 100dvh; }
.tool-nav { flex: 0 0 180px; padding: 1.5rem 1rem; background: color-mix(in srgb, var(--surface) 94%, transparent); border-right: 1px solid var(--border); }
.nav-title { margin: 0 0 1rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .95rem; font-weight: 800; letter-spacing: .04em; }
.nav-list { display: grid; gap: .25rem; padding: 0; margin: 0; list-style: none; }
.nav-item { width: 100%; padding: .55rem .65rem; text-align: left; color: var(--muted); background: transparent; border: 1px solid transparent; border-radius: .5rem; cursor: pointer; font-weight: 700; }
.nav-item:hover { color: var(--text); background: var(--surface-muted); }
.nav-item[aria-selected="true"] { color: var(--accent-text); background: var(--accent); }
.nav-item:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.tool-content { flex: 1 1 auto; min-width: 0; padding: clamp(1.25rem, 3vw, 2rem); }
```

Also add, near the other shared helper classes (e.g. next to `.button-secondary`):

```css
.button-row { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .3rem; }
.output-block { max-height: 16rem; margin: 0; padding: .75rem; overflow: auto; background: #101827; border: 1px solid var(--border); border-radius: .5rem; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .85rem; white-space: pre-wrap; overflow-wrap: anywhere; }
```

(These two are unused until Task 3, but adding them now keeps all shell-level CSS in one task.)

In the responsive media queries at the bottom of the file, remove the now-orphaned rule from the `@media (max-width: 46rem)` block (the whole block only contained `.tool-grid`, so delete the whole block):

```css
@media (max-width: 46rem) { .tool-grid { grid-template-columns: 1fr; } }
```

And remove just the orphaned `.page-shell` line from the `@media (max-width: 30rem)` block, keeping the rest:

```css
@media (max-width: 30rem) { .output-heading { align-items: flex-start; flex-direction: column; } .output-actions { width: 100%; } .output-actions .button { flex: 1; } }
```

- [ ] **Step 4: Manually verify the shell**

Run: `npm run dev` (opens `static/index.html` in Safari)
Expected: a left sidebar lists "Timestamp" and "UUIDv7"; only the Timestamp panel is visible initially; clicking "UUIDv7" swaps the visible panel; both tools' forms, copy buttons, and error states still work exactly as before. Reload the page after selecting UUIDv7 — it should reopen on UUIDv7 (persisted via `localStorage`).

- [ ] **Step 5: Update the manual smoke checklist**

In `tests/ui-smoke.md`, add a new item to the "## The page" section (after item 1):

```markdown
2. Clicking a sidebar item shows that tool's panel and hides the others; the
   clicked item is visually marked active. Reloading the page reopens on the
   tool you had open, not always Timestamp.
```

(Renumber the remaining items in that section.)

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all existing tests still pass (this task touches no logic in `toolkit-core.js`, so `tests/toolkit-core.test.js` is unaffected).

- [ ] **Step 7: Commit**

```bash
git add static/index.html static/app.js static/styles.css tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
refactor(ui): restructure layout into a sidebar tab shell

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: JSON formatter/validator

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: nav/panel/copy-button patterns and `setError` from Task 2.
- Produces: `ToolkitCore.formatJson(value)`, `ToolkitCore.minifyJson(value)`, `ToolkitCore.INVALID_JSON_MESSAGE` — not consumed by any later task.

- [ ] **Step 1: Write the failing tests**

Append to `tests/toolkit-core.test.js` (add `formatJson, minifyJson, INVALID_JSON_MESSAGE` to the `require` destructuring at the top of the file):

```js
// --- JSON formatter/validator ---

test('valid JSON is pretty-printed with two-space indent', () => {
  assert.equal(formatJson('{"a":1,"b":[2,3]}'), '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}\n');
});

test('valid JSON is minified', () => {
  assert.equal(minifyJson('{\n  "a": 1\n}'), '{"a":1}');
});

test('invalid JSON surfaces the native parse error', () => {
  assert.throws(() => formatJson('{invalid}'), (error) => {
    assert.match(error.message, /^Enter valid JSON\./);
    return true;
  });
});

test('empty input is rejected', () => {
  assert.throws(() => formatJson(''), { message: /Enter valid JSON\./ });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `formatJson is not defined` (or similar, since the require destructuring references a name the module doesn't export yet).

- [ ] **Step 3: Implement the functions**

In `static/toolkit-core.js`, add near the other message constants (after `INVALID_UUID_COUNT_MESSAGE`):

```js
  const INVALID_JSON_MESSAGE = 'Enter valid JSON.';
```

Add the functions themselves anywhere before the final `return { ... };` (e.g. right after the UUIDv7 section):

```js
  // --- JSON formatter/validator ---

  function parseJsonOrThrow(value) {
    try {
      return JSON.parse(String(value));
    } catch (error) {
      throw new Error(`${INVALID_JSON_MESSAGE} ${error.message}`);
    }
  }

  function formatJson(value) {
    return `${JSON.stringify(parseJsonOrThrow(value), null, 2)}\n`;
  }

  function minifyJson(value) {
    return JSON.stringify(parseJsonOrThrow(value));
  }
```

Update the `return { ... }` object at the end of the factory function to also export:

```js
    formatJson,
    minifyJson,
    INVALID_JSON_MESSAGE,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

In `static/index.html`, add a nav entry inside `.nav-list`, right after the UUIDv7 `<li>`:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="json" aria-selected="false">JSON</button>
          </li>
```

Add a panel inside `.tool-content`, right after the UUIDv7 `</article>`:

```html
        <article class="tool-panel" id="tool-json" data-tool-panel="json" aria-labelledby="json-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">03 / JSON</p>
            <h2 id="json-title">JSON formatter</h2>
            <p>Paste JSON to format it or minify it.</p>
          </div>
          <form id="json-form" novalidate>
            <label for="json-input">JSON input</label>
            <textarea id="json-input" name="json-input" rows="8" spellcheck="false" aria-describedby="json-error" required></textarea>
            <p class="form-error" id="json-error" role="alert" hidden></p>
            <div class="button-row">
              <button class="button button-primary" type="submit" data-json-action="format">Format</button>
              <button class="button button-secondary" type="button" data-json-action="minify">Minify</button>
            </div>
          </form>
          <section class="result-card" id="json-result" aria-live="polite" aria-label="JSON result" hidden>
            <div class="output-heading">
              <h3>Result</h3>
              <button class="button button-secondary copy-one" type="button" data-copy-target="json-output" data-copy-label="JSON result">Copy</button>
            </div>
            <pre class="output-block"><code id="json-output"></code></pre>
          </section>
          <p class="status" id="json-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add, right after the `clearIds` function definition:

```js
  // --- JSON formatter/validator ---

  const jsonForm = document.querySelector('#json-form');
  const jsonInput = document.querySelector('#json-input');
  const jsonError = document.querySelector('#json-error');
  const jsonResult = document.querySelector('#json-result');
  const jsonOutput = document.querySelector('#json-output');
  const jsonStatus = document.querySelector('#json-status');

  function runJson(action) {
    setError(jsonError, '');
    jsonStatus.textContent = '';
    try {
      const text = action === 'minify' ? ToolkitCore.minifyJson(jsonInput.value) : ToolkitCore.formatJson(jsonInput.value);
      jsonOutput.textContent = text;
      jsonResult.hidden = false;
    } catch (error) {
      jsonResult.hidden = true;
      setError(jsonError, error.message);
      jsonInput.setAttribute('aria-invalid', 'true');
      jsonInput.focus();
    } finally {
      if (jsonError.hidden) jsonInput.removeAttribute('aria-invalid');
    }
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  jsonForm.addEventListener('submit', (event) => { event.preventDefault(); runJson('format'); });
  jsonForm.querySelector('[data-json-action="minify"]').addEventListener('click', () => runJson('minify'));
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson };
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`
Expected: the JSON tab appears in the sidebar; pasting `{"a":1}` and clicking Format shows pretty-printed JSON with a working Copy button; clicking Minify collapses it back to one line; pasting invalid JSON shows an inline error instead of a result.

- [ ] **Step 8: Update the manual smoke checklist**

In `tests/ui-smoke.md`, add under "## The page":

```markdown
- The JSON tool formats `{"a":1}` into pretty-printed JSON, minifies it back
  to one line, and shows an inline error for `{invalid}` instead of a result.
```

- [ ] **Step 9: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add JSON formatter/validator tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Encode/Decode (Base64, URL, Hex)

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: nav/panel/copy-button patterns from Task 2.
- Produces:
  - Public: `ToolkitCore.encodeText(mode, value)`, `ToolkitCore.decodeText(mode, value)`, `ToolkitCore.INVALID_ENCODING_INPUT_MESSAGE`. `mode` is one of `'base64' | 'url' | 'hex'`.
  - Private (in-module, not exported, consumed directly by Task 5 and Task 7 since they land in the same closure): `bytesToBase64(bytes)`, `base64ToBytes(text)`, `bytesToHex(bytes)`.

- [ ] **Step 1: Write the failing tests**

Add `encodeText, decodeText, INVALID_ENCODING_INPUT_MESSAGE` to the `require` destructuring at the top of `tests/toolkit-core.test.js`, then append:

```js
// --- Encode/decode ---

test('base64 round-trips UTF-8 text', () => {
  const encoded = encodeText('base64', 'héllo');

  assert.equal(encoded, 'aMOpbGxv');
  assert.equal(decodeText('base64', encoded), 'héllo');
});

test('url encoding escapes reserved characters', () => {
  assert.equal(encodeText('url', 'a b/c'), 'a%20b%2Fc');
  assert.equal(decodeText('url', 'a%20b%2Fc'), 'a b/c');
});

test('hex round-trips UTF-8 text', () => {
  const encoded = encodeText('hex', 'hi');

  assert.equal(encoded, '6869');
  assert.equal(decodeText('hex', '6869'), 'hi');
});

test('invalid base64 is rejected with guidance', () => {
  assert.throws(() => decodeText('base64', '***'), { message: INVALID_ENCODING_INPUT_MESSAGE });
});

test('base64 decoding invalid UTF-8 bytes is rejected', () => {
  assert.throws(() => decodeText('base64', 'gA=='), { message: INVALID_ENCODING_INPUT_MESSAGE });
});

test('odd-length hex is rejected', () => {
  assert.throws(() => decodeText('hex', 'abc'), { message: INVALID_ENCODING_INPUT_MESSAGE });
});

test('non-hex characters are rejected', () => {
  assert.throws(() => decodeText('hex', 'zz'), { message: INVALID_ENCODING_INPUT_MESSAGE });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `encodeText is not defined`.

- [ ] **Step 3: Implement the functions**

Add the message constant near the others:

```js
  const INVALID_ENCODING_INPUT_MESSAGE = 'That input cannot be decoded with the selected format.';
```

Add the functions before the final `return { ... };`:

```js
  // --- Encode/decode ---

  function bytesToBase64(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function base64ToBytes(text) {
    const binary = atob(text);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function encodeText(mode, value) {
    const text = String(value);
    if (mode === 'url') return encodeURIComponent(text);
    const bytes = new TextEncoder().encode(text);
    if (mode === 'hex') return bytesToHex(bytes);
    return bytesToBase64(bytes);
  }

  function decodeText(mode, value) {
    const text = String(value);
    try {
      if (mode === 'url') return decodeURIComponent(text);
      if (mode === 'hex') {
        const clean = text.trim().replace(/\s+/g, '');
        if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) throw new Error('malformed hex');
        const bytes = Uint8Array.from({ length: clean.length / 2 }, (_, index) => parseInt(clean.slice(index * 2, index * 2 + 2), 16));
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(text));
    } catch (error) {
      throw new Error(INVALID_ENCODING_INPUT_MESSAGE);
    }
  }
```

Update the `return { ... }` object:

```js
    encodeText,
    decodeText,
    INVALID_ENCODING_INPUT_MESSAGE,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after the JSON `<li>`:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="encode" aria-selected="false">Encode/Decode</button>
          </li>
```

Panel, after the JSON `</article>`:

```html
        <article class="tool-panel" id="tool-encode" data-tool-panel="encode" aria-labelledby="encode-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">04 / ENCODING</p>
            <h2 id="encode-title">Encode / decode</h2>
            <p>Convert text to and from Base64, URL, and hex encoding.</p>
          </div>
          <form id="encode-form" novalidate>
            <label for="encode-mode">Format</label>
            <select id="encode-mode" name="encode-mode">
              <option value="base64">Base64</option>
              <option value="url">URL</option>
              <option value="hex">Hex</option>
            </select>
            <label for="encode-input">Text</label>
            <textarea id="encode-input" name="encode-input" rows="6" spellcheck="false" aria-describedby="encode-error" required></textarea>
            <p class="form-error" id="encode-error" role="alert" hidden></p>
            <div class="button-row">
              <button class="button button-primary" type="submit" data-encode-action="encode">Encode</button>
              <button class="button button-secondary" type="button" data-encode-action="decode">Decode</button>
            </div>
          </form>
          <section class="result-card" id="encode-result" aria-live="polite" aria-label="Encode/decode result" hidden>
            <div class="output-heading">
              <h3>Result</h3>
              <button class="button button-secondary copy-one" type="button" data-copy-target="encode-output" data-copy-label="encoded result">Copy</button>
            </div>
            <pre class="output-block"><code id="encode-output"></code></pre>
          </section>
          <p class="status" id="encode-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add after the JSON section:

```js
  // --- Encode/decode ---

  const encodeForm = document.querySelector('#encode-form');
  const encodeMode = document.querySelector('#encode-mode');
  const encodeInput = document.querySelector('#encode-input');
  const encodeError = document.querySelector('#encode-error');
  const encodeResult = document.querySelector('#encode-result');
  const encodeOutput = document.querySelector('#encode-output');
  const encodeStatus = document.querySelector('#encode-status');

  function runEncode(action) {
    setError(encodeError, '');
    encodeStatus.textContent = '';
    try {
      const text = action === 'decode'
        ? ToolkitCore.decodeText(encodeMode.value, encodeInput.value)
        : ToolkitCore.encodeText(encodeMode.value, encodeInput.value);
      encodeOutput.textContent = text;
      encodeResult.hidden = false;
    } catch (error) {
      encodeResult.hidden = true;
      setError(encodeError, error.message);
      encodeInput.setAttribute('aria-invalid', 'true');
      encodeInput.focus();
    } finally {
      if (encodeError.hidden) encodeInput.removeAttribute('aria-invalid');
    }
  }
```

Event listeners, alongside the JSON ones:

```js
  encodeForm.addEventListener('submit', (event) => { event.preventDefault(); runEncode('encode'); });
  encodeForm.querySelector('[data-encode-action="decode"]').addEventListener('click', () => runEncode('decode'));
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode };
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`
Expected: encoding `hello` as Base64 gives `aGVsbG8=`; switching to Decode with that value and format still selected gives back `hello`; selecting Hex and encoding `hi` gives `6869`; decoding `zz` as Hex shows an inline error.

- [ ] **Step 8: Update the manual smoke checklist**

```markdown
- The Encode/Decode tool converts `hello` to Base64 `aGVsbG8=` and back, and
  shows an inline error when decoding `zz` as Hex.
```

- [ ] **Step 9: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add encode/decode tool (base64, url, hex)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: JWT decoder

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: `base64ToBytes(text)` (private helper from Task 4, same closure), `ToolkitCore.convertTimestamp(value, timezone)` (existing).
- Produces: `ToolkitCore.decodeJwt(value)` → `{ header: object, payload: object }`, `ToolkitCore.INVALID_JWT_MESSAGE`. Not consumed by any later task.

- [ ] **Step 1: Write the failing tests**

Add `decodeJwt, INVALID_JWT_MESSAGE` to the `require` destructuring, then append:

```js
// --- JWT decoder ---

test('a valid token is decoded into header and payload', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SIGNATURE';
  const result = decodeJwt(token);

  assert.deepEqual(result.header, { alg: 'HS256', typ: 'JWT' });
  assert.deepEqual(result.payload, { sub: '1234567890', iat: 1516239022 });
});

test('a token missing a segment is rejected', () => {
  assert.throws(() => decodeJwt('only.two'), { message: INVALID_JWT_MESSAGE });
});

test('a segment that is not valid base64url JSON is rejected', () => {
  assert.throws(() => decodeJwt('not-json.also-not-json.sig'), { message: INVALID_JWT_MESSAGE });
});

test('empty input is rejected', () => {
  assert.throws(() => decodeJwt(''), { message: INVALID_JWT_MESSAGE });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `decodeJwt is not defined`.

- [ ] **Step 3: Implement the function**

Add the message constant:

```js
  const INVALID_JWT_MESSAGE = 'Enter a JWT with three dot-separated segments.';
```

Add the functions before the final `return { ... };` (after the encode/decode section, so `base64ToBytes` is already in scope):

```js
  // --- JWT decoder ---

  function decodeJwtSegment(segment) {
    try {
      const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
      const bytes = base64ToBytes(padded.padEnd(padded.length + (4 - (padded.length % 4)) % 4, '='));
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      throw new Error(INVALID_JWT_MESSAGE);
    }
  }

  function decodeJwt(value) {
    const segments = String(value).trim().split('.');
    if (segments.length !== 3 || segments.some((segment) => !segment)) throw new Error(INVALID_JWT_MESSAGE);

    return {
      header: decodeJwtSegment(segments[0]),
      payload: decodeJwtSegment(segments[1]),
    };
  }
```

Update the `return { ... }` object:

```js
    decodeJwt,
    INVALID_JWT_MESSAGE,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after Encode/Decode:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="jwt" aria-selected="false">JWT</button>
          </li>
```

Panel, after the Encode/Decode `</article>`:

```html
        <article class="tool-panel" id="tool-jwt" data-tool-panel="jwt" aria-labelledby="jwt-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">05 / AUTH</p>
            <h2 id="jwt-title">JWT decoder</h2>
            <p>Decodes the header and payload. The signature is never verified.</p>
          </div>
          <form id="jwt-form" novalidate>
            <label for="jwt-input">Token</label>
            <textarea id="jwt-input" name="jwt-input" rows="4" spellcheck="false" aria-describedby="jwt-error" required></textarea>
            <p class="form-error" id="jwt-error" role="alert" hidden></p>
            <button class="button button-primary" type="submit">Decode</button>
          </form>
          <section class="result-card" id="jwt-result" aria-live="polite" aria-label="JWT result" hidden>
            <div class="output-heading">
              <h3>Header</h3>
              <button class="button button-secondary copy-one" type="button" data-copy-target="jwt-header" data-copy-label="JWT header">Copy</button>
            </div>
            <pre class="output-block"><code id="jwt-header"></code></pre>
            <div class="output-heading">
              <h3>Payload</h3>
              <button class="button button-secondary copy-one" type="button" data-copy-target="jwt-payload" data-copy-label="JWT payload">Copy</button>
            </div>
            <pre class="output-block"><code id="jwt-payload"></code></pre>
            <dl class="result-list" id="jwt-dates" hidden></dl>
            <p class="helper">Signature not verified.</p>
          </section>
          <p class="status" id="jwt-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add after the encode/decode section:

```js
  // --- JWT decoder ---

  const jwtForm = document.querySelector('#jwt-form');
  const jwtInput = document.querySelector('#jwt-input');
  const jwtError = document.querySelector('#jwt-error');
  const jwtResult = document.querySelector('#jwt-result');
  const jwtHeader = document.querySelector('#jwt-header');
  const jwtPayload = document.querySelector('#jwt-payload');
  const jwtDates = document.querySelector('#jwt-dates');
  const jwtStatus = document.querySelector('#jwt-status');

  const JWT_DATE_FIELDS = ['exp', 'iat', 'nbf'];

  function renderJwtDates(payload) {
    const fields = JWT_DATE_FIELDS.filter((field) => typeof payload[field] === 'number');
    jwtDates.replaceChildren(...fields.map((field) => {
      const row = document.createElement('div');
      row.className = 'result-row';
      const dt = document.createElement('dt');
      dt.textContent = field;
      const dd = document.createElement('dd');
      const value = document.createElement('span');
      value.className = 'result-value';
      value.textContent = `${payload[field]} — ${ToolkitCore.convertTimestamp(String(payload[field]), 'UTC').utc_iso}`;
      dd.append(value);
      row.append(dt, dd);
      return row;
    }));
    jwtDates.hidden = fields.length === 0;
  }

  function runJwtDecode() {
    setError(jwtError, '');
    jwtStatus.textContent = '';
    try {
      const { header, payload } = ToolkitCore.decodeJwt(jwtInput.value);
      jwtHeader.textContent = JSON.stringify(header, null, 2);
      jwtPayload.textContent = JSON.stringify(payload, null, 2);
      renderJwtDates(payload);
      jwtResult.hidden = false;
    } catch (error) {
      jwtResult.hidden = true;
      setError(jwtError, error.message);
      jwtInput.setAttribute('aria-invalid', 'true');
      jwtInput.focus();
    } finally {
      if (jwtError.hidden) jwtInput.removeAttribute('aria-invalid');
    }
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  jwtForm.addEventListener('submit', (event) => { event.preventDefault(); runJwtDecode(); });
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode, runJwtDecode };
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`
Expected: pasting `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ.SIGNATURE` and clicking Decode shows the header and payload as pretty JSON, an extra row showing `iat` with its human-readable UTC date, and the "Signature not verified" note. Pasting garbage shows an inline error.

- [ ] **Step 8: Update the manual smoke checklist**

```markdown
- The JWT decoder splits a valid token into header and payload JSON, shows a
  human-readable date next to `iat`, and always shows "Signature not
  verified."
```

- [ ] **Step 9: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add JWT decoder tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Regex tester

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `static/styles.css`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: nothing beyond Task 2's shell patterns.
- Produces: `ToolkitCore.testRegex(pattern, flags, text)` → `Array<{ index: number, value: string, groups: Array<string|undefined> }>`, `ToolkitCore.INVALID_REGEX_MESSAGE`. Not consumed by any later task.

- [ ] **Step 1: Write the failing tests**

Add `testRegex, INVALID_REGEX_MESSAGE` to the `require` destructuring, then append:

```js
// --- Regex tester ---

test('a pattern with the global flag returns every match', () => {
  const matches = testRegex('\\d+', 'g', 'a1 b22 c333');

  assert.deepEqual(matches.map((m) => m.value), ['1', '22', '333']);
  assert.equal(matches[1].index, 4);
});

test('without the global flag only the first match is returned', () => {
  const matches = testRegex('\\d+', '', 'a1 b22');

  assert.deepEqual(matches.map((m) => m.value), ['1']);
});

test('capture groups are included', () => {
  const matches = testRegex('(\\w)(\\d)', 'g', 'a1 b2');

  assert.deepEqual(matches[0].groups, ['a', '1']);
  assert.deepEqual(matches[1].groups, ['b', '2']);
});

test('no match returns an empty list', () => {
  assert.deepEqual(testRegex('zzz', 'g', 'abc'), []);
});

test('an empty-match pattern does not loop forever', () => {
  const matches = testRegex('a*', 'g', 'baab');

  assert.ok(matches.length > 0 && matches.length < 100);
});

test('an invalid pattern is rejected', () => {
  assert.throws(() => testRegex('(', 'g', 'abc'), (error) => {
    assert.match(error.message, /^Enter a valid regular expression\./);
    return true;
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `testRegex is not defined`.

- [ ] **Step 3: Implement the function**

Add the message constant:

```js
  const INVALID_REGEX_MESSAGE = 'Enter a valid regular expression.';
```

Add the function before the final `return { ... };`:

```js
  // --- Regex tester ---

  function testRegex(pattern, flags, text) {
    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch (error) {
      throw new Error(`${INVALID_REGEX_MESSAGE} ${error.message}`);
    }

    if (!flags.includes('g')) {
      const match = regex.exec(text);
      return match ? [{ index: match.index, value: match[0], groups: match.slice(1) }] : [];
    }

    const matches = [];
    let match = regex.exec(text);
    while (match !== null) {
      matches.push({ index: match.index, value: match[0], groups: match.slice(1) });
      if (match[0] === '') regex.lastIndex += 1;
      match = regex.exec(text);
    }
    return matches;
  }
```

Update the `return { ... }` object:

```js
    testRegex,
    INVALID_REGEX_MESSAGE,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after JWT:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="regex" aria-selected="false">Regex</button>
          </li>
```

Panel, after the JWT `</article>`:

```html
        <article class="tool-panel" id="tool-regex" data-tool-panel="regex" aria-labelledby="regex-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">06 / PATTERNS</p>
            <h2 id="regex-title">Regex tester</h2>
            <p>Test a JavaScript regular expression against sample text.</p>
          </div>
          <form id="regex-form" novalidate>
            <label for="regex-pattern">Pattern</label>
            <input id="regex-pattern" name="regex-pattern" type="text" spellcheck="false" aria-describedby="regex-error" required />
            <fieldset class="flag-set">
              <legend>Flags</legend>
              <label><input type="checkbox" name="regex-flag" value="g" checked /> g (global)</label>
              <label><input type="checkbox" name="regex-flag" value="i" /> i (ignore case)</label>
              <label><input type="checkbox" name="regex-flag" value="m" /> m (multiline)</label>
              <label><input type="checkbox" name="regex-flag" value="s" /> s (dot all)</label>
              <label><input type="checkbox" name="regex-flag" value="u" /> u (unicode)</label>
            </fieldset>
            <label for="regex-text">Test string</label>
            <textarea id="regex-text" name="regex-text" rows="6" spellcheck="false" required></textarea>
            <p class="form-error" id="regex-error" role="alert" hidden></p>
            <button class="button button-primary" type="submit">Test</button>
          </form>
          <section class="result-card" id="regex-result" aria-live="polite" aria-label="Regex result" hidden>
            <h3>Matched text</h3>
            <pre class="output-block" id="regex-highlight"></pre>
            <h3>Matches (<span id="regex-count">0</span>)</h3>
            <ul class="id-list" id="regex-matches"></ul>
          </section>
          <p class="status" id="regex-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add after the JWT section:

```js
  // --- Regex tester ---

  const regexForm = document.querySelector('#regex-form');
  const regexPattern = document.querySelector('#regex-pattern');
  const regexText = document.querySelector('#regex-text');
  const regexError = document.querySelector('#regex-error');
  const regexResult = document.querySelector('#regex-result');
  const regexHighlight = document.querySelector('#regex-highlight');
  const regexMatches = document.querySelector('#regex-matches');
  const regexCount = document.querySelector('#regex-count');
  const regexStatus = document.querySelector('#regex-status');

  function activeRegexFlags() {
    return [...regexForm.querySelectorAll('[name="regex-flag"]:checked')].map((box) => box.value).join('');
  }

  function renderHighlight(text, matches) {
    regexHighlight.replaceChildren();
    let cursor = 0;
    matches.forEach((match) => {
      if (match.value === '') return;
      regexHighlight.append(document.createTextNode(text.slice(cursor, match.index)));
      const mark = document.createElement('mark');
      mark.textContent = match.value;
      regexHighlight.append(mark);
      cursor = match.index + match.value.length;
    });
    regexHighlight.append(document.createTextNode(text.slice(cursor)));
  }

  function renderMatches(matches) {
    regexCount.textContent = String(matches.length);
    regexMatches.replaceChildren(...matches.map((match, position) => {
      const item = document.createElement('li');
      item.className = 'id-row';
      const value = document.createElement('code');
      value.className = 'id-value';
      const groups = match.groups.length ? ` [${match.groups.map((g) => g ?? '').join(', ')}]` : '';
      value.textContent = `${position + 1}. "${match.value}" at ${match.index}${groups}`;
      item.append(value);
      return item;
    }));
  }

  function runRegexTest() {
    setError(regexError, '');
    regexStatus.textContent = '';
    try {
      const matches = ToolkitCore.testRegex(regexPattern.value, activeRegexFlags(), regexText.value);
      renderHighlight(regexText.value, matches);
      renderMatches(matches);
      regexResult.hidden = false;
    } catch (error) {
      regexResult.hidden = true;
      setError(regexError, error.message);
      regexPattern.setAttribute('aria-invalid', 'true');
      regexPattern.focus();
    } finally {
      if (regexError.hidden) regexPattern.removeAttribute('aria-invalid');
    }
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  regexForm.addEventListener('submit', (event) => { event.preventDefault(); runRegexTest(); });
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode, runJwtDecode, runRegexTest };
```

- [ ] **Step 7: Add supporting CSS**

In `static/styles.css`, add:

```css
.flag-set { border: 1px solid var(--border); border-radius: .5rem; padding: .6rem .75rem; display: flex; flex-wrap: wrap; gap: .6rem .9rem; margin: 0; }
.flag-set legend { padding: 0 .3rem; color: var(--muted); font-weight: 700; font-size: .8rem; }
.flag-set label { display: inline-flex; align-items: center; gap: .35rem; font-weight: 400; margin-top: 0; }
mark { background: var(--accent); color: var(--accent-text); border-radius: .2rem; padding: 0 .15rem; }
```

- [ ] **Step 8: Manually verify**

Run: `npm run dev`
Expected: pattern `\d+` with `g` checked against `a1 b22` highlights `1` and `22` in the test string and lists 2 matches; unchecking `g` lists only the first match; pattern `(` shows an inline error.

- [ ] **Step 9: Update the manual smoke checklist**

```markdown
- The regex tester highlights every match for `\d+` against `a1 b22` with `g`
  checked, lists 2 matches, and shows an inline error for the pattern `(`.
```

- [ ] **Step 10: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js static/styles.css tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add regex tester tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Hash generator

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: `bytesToHex(bytes)` (private helper from Task 4, same closure).
- Produces:
  - Public: `ToolkitCore.hashText(value)` → `Promise<{ 'SHA-1': string, 'SHA-256': string, 'SHA-384': string, 'SHA-512': string }>` (hex digests), `ToolkitCore.HASH_ALGORITHMS` → `[{ id: string, label: string }, ...]` in display order.
  - `app.js`: `renderCopyRow(label, value)` → a `<div class="result-row">` element with a `<dt>`, a `<dd><span class="result-value">` (unique auto-generated id), and a wired Copy button — consumed directly by Task 9 (same file).

- [ ] **Step 1: Write the failing tests**

Add `hashText` to the `require` destructuring, then append:

```js
// --- Hash generator ---

test('hashText returns SHA family digests', async () => {
  const result = await hashText('abc');

  assert.equal(result['SHA-1'], 'a9993e364706816aba3e25717850c26c9cd0d89');
  assert.equal(result['SHA-256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('SHA-384 and SHA-512 digests have the expected lengths', async () => {
  const result = await hashText('abc');

  assert.equal(result['SHA-384'].length, 96);
  assert.equal(result['SHA-512'].length, 128);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `hashText is not defined`.

- [ ] **Step 3: Implement the function**

Add before the final `return { ... };` (after the encode/decode section, so `bytesToHex` is already in scope):

```js
  // --- Hash generator ---

  const HASH_ALGORITHMS = [
    { id: 'SHA-1', label: 'SHA-1' },
    { id: 'SHA-256', label: 'SHA-256' },
    { id: 'SHA-384', label: 'SHA-384' },
    { id: 'SHA-512', label: 'SHA-512' },
  ];

  async function hashText(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digests = await Promise.all(HASH_ALGORITHMS.map(({ id }) => crypto.subtle.digest(id, bytes)));
    return HASH_ALGORITHMS.reduce((result, { id }, index) => {
      result[id] = bytesToHex(new Uint8Array(digests[index]));
      return result;
    }, {});
  }
```

Update the `return { ... }` object:

```js
    hashText,
    HASH_ALGORITHMS,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after Regex:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="hash" aria-selected="false">Hash</button>
          </li>
```

Panel, after the Regex `</article>`:

```html
        <article class="tool-panel" id="tool-hash" data-tool-panel="hash" aria-labelledby="hash-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">07 / HASHING</p>
            <h2 id="hash-title">Hash generator</h2>
            <p>Computes SHA-1, SHA-256, SHA-384, and SHA-512 digests of the input text.</p>
          </div>
          <form id="hash-form" novalidate>
            <label for="hash-input">Text</label>
            <textarea id="hash-input" name="hash-input" rows="6" spellcheck="false" required></textarea>
            <button class="button button-primary" type="submit">Generate hashes</button>
          </form>
          <section class="result-card" id="hash-result" aria-live="polite" aria-label="Hash result" hidden>
            <dl class="result-list" id="hash-list"></dl>
          </section>
          <p class="status" id="hash-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add a shared row-renderer near the top-level helpers (right after `copyResultValue`) — this is the helper Task 9 will reuse:

```js
  let copyRowCounter = 0;

  // Builds one labeled result row with its own Copy button. Used by any tool
  // that renders a variable-length list of copyable values (Hash, Case).
  function renderCopyRow(label, value) {
    const row = document.createElement('div');
    row.className = 'result-row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    const span = document.createElement('span');
    span.className = 'result-value';
    span.id = `copy-value-${copyRowCounter++}`;
    span.textContent = value;
    const copyButton = document.createElement('button');
    copyButton.className = 'button button-secondary copy-one';
    copyButton.type = 'button';
    copyButton.textContent = 'Copy';
    copyButton.dataset.copyTarget = span.id;
    copyButton.setAttribute('aria-label', `Copy ${label} value`);
    dd.append(span, copyButton);
    row.append(dt, dd);
    return row;
  }
```

Add after the regex section:

```js
  // --- Hash generator ---

  const hashForm = document.querySelector('#hash-form');
  const hashInput = document.querySelector('#hash-input');
  const hashResult = document.querySelector('#hash-result');
  const hashList = document.querySelector('#hash-list');
  const hashStatus = document.querySelector('#hash-status');

  async function runHash() {
    hashStatus.textContent = '';
    const digests = await ToolkitCore.hashText(hashInput.value);
    hashList.replaceChildren(...ToolkitCore.HASH_ALGORITHMS.map(({ id, label }) => renderCopyRow(label, digests[id])));
    hashResult.hidden = false;
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  hashForm.addEventListener('submit', (event) => { event.preventDefault(); runHash(); });
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode, runJwtDecode, runRegexTest, runHash };
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`
Expected: entering `abc` and clicking Generate hashes shows four rows (SHA-1, SHA-256, SHA-384, SHA-512), each with a working Copy button; the SHA-256 value matches `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.

- [ ] **Step 8: Update the manual smoke checklist**

```markdown
- The hash generator produces four digests for `abc`, and the SHA-256 row's
  Copy button copies the correct value.
```

- [ ] **Step 9: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add hash generator tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Diff viewer

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `static/styles.css`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: nothing beyond Task 2's shell patterns.
- Produces: `ToolkitCore.diffLines(textA, textB)` → `Array<{ type: 'unchanged'|'added'|'removed', value: string }>`. Not consumed by any later task.

- [ ] **Step 1: Write the failing tests**

Add `diffLines` to the `require` destructuring, then append:

```js
// --- Diff viewer ---

test('identical text has no changes', () => {
  const result = diffLines('a\nb\nc', 'a\nb\nc');

  assert.ok(result.every((line) => line.type === 'unchanged'));
  assert.deepEqual(result.map((line) => line.value), ['a', 'b', 'c']);
});

test('an added line is marked added', () => {
  const result = diffLines('a\nb', 'a\nx\nb');

  assert.deepEqual(result, [
    { type: 'unchanged', value: 'a' },
    { type: 'added', value: 'x' },
    { type: 'unchanged', value: 'b' },
  ]);
});

test('a removed line is marked removed', () => {
  const result = diffLines('a\nx\nb', 'a\nb');

  assert.deepEqual(result, [
    { type: 'unchanged', value: 'a' },
    { type: 'removed', value: 'x' },
    { type: 'unchanged', value: 'b' },
  ]);
});

test('a changed line is a removal followed by an addition', () => {
  const result = diffLines('a\nb\nc', 'a\nB\nc');

  assert.deepEqual(result, [
    { type: 'unchanged', value: 'a' },
    { type: 'removed', value: 'b' },
    { type: 'added', value: 'B' },
    { type: 'unchanged', value: 'c' },
  ]);
});

test('two completely different texts are all removed then all added', () => {
  const result = diffLines('a\nb', 'x\ny');

  assert.deepEqual(result, [
    { type: 'removed', value: 'a' },
    { type: 'removed', value: 'b' },
    { type: 'added', value: 'x' },
    { type: 'added', value: 'y' },
  ]);
});

test('empty input diffs against an empty line', () => {
  assert.deepEqual(diffLines('', ''), [{ type: 'unchanged', value: '' }]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `diffLines is not defined`.

- [ ] **Step 3: Implement the function**

Add before the final `return { ... };`:

```js
  // --- Diff viewer ---

  // Standard dynamic-programming LCS, returning matched [indexA, indexB] pairs in order.
  function longestCommonSubsequence(linesA, linesB) {
    const lengths = Array.from({ length: linesA.length + 1 }, () => new Uint32Array(linesB.length + 1));
    for (let i = linesA.length - 1; i >= 0; i -= 1) {
      for (let j = linesB.length - 1; j >= 0; j -= 1) {
        lengths[i][j] = linesA[i] === linesB[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
      }
    }

    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < linesA.length && j < linesB.length) {
      if (linesA[i] === linesB[j]) {
        pairs.push([i, j]);
        i += 1;
        j += 1;
      } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return pairs;
  }

  // O(n*m) time and space, sized for clipboard-length text, not large files.
  function diffLines(textA, textB) {
    const linesA = String(textA).split('\n');
    const linesB = String(textB).split('\n');
    const pairs = longestCommonSubsequence(linesA, linesB);

    const result = [];
    let indexA = 0;
    let indexB = 0;
    pairs.forEach(([pairA, pairB]) => {
      while (indexA < pairA) result.push({ type: 'removed', value: linesA[indexA++] });
      while (indexB < pairB) result.push({ type: 'added', value: linesB[indexB++] });
      result.push({ type: 'unchanged', value: linesA[indexA] });
      indexA += 1;
      indexB += 1;
    });
    while (indexA < linesA.length) result.push({ type: 'removed', value: linesA[indexA++] });
    while (indexB < linesB.length) result.push({ type: 'added', value: linesB[indexB++] });
    return result;
  }
```

Update the `return { ... }` object:

```js
    diffLines,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after Hash:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="diff" aria-selected="false">Diff</button>
          </li>
```

Panel, after the Hash `</article>`:

```html
        <article class="tool-panel" id="tool-diff" data-tool-panel="diff" aria-labelledby="diff-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">08 / DIFF</p>
            <h2 id="diff-title">Diff viewer</h2>
            <p>Compares two texts line by line. Sized for short snippets, not large files.</p>
          </div>
          <form id="diff-form" novalidate>
            <label for="diff-a">Text A</label>
            <textarea id="diff-a" name="diff-a" rows="6" spellcheck="false"></textarea>
            <label for="diff-b">Text B</label>
            <textarea id="diff-b" name="diff-b" rows="6" spellcheck="false"></textarea>
            <button class="button button-primary" type="submit">Compare</button>
          </form>
          <section class="result-card" id="diff-result" aria-live="polite" aria-label="Diff result" hidden>
            <pre class="output-block" id="diff-output"></pre>
          </section>
          <p class="status" id="diff-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add after the hash section:

```js
  // --- Diff viewer ---

  const diffForm = document.querySelector('#diff-form');
  const diffA = document.querySelector('#diff-a');
  const diffB = document.querySelector('#diff-b');
  const diffResult = document.querySelector('#diff-result');
  const diffOutput = document.querySelector('#diff-output');
  const diffStatus = document.querySelector('#diff-status');

  function renderDiff(lines) {
    diffOutput.replaceChildren(...lines.map((line) => {
      const row = document.createElement('span');
      row.className = `diff-line ${line.type}`;
      row.textContent = line.value;
      return row;
    }));
  }

  function runDiff() {
    diffStatus.textContent = '';
    renderDiff(ToolkitCore.diffLines(diffA.value, diffB.value));
    diffResult.hidden = false;
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  diffForm.addEventListener('submit', (event) => { event.preventDefault(); runDiff(); });
```

Update the export line:

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode, runJwtDecode, runRegexTest, runHash, runDiff };
```

- [ ] **Step 7: Add supporting CSS**

In `static/styles.css`, add:

```css
.diff-line { display: block; padding: 0 .3rem; }
.diff-line.added { background: color-mix(in srgb, #22c55e 22%, transparent); }
.diff-line.removed { background: color-mix(in srgb, #ef4444 22%, transparent); }
.diff-line::before { display: inline-block; width: 1.2em; color: var(--muted); content: ' '; }
.diff-line.added::before { content: '+'; color: #4ade80; }
.diff-line.removed::before { content: '-'; color: #f87171; }
```

- [ ] **Step 8: Manually verify**

Run: `npm run dev`
Expected: Text A `a\nb\nc`, Text B `a\nB\nc` (change the middle line) shows `a` plain, `b` marked removed (red, `-`), `B` marked added (green, `+`), `c` plain.

- [ ] **Step 9: Update the manual smoke checklist**

```markdown
- The diff viewer marks a changed middle line as one removed line followed by
  one added line, each visually distinct.
```

- [ ] **Step 10: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js static/styles.css tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add diff viewer tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Case converter

**Files:**
- Modify: `static/toolkit-core.js`
- Test: `tests/toolkit-core.test.js`
- Modify: `static/index.html`
- Modify: `static/app.js`
- Modify: `tests/ui-smoke.md`

**Interfaces:**
- Consumes: `renderCopyRow(label, value)` (from Task 7, same file).
- Produces: `ToolkitCore.convertCase(value)` → object keyed by the ids in `ToolkitCore.CASE_STYLES`, `ToolkitCore.CASE_STYLES` → `[{ id: string, label: string }, ...]` in display order. Last task in the plan — nothing downstream.

- [ ] **Step 1: Write the failing tests**

Add `convertCase` to the `require` destructuring, then append:

```js
// --- Case converter ---

test('space-separated words convert to camelCase and PascalCase', () => {
  const result = convertCase('hello world example');

  assert.equal(result.camelCase, 'helloWorldExample');
  assert.equal(result.PascalCase, 'HelloWorldExample');
});

test('snake_case and kebab-case use lowercase words', () => {
  const result = convertCase('Hello World');

  assert.equal(result.snake_case, 'hello_world');
  assert.equal(result['kebab-case'], 'hello-world');
});

test('CONSTANT_CASE is uppercased with underscores', () => {
  assert.equal(convertCase('hello world').CONSTANT_CASE, 'HELLO_WORLD');
});

test('Title Case capitalizes every word', () => {
  assert.equal(convertCase('hello world')['Title Case'], 'Hello World');
});

test('an existing camelCase input is split on case boundaries', () => {
  const result = convertCase('helloWorldExample');

  assert.equal(result.snake_case, 'hello_world_example');
});

test('mixed delimiters are normalized', () => {
  const result = convertCase('hello_world-example test');

  assert.equal(result.camelCase, 'helloWorldExampleTest');
});

test('empty input produces empty output for every style', () => {
  const result = convertCase('');

  assert.equal(result.camelCase, '');
  assert.equal(result.CONSTANT_CASE, '');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/toolkit-core.test.js`
Expected: FAIL — `convertCase is not defined`.

- [ ] **Step 3: Implement the function**

Add before the final `return { ... };`:

```js
  // --- Case converter ---

  const CASE_STYLES = [
    { id: 'camelCase', label: 'camelCase' },
    { id: 'PascalCase', label: 'PascalCase' },
    { id: 'snake_case', label: 'snake_case' },
    { id: 'kebab-case', label: 'kebab-case' },
    { id: 'CONSTANT_CASE', label: 'CONSTANT_CASE' },
    { id: 'Title Case', label: 'Title Case' },
  ];

  function tokenizeWords(value) {
    return String(value)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((word) => word.toLowerCase());
  }

  function convertCase(value) {
    const words = tokenizeWords(value);
    const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

    return {
      camelCase: words.map((word, index) => (index === 0 ? word : capitalize(word))).join(''),
      PascalCase: words.map(capitalize).join(''),
      snake_case: words.join('_'),
      'kebab-case': words.join('-'),
      CONSTANT_CASE: words.join('_').toUpperCase(),
      'Title Case': words.map(capitalize).join(' '),
    };
  }
```

Update the `return { ... }` object:

```js
    convertCase,
    CASE_STYLES,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/toolkit-core.test.js`
Expected: PASS.

- [ ] **Step 5: Add the panel markup**

Nav entry, after Diff:

```html
          <li role="presentation">
            <button class="nav-item" type="button" role="tab" data-tool="case" aria-selected="false">Case</button>
          </li>
```

Panel, after the Diff `</article>`:

```html
        <article class="tool-panel" id="tool-case" data-tool-panel="case" aria-labelledby="case-title" hidden>
          <div class="panel-heading">
            <p class="panel-kicker">09 / CASE</p>
            <h2 id="case-title">Case converter</h2>
            <p>Converts text between common identifier and title casing styles.</p>
          </div>
          <form id="case-form" novalidate>
            <label for="case-input">Text</label>
            <input id="case-input" name="case-input" type="text" spellcheck="false" />
            <button class="button button-primary" type="submit">Convert</button>
          </form>
          <section class="result-card" id="case-result" aria-live="polite" aria-label="Case conversion result" hidden>
            <dl class="result-list" id="case-list"></dl>
          </section>
          <p class="status" id="case-status" aria-live="polite"></p>
        </article>
```

- [ ] **Step 6: Wire it up in `static/app.js`**

Add after the diff section:

```js
  // --- Case converter ---

  const caseForm = document.querySelector('#case-form');
  const caseInput = document.querySelector('#case-input');
  const caseResult = document.querySelector('#case-result');
  const caseList = document.querySelector('#case-list');
  const caseStatus = document.querySelector('#case-status');

  function runCaseConvert() {
    caseStatus.textContent = '';
    const result = ToolkitCore.convertCase(caseInput.value);
    caseList.replaceChildren(...ToolkitCore.CASE_STYLES.map(({ id, label }) => renderCopyRow(label, result[id])));
    caseResult.hidden = false;
  }
```

Add near the bottom, with the other event listener registrations (before `window.ToolkitApp = ...`):

```js
  caseForm.addEventListener('submit', (event) => { event.preventDefault(); runCaseConvert(); });
```

Update the export line (final form):

```js
  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode, runJwtDecode, runRegexTest, runHash, runDiff, runCaseConvert };
```

- [ ] **Step 7: Manually verify**

Run: `npm run dev`
Expected: entering `hello world` and clicking Convert shows 6 rows (camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, Title Case) with correct values and working Copy buttons.

- [ ] **Step 8: Update the manual smoke checklist**

```markdown
- The case converter turns `hello world` into `helloWorldExample`-style
  output across all 6 styles, each with a working Copy button.
```

(Adjust the example text in the checklist item to match what you actually typed, e.g. `hello world`.)

- [ ] **Step 9: Run the full test suite one last time**

Run: `npm test`
Expected: every test in `tests/toolkit-core.test.js` and `tests/packaged-app.test.js` passes (the packaged-app test is skipped unless `dist/Toolkit.app` exists — run `npm run package:mac` instead if you want it included).

- [ ] **Step 10: Commit**

```bash
git add static/toolkit-core.js tests/toolkit-core.test.js static/index.html static/app.js tests/ui-smoke.md
git commit -m "$(cat <<'EOF'
feat: add case converter tool

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
