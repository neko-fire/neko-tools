# Toolkit Single-pager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark single-page UTC converter and Python-backed UUIDv7 generator for browser and macOS Electron use.

**Architecture:** FastAPI owns conversion and UUID APIs and serves framework-free static assets. Electron starts that local server and displays it; each future feature adds one backend module, route, front-end panel, and manifest record.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, uuid6, pytest, HTML/CSS/JavaScript, Electron, electron-builder.

**Spec:** `docs/superpowers/specs/2026-08-27-toolkit-design.md`

## Global Constraints

- Python is authoritative for conversion and UUIDv7 generation; JavaScript cannot generate canonical results.
- UUID lists are in-memory only; no browser storage, files, accounts, or remote services.
- Accept ISO date-times and Unix seconds/milliseconds; render UTC ISO, local time, Unix seconds, Unix milliseconds, and relative time.
- Use warm near-black surfaces, one blue accent, system type, labelled controls, visible focus, and reduced-motion support.
- Only opacity/transform transitions, 160–220 ms, no input blocking or layout shifts.
- Do not use a frontend framework or add dependencies beyond FastAPI/Uvicorn/uuid6 and Electron/electron-builder.

---

## File Structure

- `pyproject.toml`: Python project metadata.
- `toolkit_api/main.py`: FastAPI construction, API registration, static hosting.
- `toolkit_api/features/time_converter.py`: canonical date parsing/conversion.
- `toolkit_api/features/uuid_generator.py`: Python UUIDv7 batches.
- `toolkit_api/features/manifest.py`: extensible feature registration.
- `toolkit_api/routes/*.py`: HTTP adapters.
- `static/index.html`, `static/styles.css`, `static/app.js`: the responsive UI.
- `electron/main.cjs`, `electron/preload.cjs`, `package.json`: desktop lifecycle/package build.
- `tests/`: pytest unit/API coverage and written smoke checks.

### Task 1: Scaffold the testable Python service

**Files:**
- Create: `pyproject.toml`
- Create: `toolkit_api/__init__.py`
- Create: `toolkit_api/main.py`
- Create: `tests/test_api.py`

**Interfaces:** Produces `create_app() -> FastAPI` and `app`, served by `uvicorn toolkit_api.main:app`.

- [ ] **Step 1: Write the failing health test**

```python
from fastapi.testclient import TestClient
from toolkit_api.main import create_app

def test_health():
    assert TestClient(create_app()).get('/api/health').json() == {'status': 'ok'}
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `python -m pytest tests/test_api.py::test_health -v`

Expected: FAIL because `toolkit_api` is missing.

- [ ] **Step 3: Add the minimal service**

```toml
[project]
name = "toolkit"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["fastapi>=0.115", "uvicorn[standard]>=0.30", "uuid6>=2024.7.10"]
[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]
```

```python
def create_app() -> FastAPI:
    app = FastAPI()
    app.get('/api/health')(lambda: {'status': 'ok'})
    return app
app = create_app()
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `python -m pytest tests/test_api.py::test_health -v`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add pyproject.toml toolkit_api tests/test_api.py && git commit -m "feat: scaffold local toolkit API"`

### Task 2: Add the complete timestamp conversion API

**Files:**
- Create: `toolkit_api/features/time_converter.py`
- Create: `toolkit_api/routes/time.py`
- Create: `tests/test_time_converter.py`
- Modify: `toolkit_api/main.py`

**Interfaces:** Produces `convert_timestamp(value: str, local_timezone: str | None = None) -> dict[str, str | int]` and `POST /api/convert` with JSON `{ "value": str, "local_timezone": str | null }`.

- [ ] **Step 1: Write failing conversion tests**

```python
def test_epoch_seconds_are_normalized():
    result = convert_timestamp('0', 'UTC')
    assert result['utc_iso'] == '1970-01-01T00:00:00Z'
    assert result['unix_seconds'] == result['unix_milliseconds'] == 0

def test_iso_input_becomes_unix_seconds():
    assert convert_timestamp('2024-01-01T00:00:00Z', 'UTC')['unix_seconds'] == 1704067200
```

- [ ] **Step 2: Confirm failure**

Run: `python -m pytest tests/test_time_converter.py -v`

Expected: FAIL because the converter module is missing.

- [ ] **Step 3: Implement parser, renderer, and error adapter**

```python
def convert_timestamp(value: str, local_timezone: str | None = None) -> dict[str, str | int]:
    """Normalize ISO inputs and Unix seconds/milliseconds to display fields."""
```

Translate trailing `Z` to `+00:00`; parse ISO with `datetime.fromisoformat`; assume UTC if no offset; numeric magnitude below `100000000000` is seconds otherwise milliseconds. Use `ZoneInfo` for local output and calculate relative time from UTC now. The route maps bad input to HTTP 422 with `Enter an ISO date/time or Unix timestamp in seconds or milliseconds.`

- [ ] **Step 4: Add error test and verify**

```python
def test_invalid_input_is_actionable(client):
    response = client.post('/api/convert', json={'value': 'not-a-date'})
    assert response.status_code == 422
    assert 'ISO date/time' in response.json()['detail']
```

Run: `python -m pytest tests/test_time_converter.py tests/test_api.py -v`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add toolkit_api tests && git commit -m "feat: add UTC timestamp conversion"`

### Task 3: Add UUIDv7 generation through Python

**Files:**
- Create: `toolkit_api/features/uuid_generator.py`
- Create: `toolkit_api/routes/uuids.py`
- Create: `tests/test_uuid_generator.py`
- Modify: `toolkit_api/main.py`

**Interfaces:** Produces `generate_uuid7_batch(count: int) -> list[str]` and `POST /api/uuids` accepting `{ "count": 1..100 }` and returning `{ "ids": list[str] }`.

