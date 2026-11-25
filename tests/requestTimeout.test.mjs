import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  PLACES_TIMEOUT_DETAIL,
  PLACES_TIMEOUT_MS,
  withDeadline,
} from '../src/lib/requestTimeout.ts';
import { placesSearchCopy, searchPlaces } from '../src/lib/placesSearch.ts';
import { probePlaces } from '../src/lib/placesProbe.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');
const search = read('../src/lib/placesSearch.ts');
const probe = read('../src/lib/placesProbe.ts');

test('a finished read returns its value and clears the timer', async () => {
  let cleared = null;
  const result = await withDeadline(async () => 'ok', {
    setTimeoutImpl: (_fn, ms) => {
      assert.equal(ms, PLACES_TIMEOUT_MS);
      return 7;
    },
    clearTimeoutImpl: (handle) => {
      cleared = handle;
    },
  });
  assert.deepEqual(result, { state: 'value', value: 'ok' });
  assert.equal(cleared, 7);
});

test('a deadline bounds the wait and aborts the request without provider prose', async () => {
  let fire = null;
  let observed = null;
  const pending = withDeadline(
    (signal) => {
      observed = signal;
      return new Promise(() => {});
    },
    {
      timeoutMs: 25,
      setTimeoutImpl: (fn, ms) => {
        assert.equal(ms, 25);
        fire = fn;
        return 1;
      },
      clearTimeoutImpl: () => {},
    },
  );
  assert.ok(fire, 'the deadline is armed before work starts');
  assert.equal(observed.aborted, false);
  fire();
  const result = await pending;
  assert.equal(result.state, 'timeout');
  assert.equal(observed.aborted, true, 'a real fetch is cancelled, not left running');
  assert.doesNotMatch(PLACES_TIMEOUT_DETAIL, /secret|error|provider said/i);
});

test('the deadline is bounded to a sane range', async () => {
  for (const ms of [0, -7, 999999]) {
    let seen = null;
    await withDeadline(async () => 'ok', {
      timeoutMs: ms,
      setTimeoutImpl: (_fn, delay) => {
        seen = delay;
        return 1;
      },
      clearTimeoutImpl: () => {},
    });
    assert.ok(seen >= 1 && seen <= 60000, `clamped ${ms} to ${seen}`);
  }
});

test('typed search stops a hung provider with fixed Balla copy', async () => {
  let fire = null;
  const pending = searchPlaces('Berlin', 'https://places.eurosky.tech', {
    fetchImpl: () => new Promise(() => {}),
    timeoutMs: 25,
    setTimeoutImpl: (fn) => {
      fire = fn;
      return 1;
    },
    clearTimeoutImpl: () => {},
  });
  fire();
  const result = await pending;
  assert.equal(result.state, 'timeout');
  assert.deepEqual(result.hits, []);
  assert.match(placesSearchCopy(result.state), /did not answer in time/);
  assert.match(placesSearchCopy(result.state), /still add the name you typed/);
  assert.doesNotMatch(placesSearchCopy(result.state), /aborted|secret/i);
});

test('the Services places check stops a hung provider with fixed copy', async () => {
  let fire = null;
  const pending = probePlaces('https://places.eurosky.tech', {
    fetchImpl: () => new Promise(() => {}),
    timeoutMs: 25,
    setTimeoutImpl: (fn) => {
      fire = fn;
      return 1;
    },
    clearTimeoutImpl: () => {},
  });
  fire();
  const result = await pending;
  assert.equal(result.state, 'unavailable');
  assert.equal(result.status, null);
  assert.equal(result.detail, PLACES_TIMEOUT_DETAIL);
  assert.ok(typeof result.latencyMs === 'number');
});

test('the picker shows timeout as an alert and never sends a position', () => {
  const sheet = read('../src/components/PlacePickerSheet.tsx');
  assert.match(sheet, /state === 'ready' \? undefined : 'alert'/);
  assert.match(sheet, /state === 'ready' \? p\.secondary : p\.danger/);
  assert.match(search, /withDeadline\(async \(signal\)/);
  assert.match(probe, /withDeadline\(async \(signal\)/);
  assert.match(search, /signal,/);
  assert.match(probe, /signal,/);
  // The POST body still comes from the one position-free builder.
  assert.match(search, /body: placesSearchBody\(query\)/);
  assert.match(probe, /body: placesSearchBody\(PLACES_SEARCH_CANARY\)/);
});

test('docs and version parity match the timeout slice', () => {
  assert.match(changelog, /^## 0\.80\.0$/m);
  assert.match(changelog, /hung places provider/);
  assert.match(changelog, /scope count stays 112/);
  assert.match(compliance, /bounded deadline/);
  assert.match(features, /bounded deadline/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.84.0');
  assert.equal(appJson.expo.version, '0.84.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.84\.0<\/string>/);
  }
});
