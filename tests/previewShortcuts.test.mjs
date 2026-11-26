import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { SERVICE_HOSTS } from '../src/lib/serviceHosts.ts';

const root = new URL('../src/', import.meta.url);
const mock = readFileSync(new URL('lib/mock.ts', root), 'utf8');

// Web linking rewrites the address when the navigator mounts, so a query read
// any later than module load is already gone.
test('the preview reads its opening query once, before navigation rewrites it', () => {
  assert.match(mock, /const OPENING_QUERY: string =\n  Platform\.OS === 'web'/);
  assert.equal(mock.match(/location\?\.search/g).length, 1);
  const reader = mock.slice(mock.indexOf('function queryParam'));
  assert.doesNotMatch(reader, /location/);
  assert.match(reader, /\.exec\(OPENING_QUERY\)/);
});

test('preview screens that need an address are given one', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(
    app,
    /screen === 'StarterPack' \|\| screen === 'StarterPackEdit'\) \{\s*navigationRef\.navigate\(screen, \{ uri: MOCK_STARTER_PACK_URI \}\);/,
  );
});

test('the default moderation service is named in one place', () => {
  const files = readdirSync(root, { recursive: true }).filter((file) => /\.tsx?$/.test(file));
  const naming = files.filter((file) =>
    readFileSync(new URL(file, root), 'utf8').includes(SERVICE_HOSTS.labelerDid),
  );
  assert.deepEqual(naming, ['lib/serviceHosts.ts']);
});
