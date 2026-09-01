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

  jsonForm.addEventListener('submit', (event) => { event.preventDefault(); runJson('format'); });
  jsonForm.querySelector('[data-json-action="minify"]').addEventListener('click', () => runJson('minify'));

  encodeForm.addEventListener('submit', (event) => { event.preventDefault(); runEncode('encode'); });
  encodeForm.querySelector('[data-encode-action="decode"]').addEventListener('click', () => runEncode('decode'));

  window.ToolkitApp = { convert, generateIds, copyText, clearIds, activateTool, runJson, runEncode };
})();
