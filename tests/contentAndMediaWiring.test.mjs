import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('settings exposes the real Content and Media screen', () => {
  const settings = read('../src/screens/SettingsScreen.tsx');
  const screen = read('../src/screens/ContentAndMediaSettingsScreen.tsx');
  const app = read('../App.tsx');
  assert.match(settings, /navigate\('ContentAndMediaSettings'\)/);
  assert.match(app, /<Stack\.Screen name="ContentAndMediaSettings"/);
  assert.match(screen, /Use in-app browser to open links/);
  assert.match(screen, /Autoplay videos and GIFs/);
  // Provider-owned trending config would be a fake control; no such row exists.
  assert.doesNotMatch(screen, /label="[^"]*[Tt]rending/);
});

test('the in-app browser preference is persisted and honored on every link', () => {
  const prefs = read('../src/lib/preferences.tsx');
  const model = read('../src/lib/openLinkModel.ts');
  const provider = read('../src/lib/openLink.tsx');
  assert.match(prefs, /useInAppBrowser: boolean \| undefined/);
  assert.match(prefs, /useInAppBrowser:\s*undefined/);
  assert.match(model, /choice === undefined/);
  assert.match(provider, /WebBrowser\.openBrowserAsync/);
  assert.match(provider, /createContext/);
});

test('all content link press handlers go through the central opener', () => {
  for (const file of [
    '../src/components/PostCard.tsx',
    '../src/screens/InfoScreen.tsx',
    '../src/screens/SettingsScreen.tsx',
    '../src/components/ModerationInboxParts.tsx',
    '../src/screens/ProfileScreen.tsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /Linking\.openURL/, `${file} still uses raw Linking`);
    assert.match(source, /openExternalUrl/, `${file} does not use central opener`);
  }
  const app = read('../App.tsx');
  assert.match(app, /<OpenLinkProvider>/);
});

test('autoplay is device-local and wired into the video player', () => {
  const prefs = read('../src/lib/preferences.tsx');
  const postCard = read('../src/components/PostCard.tsx');
  assert.match(prefs, /disableAutoplay: boolean/);
  assert.match(postCard, /preferences\.disableAutoplay/);
  assert.match(postCard, /player\.play\(\)/);
  assert.match(postCard, /player\.pause\(\)/);
});
