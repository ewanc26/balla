import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postFacets } from '../src/lib/facets.ts';

const MENTION = 'app.bsky.richtext.facet#mention';
const LINK = 'app.bsky.richtext.facet#link';
const TAG = 'app.bsky.richtext.facet#tag';

function resolver(dids) {
  return {
    com: {
      atproto: {
        identity: {
          resolveHandle: async ({ handle }) => ({
            data: { did: dids[handle] || '' },
          }),
        },
      },
    },
  };
}

test('links, tags and resolvable mentions become real facets', async () => {
  const facets = await postFacets(
    'Hi @alice.test and @missing.test #tea https://example.com/story',
    resolver({ 'alice.test': 'did:plc:alice' })
  );
  assert.ok(facets);

  const features = facets.flatMap((facet) => facet.features);
  const mention = features.find((feature) => feature.$type === MENTION);
  const tag = features.find((feature) => feature.$type === TAG);
  const link = features.find((feature) => feature.$type === LINK);

  assert.equal(mention.did, 'did:plc:alice');
  assert.equal(tag.tag, 'tea');
  assert.equal(link.uri, 'https://example.com/story');
});

test('an unresolvable mention is dropped rather than written with an empty DID', async () => {
  const facets = await postFacets(
    'Hello @missing.test',
    resolver({})
  );
  assert.equal(facets, undefined);
});

test('plain text produces no facet record', async () => {
  assert.equal(await postFacets('Just a thought', resolver({})), undefined);
  assert.equal(await postFacets('   ', resolver({})), undefined);
});

test('the composer attaches the generated facets to every post', () => {
  const screen = readFileSync(
    new URL('../src/screens/ComposeScreen.tsx', import.meta.url),
    'utf8'
  );
  assert.match(screen, /import \{ postFacets \} from '\.\.\/lib\/facets'/);
  assert.match(screen, /const facets = await postFacets\(text, agent\)/);
  assert.match(screen, /\.\.\.\(facets \? \{ facets \} : \{\}\)/);
});

test('the thread reply composer attaches facets to replies', () => {
  const screen = readFileSync(
    new URL('../src/screens/ThreadScreen.tsx', import.meta.url),
    'utf8'
  );
  assert.match(screen, /import \{ postFacets \} from '\.\.\/lib\/facets'/);
  assert.match(screen, /const text = replyLimit\.text/);
  assert.match(screen, /const facets = await postFacets\(text, agent\)/);
  assert.match(screen, /\.\.\.\(facets \? \{ facets \} : \{\}\)/);
  assert.match(screen, /reply: \{/);
});
