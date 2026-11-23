import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Memories is a per-account, device-local preference that is off by default', () => {
  const prefs = read('../src/lib/preferences.tsx');
  assert.ok(prefs.includes('memories: {}'));
  assert.ok(prefs.includes('memories: normaliseMemoriesPreferences'));
  assert.ok(prefs.includes('setMemoriesEnabled'));
  assert.ok(prefs.includes('dismissMemories'));
  assert.ok(!prefs.includes('agent.setPreferences'), 'no invented server preference');

  const screen = read('../src/screens/FeedPreferencesScreen.tsx');
  assert.ok(screen.includes('title="Memories"'));
  assert.ok(screen.includes('label="On this day"'));
  assert.ok(screen.includes('value={!!memoriesPreference?.enabled}'));
  assert.ok(screen.includes('setMemoriesEnabled(profile.did, value)'));
});

test('the PDS walk is public, bounded and cached once per account/day', () => {
  const loader = read('../src/lib/memories.ts');
  assert.ok(loader.includes('resolveDidDocument'));
  assert.ok(loader.includes('atprotoPdsEndpoint'));
  assert.ok(loader.includes('MEMORIES_MAX_PAGES'));
  assert.ok(loader.includes("reverse: 'true'"));
  assert.ok(loader.includes('new Map<string, Promise<MemoriesDay | null>>'));
  assert.ok(loader.includes('const key = `${did}|${clean}`'));
  assert.ok(loader.includes('if (existing) return existing'));
  assert.ok(loader.includes('.catch(() => null)'));
  assert.ok(!loader.includes('networkBackend'));
  assert.ok(!loader.includes('agent.com.atproto'));
  assert.ok(!loader.includes('createRecord'));
  assert.ok(!loader.includes('putRecord'));
  assert.ok(!loader.includes('deleteRecord'));
});

test('the disabled state renders nothing and makes no request', () => {
  const hook = read('../src/lib/useMemories.ts');
  assert.ok(hook.includes('if (!did || !enabled)'));
  assert.ok(hook.includes('setDay(null)'));
  const disabledBranch = hook.slice(
    hook.indexOf('if (!did || !enabled)'),
    hook.indexOf('setDay(undefined)')
  );
  assert.ok(!disabledBranch.includes('loadMemories'), 'disabled branch never loads');

  const feed = read('../src/screens/FeedScreen.tsx');
  assert.ok(feed.includes('const memoriesEnabled = !!memoriesPreference?.enabled'));
  assert.ok(feed.includes('useMemories(me?.did, memoriesEnabled, memoriesDayKey)'));
  assert.ok(feed.includes('!activeFeed &&'));
  assert.ok(feed.includes('{showMemories && memories ? ('));
});

test('Home dismisses for the day and the card opens Thread or See all', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  assert.ok(feed.includes('dismissMemories(me.did, memories.dateKey)'));
  assert.ok(feed.includes('onOpenThread={openThread}'));
  assert.ok(feed.includes("navigation.navigate('Memories')"));

  const card = read('../src/components/MemoriesCard.tsx');
  assert.ok(card.includes('MEMORIES_HOME_LIMIT'));
  assert.ok(card.includes("Dismiss today's memories"));
  assert.ok(card.includes('width: 44'));
  assert.ok(card.includes('See all memories from this date'));
  assert.ok(!card.includes('fetch('));
  assert.ok(!card.includes('agent.'));
  assert.ok(!card.includes('listRecords'));

  const screen = read('../src/screens/MemoriesScreen.tsx');
  assert.ok(screen.includes("navigation.navigate('Thread', { uri })"));
  assert.ok(screen.includes('memories.truncated'));
  assert.ok(screen.includes('memories.scanned'));
  assert.ok(screen.includes('No AppView or'));
});

test('the screen is registered at a stable web path', () => {
  const app = read('../App.tsx');
  assert.ok(
    app.includes(
      "import { MemoriesScreen } from './src/screens/MemoriesScreen';"
    )
  );
  assert.ok(
    app.includes('<Stack.Screen name="Memories" component={MemoriesScreen} />')
  );
  assert.equal(WEB_LINKING_CONFIG.screens.Memories, 'memories');
});
