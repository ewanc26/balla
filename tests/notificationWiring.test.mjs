import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('notification rows deep-link follows to a profile and posts to a thread', () => {
  const screen = read('../src/screens/NotificationsScreen.tsx');

  assert.match(screen, /from '\.\.\/lib\/notificationModel'/);
  assert.match(screen, /notificationTarget\(first, author\)/);
  assert.match(screen, /navigation\.navigate\('UserProfile', \{ actor: target\.did \}\)/);
  assert.match(screen, /navigation\.navigate\('Thread', \{ uri: target\.uri \}\)/);
  assert.match(screen, /disabled=\{!target\}/);
  assert.match(screen, /accessibilityRole=\{target \? 'button' : undefined\}/);
  assert.match(screen, /notificationTargetAction\(target\)/);

  // The old helper that left follows inert must be gone.
  assert.doesNotMatch(screen, /function threadUri\(/);
});

test('the UserProfile route accepts the actor param used by the follow deep-link', () => {
  const linking = read('../src/lib/webLinking.ts');
  assert.match(linking, /UserProfile: 'profile\/:actor'/);
  const app = read('../App.tsx');
  assert.match(app, /<Stack\.Screen name="UserProfile"/);
});
