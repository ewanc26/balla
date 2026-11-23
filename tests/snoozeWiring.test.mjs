import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the snooze store is device-local storage, never a protocol write', () => {
  const store = read('../src/lib/snooze.ts');
  assert.match(store, /AsyncStorage\.setItem/);
  assert.match(store, /AsyncStorage\.getItem/);
  assert.doesNotMatch(
    store,
    /from '\.\/agent'|createRecord\(|putRecord\(|getRecord\(/,
    'the store never reaches the protocol'
  );
  assert.match(store, /useSnoozedAccounts/);
});

test('both account menus offer the visible 30-day snooze beside mute and block', () => {
  for (const path of [
    '../src/components/PostMenu.tsx',
    '../src/components/ProfileMenu.tsx',
  ]) {
    const menu = read(path);
    assert.match(menu, /label="Snooze for 30 days"/, `${path} offers snooze`);
    assert.match(menu, /label="End snooze"/, `${path} always offers the exit`);
    assert.match(menu, /snoozeRemainingLabel/, `${path} states the countdown`);
    assert.match(menu, /snoozeAccount\(/, `${path} writes the local record`);
    assert.match(menu, /endSnooze\(/, `${path} can end it`);
    assert.match(menu, /this device/i, `${path} states it is device-local`);
    assert.match(menu, /They are not told/, `${path} states the account is not told`);
  }
});

test('only the Home feed assembly applies snoozes, and order is preserved', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  assert.match(feed, /useSnoozedAccounts\(\)/);
  assert.match(feed, /filterSnoozedItems\(posts, snoozedAccounts, Date\.now\(\)\)/);
  assert.match(feed, /activeFeed\s*\n?\s*\? unsnoozed/);

  for (const path of [
    '../src/screens/NotificationsScreen.tsx',
    '../src/screens/ThreadScreen.tsx',
    '../src/screens/ChatScreen.tsx',
    '../src/screens/ConversationScreen.tsx',
    '../src/screens/ProfileScreen.tsx',
    '../src/screens/ComposeScreen.tsx',
  ]) {
    assert.doesNotMatch(read(path), /snooze/i, `${path} is not filtered`);
  }
});

test('Following preferences list active snoozes and revoke them in one action', () => {
  const screen = read('../src/screens/FeedPreferencesScreen.tsx');
  assert.match(screen, /useSnoozedAccounts\(\)/);
  assert.match(screen, /activeSnoozes\(snoozedAccounts, Date\.now\(\)\)/);
  assert.match(screen, /title="Snoozed accounts"/);
  assert.match(screen, /No snoozed accounts\./);
  assert.match(screen, /snoozeRemainingLabel/);
  assert.match(screen, /endSnooze\(item\.did\)/);
  assert.match(screen, /accessibilityLabel=\{`End snooze for/);
  assert.match(screen, /device-local/);
});
