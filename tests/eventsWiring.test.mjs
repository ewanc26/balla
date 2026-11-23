import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('events are read from the public PDS without the AppView', () => {
  const loader = read('../src/lib/events.ts');
  assert.ok(loader.includes('resolveDidDocument'));
  assert.ok(loader.includes('atprotoPdsEndpoint'));
  assert.ok(loader.includes('EVENT_COLLECTION'));
  assert.ok(loader.includes('publicListPage'));
  assert.ok(loader.includes('PUBLIC_MAX_PAGES'));
  assert.ok(loader.includes('readWithRetry'));
  assert.ok(loader.includes('eventCache'));
  assert.ok(!loader.includes('networkBackend'));
  assert.ok(!loader.includes('getTimeline'));
  assert.ok(!loader.includes('createRecord'));

  const hook = read('../src/lib/useProfileEvents.ts');
  assert.ok(hook.includes('loadProfileEvents'));
  assert.ok(hook.includes('setEvents([])'));
});

test('RSVP writes use the narrow calendar grant and a lexicon-valid key', () => {
  const loader = read('../src/lib/events.ts');
  assert.ok(loader.includes('RSVP_COLLECTION'));
  assert.ok(loader.includes('newRsvpRkey()'));
  assert.ok(loader.includes('existing[0]?.rkey'));
  assert.ok(!loader.includes('rsvpRkeyForEvent'));
  assert.ok(loader.includes('agent.com.atproto.repo.putRecord'));
  assert.ok(loader.includes('agent.com.atproto.repo.deleteRecord'));
  assert.ok(loader.includes('validate: false'));
  assert.ok(loader.includes('duplicateCleanupFailed'));
  assert.ok(loader.includes('RSVP_MAX_PAGES'));
  assert.ok(loader.includes('loadEventRsvps'));

  const model = read('../src/lib/eventsModel.ts');
  assert.ok(model.includes('TID.nextStr()'));
  assert.match(model, /key: "tid"/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 112);
  assert.ok(
    tokens.includes(
      'repo:community.lexicon.calendar.rsvp?action=create&action=update&action=delete'
    )
  );
  assert.equal(tokens.includes('transition:generic'), false);
  assert.ok(!loader.includes('setPreferences'));
});

test('the profile strip uses the real event cards and only renders when records exist', () => {
  const strip = read('../src/components/ProfileEventsStrip.tsx');
  assert.ok(strip.includes('useProfileEvents'));
  assert.ok(strip.includes('profileEventStrip'));
  assert.ok(strip.includes('<EventCard'));
  assert.ok(strip.includes('<EventSheet'));
  assert.ok(strip.includes('events.length === 0'));

  const profile = read('../src/screens/ProfileScreen.tsx');
  assert.ok(profile.includes("import { ProfileEventsStrip }"));
  assert.ok(profile.includes('<ProfileEventsStrip did={profile.did} />'));
});

test('post cards discover raw event embeds and keep the existing moderation gate', () => {
  const post = read('../src/components/PostCard.tsx');
  assert.ok(post.includes('eventRefFromRecordEmbed'));
  assert.ok(post.includes('const eventRef = eventRefFromRecordEmbed'));
  assert.ok(post.includes('<EventEmbed reference={eventRef} />'));
  const embedBlock = post.slice(
    post.indexOf('{eventRef ? ('),
    post.indexOf('{linkCard ? <LinkCard')
  );
  assert.ok(embedBlock.includes('quote ? ('), 'normal quotes still render');
  assert.ok(!embedBlock.includes('Moderation'), 'the parent card owns the gate');

  const embed = read('../src/components/EventEmbed.tsx');
  assert.ok(embed.includes('loadCalendarEvent'));
  assert.ok(embed.includes('This event could not be read'));
});

test('RSVP is one visible tap with change and remove controls, not a swipe', () => {
  const sheet = read('../src/components/EventSheet.tsx');
  assert.ok(sheet.includes("['going', 'interested', 'notgoing']"));
  assert.ok(sheet.includes("accessibilityLabel={`RSVP ${rsvpLabel(option)}`}"));
  assert.ok(sheet.includes('Remove RSVP'));
  assert.ok(sheet.includes('public `community.lexicon.calendar.rsvp` record'));
  assert.ok(sheet.includes('aria-pressed={selected}'));
  assert.ok(sheet.includes('minHeight: 44'));
  assert.ok(!sheet.includes('Swipeable'));
  assert.ok(!sheet.includes('onLongPress'));

  const card = read('../src/components/EventCard.tsx');
  assert.ok(card.includes('accessibilityRole="button"'));
  assert.ok(card.includes('Open event'));
});

test('the current docs describe Events and the narrow RSVP grant', () => {
  const scopes = read('../docs/oauth-scopes.md');
  assert.match(scopes, /\*\*112 tokens\*\*/);
  assert.match(scopes, /repo:community\.lexicon\.calendar\.rsvp/);
  assert.match(scopes, /Sessions authorised before Events/);

  const readme = read('../README.md');
  assert.match(readme, /profile Events strip/);
  assert.match(readme, /community\.lexicon\.calendar\.event/);

  const agents = read('../AGENTS.md');
  assert.match(agents, /community\.lexicon\.calendar\.event/);
  assert.match(agents, /112 tokens total/);
});