- [ ] **Step 1: Write failing UUID tests**

```python
def test_batch_is_requested_size_and_version_seven():
    values = generate_uuid7_batch(3)
    assert len(values) == 3
    assert all(uuid.UUID(item).version == 7 for item in values)

def test_invalid_batch_size_is_rejected():
    with pytest.raises(ValueError, match='between 1 and 100'):
        generate_uuid7_batch(101)
```

- [ ] **Step 2: Confirm failure**

Run: `python -m pytest tests/test_uuid_generator.py -v`

Expected: FAIL because the generator module is missing.

- [ ] **Step 3: Implement Python UUIDv7 batches and 422 mapping**

```python
from uuid6 import uuid7

def generate_uuid7_batch(count: int) -> list[str]:
    if not 1 <= count <= 100:
        raise ValueError('Choose a quantity between 1 and 100.')
    return [str(uuid7()) for _ in range(count)]
```

- [ ] **Step 4: Verify unit and route behaviour**

Run: `python -m pytest tests/test_uuid_generator.py tests/test_api.py -v`

Expected: PASS, including API counts `3` and `0`.

- [ ] **Step 5: Commit**

Run: `git add toolkit_api tests && git commit -m "feat: add Python UUIDv7 generation"`

### Task 4: Build the accessible dark page

**Files:**
- Create: `static/index.html`
- Create: `static/styles.css`
- Create: `static/app.js`
- Create: `toolkit_api/features/manifest.py`
- Create: `tests/ui-smoke.md`
- Modify: `toolkit_api/main.py`

**Interfaces:** Consumes both POST endpoints. Produces `window.ToolkitApp` with `convert`, `generateIds`, `copyText`, and `clearIds` functions for smoke testing.

- [ ] **Step 1: Record the browser smoke check**

Write `tests/ui-smoke.md` asserting: `/` loads; submitting `0` shows `1970-01-01T00:00:00Z`; generating 3 IDs works; individual/all copy feedback appears; clear removes IDs; `invalid` has inline recovery guidance.

- [ ] **Step 2: Confirm the check fails before mounting assets**

Run: `python -m uvicorn toolkit_api.main:app --port 8000`

Expected: `/` responds 404.

- [ ] **Step 3: Implement two panels and reusable UI behaviour**

Use labelled forms, `aria-live="polite"` for copy/status feedback, `role="alert"` for errors, 44px controls, and an in-memory JavaScript ID array. Mount static files after API routes. Create a manifest with `time_converter` and `uuid_generator` entries. Implement 160–220ms transform/opacity transitions and disable them in `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 4: Verify page behaviour and accessibility**

Run: `python -m uvicorn toolkit_api.main:app --port 8000`

Expected: all smoke assertions pass; Tab reaches every action; focus is visible; 375px has no horizontal scroll; reduced motion removes animation.

- [ ] **Step 5: Commit**

Run: `git add static toolkit_api tests/ui-smoke.md && git commit -m "feat: add dark toolkit single-page UI"`

### Task 5: Package Electron for macOS

**Files:**
- Create: `electron/main.cjs`
- Create: `electron/preload.cjs`
- Create: `package.json`
- Create: `tests/electron-smoke.md`
- Modify: `.gitignore`

**Interfaces:** Produces `npm run desktop` and `npm run package:mac`; starts `python -m uvicorn toolkit_api.main:app --host 127.0.0.1 --port 8765`.

- [ ] **Step 1: Record the Electron acceptance check**

Write `tests/electron-smoke.md`: desktop opens a Toolkit window containing both panels; close terminates Python; an unavailable Python command shows a restart message instead of blank content.

- [ ] **Step 2: Confirm the script is missing**

Run: `npm run desktop`

Expected: FAIL because the package script does not exist.

- [ ] **Step 3: Implement local process lifecycle and packaging config**

Spawn Python using `child_process.spawn`, poll `/api/health`, then use `BrowserWindow` with `titleBarStyle: 'hiddenInset'`, `backgroundColor: '#101113'`, `width: 1180`, `height: 780`, `minWidth: 760`, and `minHeight: 620`. Load the local URL; kill Python on `before-quit`; load a concise data-URL recovery page on launch failure. Set electron-builder `mac.target` to `['dmg']` and use `extraResources` for Python/static assets.

- [ ] **Step 4: Verify the Electron smoke check**

Run: `npm install && npm run desktop`

Expected: all Electron smoke assertions pass.

- [ ] **Step 5: Commit**

Run: `git add electron package.json package-lock.json .gitignore tests/electron-smoke.md && git commit -m "feat: package toolkit for macOS"`

### Task 6: Verify and document delivery

**Files:**
- Create: `README.md`

**Interfaces:** Documents browser run, desktop run, macOS packaging, and session-only UUID behaviour.

- [ ] **Step 1: Add exact run instructions**

Document `python -m pip install -e '.[dev]'`, `python -m uvicorn toolkit_api.main:app --reload`, `npm install`, `npm run desktop`, and `npm run package:mac`.

- [ ] **Step 2: Run backend tests**

Run: `python -m pytest -v`

Expected: PASS for parsing, invalid input, UUIDv7, count validation, and API tests.

- [ ] **Step 3: Run integrated smoke checks**

Run: `python -m uvicorn toolkit_api.main:app --port 8000` and `npm run desktop`

Expected: every assertion in both smoke-check files passes.

- [ ] **Step 4: Build the macOS artifact**

Run: `npm run package:mac`

Expected: a `.dmg` exists under `dist/`.

- [ ] **Step 5: Commit**

Run: `git add README.md && git commit -m "docs: add toolkit run instructions"`
