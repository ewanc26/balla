import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  TOGGLE_KNOB,
  TOGGLE_TRACK_HEIGHT,
  TOGGLE_TRACK_INSET,
  TOGGLE_TRACK_WIDTH,
} from '../src/lib/toggleModel.ts';

const root = new URL('../src/', import.meta.url);
const toggle = readFileSync(new URL('components/Toggle.tsx', root), 'utf8');

test('the switch track is a pill the knob can visibly travel along', () => {
  assert.ok(TOGGLE_TRACK_WIDTH >= TOGGLE_TRACK_HEIGHT * 1.6);
  assert.equal(TOGGLE_KNOB, TOGGLE_TRACK_HEIGHT - 2 * TOGGLE_TRACK_INSET);
  assert.ok(TOGGLE_TRACK_WIDTH - 2 * TOGGLE_TRACK_INSET - TOGGLE_KNOB >= TOGGLE_KNOB / 2);
});

test('the 44pt target wraps the track instead of reshaping it', () => {
  assert.match(toggle, /target: \{\s*\.\.\.touchTargetStyle,/);
  const track = toggle.match(/  track: \{[^}]*\}/)[0];
  assert.doesNotMatch(track, /touchTargetStyle|minHeight|minWidth/);
});

test('every on/off switch in the app is the shared one', () => {
  const files = readdirSync(root, { recursive: true }).filter((file) => file.endsWith('.tsx'));
  assert.ok(files.length > 100);
  for (const file of files) {
    if (file.endsWith('Toggle.tsx')) continue;
    const source = readFileSync(new URL(file, root), 'utf8');
    assert.doesNotMatch(source, /accessibilityRole="switch"|<Switch\b/, file);
  }
});
