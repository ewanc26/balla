import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// An unknown icon name renders as a "?" with only a development warning, and
// the screens pass names through untyped props, so check them against the font.
const glyphs = JSON.parse(
  readFileSync(
    new URL(
      '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const src = new URL('../src/', import.meta.url);
const files = [
  new URL('../App.tsx', import.meta.url),
  ...readdirSync(src, { recursive: true })
    .filter((file) => /\.tsx?$/.test(file))
    .map((file) => new URL(file, src)),
];

const PATTERNS = [
  // Any quoted name carrying an Ionicons style suffix.
  /['"]([a-z0-9]+(?:-[a-z0-9]+)*-(?:outline|sharp))['"]/g,
  // Filled icons written straight onto the component or an icon prop.
  /<Ionicons[^>]*?\bname="([a-z0-9-]+)"/g,
  /\bicon="([a-z0-9-]+)"/g,
];

test('every icon name exists in the icon font', () => {
  const missing = [];
  let found = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      for (const [, name] of source.matchAll(pattern)) {
        found += 1;
        if (!(name in glyphs)) missing.push(`${file.pathname.split('/').pop()}: ${name}`);
      }
    }
  }
  assert.ok(found > 200, `the scan should see the app's icons, saw ${found}`);
  assert.deepEqual([...new Set(missing)].sort(), []);
});
