import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the music activity preference is device-local and defaults on', () => {
  const prefs = read('../src/lib/preferences.tsx');
  assert.match(prefs, /showMusicActivity: boolean/);
  assert.match(prefs, /showMusicActivity: true/);
  assert.match(prefs, /typeof parsed\?\.showMusicActivity === 'boolean'/);
  assert.match(prefs, /setShowMusicActivity/);
  // It belongs with the local choices, never the server-backed preference stores.
  assert.doesNotMatch(prefs, /setShowMusicActivity[\s\S]*agent\.setPreferences/);
});

test('Appearance has one visible switch for music activity', () => {
  const screen = read('../src/screens/AppearanceScreen.tsx');
  assert.match(screen, /SettingSwitch/);
  assert.match(screen, /value=\{preferences\.showMusicActivity\}/);
  assert.match(screen, /onChange=\{setShowMusicActivity\}/);
  assert.match(screen, /Show recent plays/);
});

test('profiles render the strip only when enabled and never in the feed', () => {
  const screen = read('../src/screens/ProfileScreen.tsx');
  assert.match(screen, /<MusicActivityStrip did=\{profile\.did\} enabled=\{preferences\.showMusicActivity\} \/>/);
  assert.match(screen, /!showProfileWarning && !isBlocked/);
  assert.match(screen, /ListHeaderComponent=\{Header\}/);
  // Music activity must not be injected into chronological feed items.
  assert.doesNotMatch(screen, /feedItems[\s\S]*MusicActivityStrip/);
});

test('teal reads are bounded, retryable and use the shared external opener', () => {
  const reader = read('../src/lib/teal.ts');
  const strip = read('../src/components/MusicActivityStrip.tsx');
  assert.match(reader, /agent\.com\.atproto\.identity\.resolveDid/);
  assert.match(reader, /readWithRetry/);
  assert.match(reader, /com\.atproto\.repo\.listRecords/);
  assert.match(reader, /Promise\.allSettled/);
  assert.match(read('../src/lib/tealModel.ts'), /fm\.teal\.alpha\.feed\.play/);
  assert.match(strip, /openExternalUrl/);
  assert.match(strip, /timeAgo/);
  assert.doesNotMatch(strip, /Linking\.openURL/);
  // No player, no scrobbling, no writes.
  assert.doesNotMatch(strip + reader, /AVPlayer|expo-av|Audio\.|putRecord|createRecord|deleteRecord/);
});

test('opening teal activity adds no OAuth scope', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(scopes.length, 111);
  assert.equal(scopes.some((scope) => scope.includes('fm.teal')), false);
});
