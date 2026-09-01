(() => {
  'use strict';

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

  async function request(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'The request could not be completed. Please try again.');
    }
    return data;
  }

  async function convert(value = timestampInput.value, timezone = timezoneSelect.value) {
    setError(timestampError, '');
    convertStatus.textContent = '';
    try {
      const result = await request('/api/convert', {
        value: String(value),
        local_timezone: String(timezone).trim() || null,
      });
      Object.entries(resultFields).forEach(([key, element]) => { element.textContent = String(result[key]); });
      resultLocalLabel.textContent = timezone === detectedTimezone ? 'Local time' : `Time in ${timezone}`;
      convertResult.hidden = false;
      return result;
    } catch (error) {
      convertResult.hidden = true;
      // The API already phrases its errors as recovery instructions.
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
      copyButton.addEventListener('click', () => copyText(id, `Copied ${id}.`));
      item.append(value, copyButton);
      idList.append(item);
    });
    const hasIds = generatedIds.length > 0;
    copyAllButton.disabled = !hasIds;
    clearButton.disabled = !hasIds;
  }

  async function generateIds(count = countInput.value) {
    setError(uuidError, '');
    try {
      const result = await request('/api/uuids', { count: Number(count) });
      generatedIds.splice(0, generatedIds.length, ...result.ids);
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

  async function copyText(text, successMessage = 'Copied to clipboard.', statusElement = uuidStatus) {
    try {
      await navigator.clipboard.writeText(text);
      statusElement.textContent = successMessage;
      return true;
    } catch (error) {
      statusElement.textContent = 'Copy failed. Select the value and copy it manually.';
      return false;
    }
  }

  function copyResultValue(button) {
    const value = document.getElementById(button.dataset.copyTarget).textContent;
    const label = button.closest('.result-row').querySelector('dt').textContent;
    return copyText(value, `Copied ${label}.`, convertStatus);
  }

  function clearIds() {
    generatedIds.splice(0, generatedIds.length);
    renderIds();
    uuidStatus.textContent = 'Generated IDs cleared from this session.';
  }

  populateTimezones();

  convertForm.addEventListener('submit', (event) => { event.preventDefault(); convert(); });
  uuidForm.addEventListener('submit', (event) => { event.preventDefault(); generateIds(); });
  convertResult.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', () => copyResultValue(button));
  });
  copyAllButton.addEventListener('click', () => copyText(generatedIds.join('\n'), `Copied all ${generatedIds.length} IDs.`));
  clearButton.addEventListener('click', clearIds);

  window.ToolkitApp = { convert, generateIds, copyText, clearIds };
})();
