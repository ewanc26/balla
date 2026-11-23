import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const settings = read('../src/screens/SettingsScreen.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const contentFilters = read('../src/screens/ContentFiltersScreen.tsx');

test('Advanced is a real stack screen with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="Advanced" component=\{AdvancedScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.Advanced, 'settings/advanced');
});

test('Settings exposes Advanced, and Advanced links only to a working surface', () => {
  assert.match(settings, /label="Advanced"/);
  assert.match(settings, /navigation\.navigate\('Advanced'\)/);
  assert.match(
    advanced,
    /navigation\.navigate\('ContentFilters', \{ section: 'labelers' \}\)/
  );
  // No inert placeholders: every row must navigate to a registered screen.
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
  assert.match(advanced, /Labels are advisory metadata from services you choose/);
});

test('the labeler surface shows real per-service state and local-filter resilience', () => {
  assert.match(contentFilters, /route\?\.params\?\.section !== 'labelers'/);
  assert.match(contentFilters, /labelersRef\.current\?\.measureLayout/);
  assert.match(contentFilters, /setServicesAvailable/);
  assert.match(contentFilters, /Subscribed · listed by the AppView/);
  assert.match(contentFilters, /not listed by the AppView, local rules still apply/);
  // Existing add/remove and test-subscribe paths remain intact.
  assert.match(contentFilters, /agent\.getLabelers\(\{ dids: \[did\], detailed: true \}\)/);
  assert.match(contentFilters, /agent\.addLabeler\(did\)/);
  assert.match(contentFilters, /agent\.removeLabeler\(labeler\.did\)/);
});
