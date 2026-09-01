const assert = require('node:assert');
const { test } = require('node:test');

const {
  convertTimestamp,
  generateUuid7Batch,
  formatJson,
  minifyJson,
  encodeText,
  decodeText,
  decodeJwt,
  testRegex,
  hashText,
  diffLines,
  UNKNOWN_TIMEZONE_MESSAGE,
  INVALID_TIMESTAMP_MESSAGE,
  INVALID_UUID_COUNT_MESSAGE,
  INVALID_JSON_MESSAGE,
  INVALID_ENCODING_INPUT_MESSAGE,
  INVALID_JWT_MESSAGE,
  INVALID_REGEX_MESSAGE,
} = require('../static/toolkit-core.js');

// --- Timestamp conversion (ported from tests/test_time_converter.py) ---

test('epoch seconds are normalized', () => {
  const result = convertTimestamp('0', 'UTC');

  assert.equal(result.utc_iso, '1970-01-01T00:00:00Z');
  assert.equal(result.unix_seconds, 0);
  assert.equal(result.unix_milliseconds, 0);
});

test('ISO input becomes unix seconds', () => {
  assert.equal(convertTimestamp('2024-01-01T00:00:00Z', 'UTC').unix_seconds, 1704067200);
});

test('invalid input is actionable', () => {
  assert.throws(() => convertTimestamp('not-a-date', 'UTC'), (error) => {
    assert.equal(error.message, INVALID_TIMESTAMP_MESSAGE);
    assert.match(error.message, /ISO date\/time/);
    return true;
  });
});

test('local time is rendered in the requested zone', () => {
  const result = convertTimestamp('1700000000', 'Europe/Berlin');

  assert.equal(result.local_time, '2023-11-14T23:13:20+01:00');
  assert.equal(result.utc_iso, '2023-11-14T22:13:20Z');
});

test('invalid local timezone names the time zone, not the timestamp', () => {
  assert.throws(() => convertTimestamp('0', 'Not/AZone'), (error) => {
    assert.equal(error.message, UNKNOWN_TIMEZONE_MESSAGE);
    return true;
  });
});

test('rejected time zone key is reported as a time zone problem', () => {
  assert.throws(() => convertTimestamp('0', '/etc/localtime'), (error) => {
    assert.equal(error.message, UNKNOWN_TIMEZONE_MESSAGE);
    return true;
  });
});

// --- Conversion edge cases the Python implementation handled ---
// The logic is a reimplementation, not a copy, so the behaviors the original
// only covered implicitly are pinned here.

test('large numbers are read as milliseconds', () => {
  const result = convertTimestamp('1700000000000', 'UTC');

  assert.equal(result.utc_iso, '2023-11-14T22:13:20Z');
  assert.equal(result.unix_seconds, 1700000000);
});

test('sub-second input keeps millisecond precision', () => {
  assert.equal(convertTimestamp('1700000000.5', 'UTC').utc_iso, '2023-11-14T22:13:20.500Z');
});

test('a naive ISO timestamp is treated as UTC', () => {
  assert.equal(convertTimestamp('2024-01-01T00:00:00', 'UTC').unix_seconds, 1704067200);
});

test('an ISO offset is honored', () => {
  assert.equal(convertTimestamp('2024-01-01T01:00:00+01:00', 'UTC').unix_seconds, 1704067200);
});

test('a date without a time is midnight UTC', () => {
  assert.equal(convertTimestamp('2024-01-01', 'UTC').utc_iso, '2024-01-01T00:00:00Z');
});

