/**
 * Timestamp conversion and UUIDv7 generation.
 *
 * Loaded as a plain script in the app window and required directly by the
 * tests, so it stays free of module syntax and of any DOM access.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ToolkitCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const INVALID_TIMESTAMP_MESSAGE = 'Enter an ISO date/time or Unix timestamp in seconds or milliseconds.';
  const UNKNOWN_TIMEZONE_MESSAGE = 'Select a different display time zone.';
  const INVALID_UUID_COUNT_MESSAGE = 'Choose a quantity between 1 and 100.';
  const INVALID_JSON_MESSAGE = 'Enter valid JSON.';

  // Below this, a number reads as seconds; at or above it, as milliseconds.
  const MILLISECOND_THRESHOLD = 100000000000;
  const MAXIMUM_INSTANT = 8.64e15;

  const pad = (number, width = 2) => String(Math.abs(number)).padStart(width, '0');

  const NUMERIC_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const ISO_PATTERN = new RegExp(
    '^(\\d{4})-(\\d{2})-(\\d{2})'
    + '(?:[T ](\\d{2}):(\\d{2})(?::(\\d{2})(?:[.,](\\d{1,9}))?)?'
    + '(Z|z|[+-]\\d{2}:?\\d{2})?)?$',
  );

  // Date.UTC() folds years 0-99 into the 1900s, which silently corrupts both
  // parsing and offset lookup for antique timestamps.
  function utcFromParts(year, month, day, hour, minute, second, millisecond) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(hour, minute, second, millisecond);
    return date.getTime();
  }

  function convertTimestamp(value, localTimezone) {
    const instant = parseTimestamp(String(value));
    const zone = localTimezone && String(localTimezone).trim() ? String(localTimezone).trim() : 'UTC';

    return {
      utc_iso: formatIso(instant, 0),
      local_time: formatIso(instant, zoneOffsetSeconds(instant, zone)),
      unix_seconds: Math.trunc(instant / 1000),
      unix_milliseconds: instant,
      relative_time: relativeTime(instant),
    };
  }

  function parseTimestamp(value) {
    const cleaned = value.trim();
    if (!cleaned) throw new Error(INVALID_TIMESTAMP_MESSAGE);

    const instant = NUMERIC_PATTERN.test(cleaned)
      ? parseNumericTimestamp(Number(cleaned))
      : parseIsoTimestamp(cleaned);

    // Date reaches years that a calendar date cannot express, so the range is
    // capped at years 1-9999 rather than at Date's own limit.
    if (!Number.isFinite(instant) || Math.abs(instant) > MAXIMUM_INSTANT) {
      throw new Error(INVALID_TIMESTAMP_MESSAGE);
    }
    const year = new Date(instant).getUTCFullYear();
    if (year < 1 || year > 9999) throw new Error(INVALID_TIMESTAMP_MESSAGE);
    return instant;
  }

  function parseNumericTimestamp(numeric) {
    if (!Number.isFinite(numeric)) throw new Error(INVALID_TIMESTAMP_MESSAGE);
    const seconds = Math.abs(numeric) < MILLISECOND_THRESHOLD ? numeric : numeric / 1000;
    return Math.round(seconds * 1000);
  }

  function parseIsoTimestamp(cleaned) {
    const match = ISO_PATTERN.exec(cleaned);
    if (!match) throw new Error(INVALID_TIMESTAMP_MESSAGE);

    const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '', offset] = match;
    const milliseconds = Number((fraction + '000').slice(0, 3));
    const parts = [year, month, day, hour, minute, second].map(Number);
    const instant = utcFromParts(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5], milliseconds);

    // Date.UTC rolls February 31st forward instead of rejecting it.
    const rebuilt = new Date(instant);
    const isRealDate = rebuilt.getUTCFullYear() === parts[0]
      && rebuilt.getUTCMonth() === parts[1] - 1
      && rebuilt.getUTCDate() === parts[2]
      && rebuilt.getUTCHours() === parts[3]
      && rebuilt.getUTCMinutes() === parts[4]
      && rebuilt.getUTCSeconds() === parts[5];
    if (!isRealDate) throw new Error(INVALID_TIMESTAMP_MESSAGE);

    // A timestamp with no offset is read as UTC, matching the input the
    // converter is most often handed: a log line with no zone on it.
    return instant - parseOffsetMinutes(offset) * 60000;
  }

  function parseOffsetMinutes(offset) {
    if (!offset || offset === 'Z' || offset === 'z') return 0;
    const sign = offset[0] === '-' ? -1 : 1;
    const digits = offset.slice(1).replace(':', '');
    return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
  }

  function zoneOffsetSeconds(instant, timeZone) {
    const parts = {};
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      for (const part of formatter.formatToParts(new Date(instant))) parts[part.type] = part.value;
    } catch (error) {
      throw new Error(UNKNOWN_TIMEZONE_MESSAGE);
    }

    const wallClock = utcFromParts(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second), 0,
    );
    return Math.round((wallClock - Math.floor(instant / 1000) * 1000) / 1000);
  }

  function formatIso(instant, offsetSeconds) {
    const shifted = new Date(instant + offsetSeconds * 1000);
    const date = `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
    const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
    const fraction = shifted.getUTCMilliseconds() === 0 ? '' : `.${pad(shifted.getUTCMilliseconds(), 3)}`;

    return `${date}T${time}${fraction}${formatOffset(offsetSeconds)}`;
  }

  function formatOffset(offsetSeconds) {
    if (offsetSeconds === 0) return 'Z';
    const total = Math.abs(offsetSeconds);
    const seconds = total % 60;
    const head = `${offsetSeconds < 0 ? '-' : '+'}${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}`;
    // Zones keep Local Mean Time offsets, to the second, before they
    // standardized -- Africa/Cairo was +02:05:09 until 1900.
    return seconds === 0 ? head : `${head}:${pad(seconds)}`;
  }


  function relativeTime(instant) {
    const seconds = Math.trunc((instant - Date.now()) / 1000);
    if (Math.abs(seconds) < 60) return seconds <= 0 ? 'just now' : 'in a few seconds';

    const absolute = Math.abs(seconds);
    const [divisor, unit] = [[86400, 'day'], [3600, 'hour'], [60, 'minute']]
      .find(([size]) => absolute >= size);
    const quantity = Math.floor(absolute / divisor);
    const plural = quantity === 1 ? '' : 's';

    return seconds > 0 ? `in ${quantity} ${unit}${plural}` : `${quantity} ${unit}${plural} ago`;
  }

  // --- UUIDv7 ---

  let lastTimestamp = -1;
  let sequence = 0;

  function generateUuid7Batch(count) {
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new Error(INVALID_UUID_COUNT_MESSAGE);
    }
    return Array.from({ length: count }, uuid7);
  }

  function uuid7() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    const milliseconds = Date.now();
    // rand_a carries a counter rather than noise, so ids minted inside one
    // millisecond still sort in the order they were generated.
    if (milliseconds === lastTimestamp) sequence = (sequence + 1) & 0x0fff;
    else {
      lastTimestamp = milliseconds;
      sequence = 0;
    }

    let remaining = milliseconds;
    for (let index = 5; index >= 0; index -= 1) {
      bytes[index] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    bytes[6] = 0x70 | (sequence >> 8);
    bytes[7] = sequence & 0xff;
    bytes[8] = 0x80 | (bytes[8] & 0x3f);

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

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

  return {
    convertTimestamp,
    generateUuid7Batch,
    formatJson,
    minifyJson,
    INVALID_TIMESTAMP_MESSAGE,
    UNKNOWN_TIMEZONE_MESSAGE,
    INVALID_UUID_COUNT_MESSAGE,
    INVALID_JSON_MESSAGE,
  };
});