test('empty input is rejected', () => {
  assert.throws(() => convertTimestamp('   ', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
});

test('a hex literal is not a timestamp', () => {
  assert.throws(() => convertTimestamp('0x10', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
});

test('a non-finite number is rejected', () => {
  assert.throws(() => convertTimestamp('Infinity', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
});

test('relative time reads as past or future', () => {
  const now = Date.now();
  const twoDaysAgo = String(Math.trunc(now / 1000) - 2 * 86400);
  // +1s of slack: the elapsed millisecond between building the input and
  // measuring against Date.now() would otherwise truncate 3 hours to 2.
  const threeHoursAhead = String(Math.trunc(now / 1000) + 3 * 3600 + 1);

  assert.equal(convertTimestamp(twoDaysAgo, 'UTC').relative_time, '2 days ago');
  assert.equal(convertTimestamp(threeHoursAhead, 'UTC').relative_time, 'in 3 hours');
  assert.equal(convertTimestamp(String(Math.trunc(now / 1000)), 'UTC').relative_time, 'just now');
});

test('a single unit is not pluralized', () => {
  const oneDayAgo = String(Math.trunc(Date.now() / 1000) - 86400 - 5);

  assert.equal(convertTimestamp(oneDayAgo, 'UTC').relative_time, '1 day ago');
});

// --- Regressions found by differential-testing the port against the Python ---

test('a two-digit year is not folded into the 1900s', () => {
  // Date.UTC(49, ...) means 1949, which corrupted both parsing and the
  // offset lookup for years under 100.
  const result = convertTimestamp('0049-11-27T02:13:34Z', 'Africa/Cairo');

  assert.equal(result.utc_iso, '0049-11-27T02:13:34Z');
  assert.equal(result.local_time, '0049-11-27T04:18:43+02:05:09');
});

test('pre-standardization zones keep their local mean time offset', () => {
  // Zones carried second-precision offsets before they standardized.
  assert.equal(convertTimestamp('-6257396485', 'Africa/Cairo').local_time, '1771-09-17T12:23:44+02:05:09');
  assert.equal(convertTimestamp('-47477049320', 'Europe/Dublin').local_time, '0465-07-06T02:19:19-00:25:21');
});

test('a millisecond input round-trips exactly', () => {
  // The Python implementation recomputed this through a float and lost 1ms.
  assert.equal(convertTimestamp('136881230253', 'UTC').unix_milliseconds, 136881230253);
});

test('timestamps outside years 1-9999 are rejected', () => {
  assert.throws(() => convertTimestamp('-70000000000', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
  assert.throws(() => convertTimestamp('260000000000000', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
});

test('an impossible calendar date is rejected', () => {
  assert.throws(() => convertTimestamp('2024-02-31T00:00:00Z', 'UTC'), { message: INVALID_TIMESTAMP_MESSAGE });
});

// --- UUIDv7 (ported from tests/test_uuid_generator.py) ---

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('batch is the requested size and version seven', () => {
  const values = generateUuid7Batch(3);

  assert.equal(values.length, 3);
  assert.ok(values.every((value) => UUID_PATTERN.test(value)), `not all v7: ${values}`);
});

test('invalid batch size is rejected', () => {
  assert.throws(() => generateUuid7Batch(101), { message: INVALID_UUID_COUNT_MESSAGE });
});

test('zero is rejected with a recovery message', () => {
  assert.throws(() => generateUuid7Batch(0), (error) => {
    assert.match(error.message, /between 1 and 100/);
    return true;
  });
});

test('a non-integer count is rejected', () => {
  assert.throws(() => generateUuid7Batch(2.5), { message: INVALID_UUID_COUNT_MESSAGE });
  assert.throws(() => generateUuid7Batch(Number.NaN), { message: INVALID_UUID_COUNT_MESSAGE });
});

test('the batch boundaries are inclusive', () => {
  assert.equal(generateUuid7Batch(1).length, 1);
  assert.equal(generateUuid7Batch(100).length, 100);
});

test('generated ids are unique and ordered by time', () => {
  const values = generateUuid7Batch(100);

  assert.equal(new Set(values).size, 100);
  assert.deepEqual([...values].sort(), values, 'v7 ids should sort in generation order');
});

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

// --- Hash generator ---

test('hashText returns SHA family digests', async () => {
  const result = await hashText('abc');

  assert.equal(result['SHA-1'], 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(result['SHA-256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('SHA-384 and SHA-512 digests have the expected lengths', async () => {
  const result = await hashText('abc');

  assert.equal(result['SHA-384'].length, 96);
  assert.equal(result['SHA-512'].length, 128);
});

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
