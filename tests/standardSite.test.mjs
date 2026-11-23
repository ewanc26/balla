import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  documentBlocks,
  normaliseDocument,
  normalisePublication,
  parseAtUri,
  standardSiteFromEmbed,
  verificationState,
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  STANDARD_SITE_COPY,
} from '../src/lib/standardSiteModel.ts';
import {
  checkStandardSiteVerification,
  loadStandardSiteDocument,
} from '../src/lib/standardSite.ts';

const DOCUMENT_URI =
  'at://did:plc:revjuqmkvrw6fnkxppqtszpv/site.standard.document/3mxmxzzjgbrwq';
const PUBLICATION_URI =
  'at://did:plc:revjuqmkvrw6fnkxppqtszpv/site.standard.publication/3lwafzkjqm25s';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

test('AT URIs are strict: DID, collection and rkey only', () => {
  assert.deepEqual(parseAtUri(DOCUMENT_URI), {
    did: 'did:plc:revjuqmkvrw6fnkxppqtszpv',
    collection: DOCUMENT_COLLECTION,
    rkey: '3mxmxzzjgbrwq',
  });
  assert.equal(parseAtUri(DOCUMENT_URI + '?x=1'), null);
  assert.equal(parseAtUri('https://example.org' + DOCUMENT_URI), null);
  assert.equal(parseAtUri('at://not-a-did/site.standard.document/rkey'), null);
  assert.equal(parseAtUri('at://did:plc:abc/site.standard.document/rkey/extra'), null);
});

test('the enhanced card uses only published fields and keeps plain links plain', () => {
  const embed = {
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://notes.pckt.blog/article',
      title: 'A published article',
      description: 'An honest description',
      thumb: 'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:abc/cid@jpeg',
      createdAt: '2025-11-20T10:00:00.000Z',
      updatedAt: '2025-11-21T10:00:00.000Z',
      readingTime: 7,
      source: {
        $type: 'app.bsky.embed.external#viewExternalSource',
        uri: 'https://notes.pckt.blog',
        title: 'Notes',
        description: 'A publication',
        icon: 'https://cdn.bsky.app/img/avatar/plain/did:plc:abc/cid@jpeg',
        theme: {
          backgroundRGB: { r: 10, g: 20, b: 30 },
          foregroundRGB: { r: 240, g: 240, b: 240 },
          accentRGB: { r: 255, g: 128, b: 0 },
          accentForegroundRGB: { r: 0, g: 0, b: 0 },
        },
      },
      associatedProfiles: [
        { did: 'did:plc:other', handle: 'other.example' },
        { did: 'did:plc:revjuqmkvrw6fnkxppqtszpv', handle: 'author.example', displayName: 'Author' },
      ],
      associatedRefs: [
        { $type: 'com.atproto.repo.strongRef', uri: PUBLICATION_URI, cid: 'bafy-publication' },
        { $type: 'com.atproto.repo.strongRef', uri: DOCUMENT_URI, cid: 'bafy-document' },
      ],
    },
  };
  const card = standardSiteFromEmbed(embed);
  assert.ok(card);
  assert.equal(card.documentUri, DOCUMENT_URI);
  assert.equal(card.documentCid, 'bafy-document');
  assert.equal(card.publicationUri, PUBLICATION_URI);
  assert.equal(card.publicationName, 'Notes');
  assert.equal(card.publicationUrl, 'https://notes.pckt.blog');
  assert.equal(card.authorHandle, 'author.example');
  assert.equal(card.authorName, 'Author');
  assert.equal(card.readingTime, 7);
  assert.deepEqual(card.theme, {
    background: '#0a141e',
    foreground: '#f0f0f0',
    accent: '#ff8000',
    accentForeground: '#000000',
  });

  // A dotted strongRef suffix and recordWithMedia are both published shapes.
  const wrapped = {
    $type: 'app.bsky.embed.recordWithMedia#view',
    media: {
      ...embed,
      external: {
        ...embed.external,
        associatedRefs: [
          { $type: 'app.bsky.feed.defs#strongRef', uri: DOCUMENT_URI, cid: 'bafy-hash-suffix' },
        ],
      },
    },
  };
  assert.equal(standardSiteFromEmbed(wrapped)?.documentCid, 'bafy-hash-suffix');

  const plain = {
    $type: 'app.bsky.embed.external#view',
    external: { uri: 'https://example.org', title: 'Plain', description: '' },
  };
  assert.equal(standardSiteFromEmbed(plain), null);
  const wrongSource = structuredClone(embed);
  wrongSource.external.source.$type = 'app.bsky.embed.external#externalSource';
  assert.equal(standardSiteFromEmbed(wrongSource), null);
  const noRefs = structuredClone(embed);
  noRefs.external.associatedRefs = [{ $type: 'com.atproto.repo.strongRef', uri: PUBLICATION_URI, cid: 'x' }];
  assert.equal(standardSiteFromEmbed(noRefs), null);
});

test('real record shapes become honest blocks, with named gaps for unsupported ones', () => {
  const result = documentBlocks(
    {
      $type: 'blog.pckt.content',
      items: [
        { $type: 'blog.pckt.block.heading', plaintext: 'Heading', level: 1 },
        { $type: 'blog.pckt.block.text', plaintext: 'Hello 🌍', facets: [
          { index: { byteStart: 6, byteEnd: 19 }, features: [
            { $type: 'app.bsky.richtext.facet#link', uri: 'https://example.org/a' },
          ] },
        ] },
        { $type: 'blog.pckt.block.image', attrs: {
          blob: { ref: { $link: 'bafy-image' }, mimeType: 'image/png' },
          alt: 'A real image',
        } },
        { $type: 'blog.pckt.block.bulletList', content: [
          { $type: 'blog.pckt.block.listItem', content: [
            { $type: 'blog.pckt.block.text', plaintext: 'First point' },
          ] },
          { $type: 'blog.pckt.block.listItem', content: [
            { $type: 'blog.pckt.block.text', plaintext: 'Second point' },
          ] },
        ] },
        { $type: 'blog.pckt.block.gallery', attrs: {} },
        { $type: 'blog.pckt.block.table', attrs: {} },
        { $type: 'blog.pckt.block.questions', attrs: {} },
        { $type: 'blog.pckt.block.blueskyEmbed', attrs: { uri: DOCUMENT_URI }, title: 'A post' },
      ],
    },
    'fallback text',
  );
  assert.equal(result.truncated, false);
  assert.deepEqual(result.blocks[0], { kind: 'heading', level: 1, segments: [{ kind: 'text', text: 'Heading' }] });
  assert.deepEqual(result.blocks[1].segments[1], { kind: 'link', text: '🌍', uri: 'https://example.org/a' });
  assert.deepEqual(result.blocks[2], { kind: 'image', cid: 'bafy-image', alt: 'A real image' });
  assert.deepEqual(result.blocks.slice(3, 5), [
    { kind: 'bullet', segments: [{ kind: 'text', text: 'First point' }] },
    { kind: 'bullet', segments: [{ kind: 'text', text: 'Second point' }] },
  ]);
  assert.deepEqual(result.blocks.slice(5, 8).map((block) => block.label), ['Gallery', 'Table', 'Questions']);
  assert.ok(result.blocks.slice(5, 8).every((block) => block.kind === 'unsupported'));
  assert.deepEqual(result.blocks[8], { kind: 'embed', uri: DOCUMENT_URI, title: 'A post' });
  assert.match(STANDARD_SITE_COPY.notRendered, /not rendered/i);
});

test('Leaflet content pages are read without inventing markup', () => {
  const result = documentBlocks(
    {
      $type: 'pub.leaflet.content',
      pages: [
        { blocks: [
          { block: { $type: 'pub.leaflet.blocks.text', plaintext: 'Leaflet text' } },
          { block: { $type: 'pub.leaflet.blocks.questions', questions: [] } },
          { block: { $type: 'pub.leaflet.blocks.horizontalRule' } },
        ] },
      ],
    },
    '',
  );
  assert.deepEqual(result.blocks[0], {
    kind: 'paragraph',
    segments: [{ kind: 'text', text: 'Leaflet text' }],
  });
  assert.equal(result.blocks[1].kind, 'unsupported');
  assert.equal(result.blocks[1].label, 'Questions');
  assert.equal(result.blocks[2].kind, 'rule');

  const fallback = documentBlocks(null, 'one\n\ntwo');
  assert.equal(fallback.blocks.length, 2);
  assert.equal(fallback.blocks[0].segments[0].text, 'one');
});

test('records, canonical URLs and verification keep real values only', () => {
  const document = normaliseDocument(
    {
      title: 'A title',
      description: 'A description',
      publishedAt: '2025-11-20T10:00:00.000Z',
      site: PUBLICATION_URI,
      path: '/article',
      tags: ['atproto', ''],
      langs: ['en'],
      textContent: 'body',
      coverImage: { ref: { $link: 'bafy-cover' } },
      bskyPostRef: { $type: 'com.atproto.repo.strongRef', uri: DOCUMENT_URI, cid: 'bafy-post' },
      content: { $type: 'blog.pckt.content', items: [] },
    },
    DOCUMENT_URI,
    'bafy-doc',
  );
  assert.ok(document);
  assert.equal(document.cid, 'bafy-doc');
  assert.equal(document.coverCid, 'bafy-cover');
  assert.equal(document.bskyPostRefUri, DOCUMENT_URI);
  assert.deepEqual(document.tags, ['atproto']);
  assert.equal(canonicalUrl('https://notes.pckt.blog/', '/article'), 'https://notes.pckt.blog/article');
  assert.equal(canonicalUrl('https://notes.pckt.blog', 'article?x=1'), null);
  assert.equal(canonicalUrl('http://notes.pckt.blog', '/article'), null);
  assert.equal(canonicalUrl('https://notes.pckt.blog', ''), 'https://notes.pckt.blog');

  const publication = normalisePublication(
    {
      name: 'Notes',
      url: 'https://notes.pckt.blog',
      description: 'A publication',
      icon: { ref: { $link: 'bafy-icon' } },
      basicTheme: {
        background: { r: 255, g: 255, b: 255 },
        foreground: { r: 0, g: 0, b: 0 },
        accent: { r: 10, g: 20, b: 30 },
        accentForeground: { r: 240, g: 240, b: 240 },
      },
      preferences: { showInDiscover: true },
    },
    PUBLICATION_URI,
    'bafy-pub',
  );
  assert.ok(publication);
  assert.equal(publication.iconCid, 'bafy-icon');
  assert.equal(publication.showInDiscover, true);
  assert.equal(publication.theme?.accent, '#0a141e');
  assert.equal(verificationState(PUBLICATION_URI + '\n', PUBLICATION_URI), 'verified');
  assert.equal(verificationState('at://did:plc:other/site.standard.publication/x', PUBLICATION_URI), 'mismatch');
  assert.equal(verificationState('', PUBLICATION_URI), 'unavailable');
});

test('the loader reads public records from the author PDS and never provider message text', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('com.atproto.repo.getRecord') && url.includes(DOCUMENT_COLLECTION)) {
      return jsonResponse({
        uri: DOCUMENT_URI,
        cid: 'bafy-doc',
        value: {
          title: 'Live title',
          description: 'Live description',
          publishedAt: '2025-11-20T10:00:00.000Z',
          site: PUBLICATION_URI,
          path: '/article',
          langs: ['en'],
          textContent: 'A body',
          content: { $type: 'blog.pckt.content', items: [
            { $type: 'blog.pckt.block.text', plaintext: 'A paragraph' },
          ] },
        },
      });
    }
    if (url.includes('com.atproto.repo.getRecord') && url.includes(PUBLICATION_COLLECTION)) {
      return jsonResponse({
        uri: PUBLICATION_URI,
        cid: 'bafy-pub',
        value: { name: 'Notes', url: 'https://notes.pckt.blog' },
      });
    }
    if (url.endsWith('/.well-known/site.standard.publication')) return jsonResponse(PUBLICATION_URI);
    throw new Error('unexpected URL ' + url);
  };
  const result = await loadStandardSiteDocument(DOCUMENT_URI, {
    resolveEndpoint: async (did) => (did.includes('revjuqmkvrw6fnkxppqtszpv') ? 'https://pds.example.org/' : null),
    fetchImpl,
  });
  assert.equal(result.state, 'ok');
  if (result.state !== 'ok') return;
  assert.equal(result.pds, 'https://pds.example.org/');
  assert.equal(result.document.cid, 'bafy-doc');
  assert.equal(result.publication?.cid, 'bafy-pub');
  assert.equal(result.document.canonicalUrl, 'https://notes.pckt.blog/article');
  assert.equal(result.verification, 'verified');
  assert.ok(calls.some((call) => call.url.startsWith('https://pds.example.org/xrpc/com.atproto.repo.getRecord')));
  assert.ok(calls.every((call) => !/message/i.test(JSON.stringify(call.init ?? {}))));
});

test('loader failures are classified by status and XRPC code, not prose', async () => {
  const deps = { resolveEndpoint: async () => 'https://pds.example.org' };
  assert.deepEqual(await loadStandardSiteDocument('not an at uri', deps), { state: 'invalid' });
  assert.deepEqual(
    await loadStandardSiteDocument(DOCUMENT_URI.replace(DOCUMENT_COLLECTION, 'app.bsky.feed.post'), deps),
    { state: 'invalid' },
  );
  assert.deepEqual(await loadStandardSiteDocument(DOCUMENT_URI, {
    ...deps,
    resolveEndpoint: async () => null,
  }), { state: 'unavailable' });
  assert.deepEqual(await loadStandardSiteDocument(DOCUMENT_URI, {
    ...deps,
    fetchImpl: async () => jsonResponse({ error: 'RecordNotFound', message: 'secret provider prose' }, 400),
  }), { state: 'not-found' });
  assert.deepEqual(await loadStandardSiteDocument(DOCUMENT_URI, {
    ...deps,
    fetchImpl: async () => jsonResponse({ error: 'InternalServerError', message: 'secret provider prose' }, 500),
  }), { state: 'unavailable' });
  assert.deepEqual(await loadStandardSiteDocument(DOCUMENT_URI, {
    ...deps,
    fetchImpl: async () => jsonResponse({}, 404),
  }), { state: 'not-found' });
  assert.deepEqual(await loadStandardSiteDocument(DOCUMENT_URI, {
    ...deps,
    fetchImpl: async () => { throw new Error('offline'); },
  }), { state: 'unavailable' });
});

test('a missing publication leaves the document readable and verification unavailable', async () => {
  const result = await loadStandardSiteDocument(DOCUMENT_URI, {
    resolveEndpoint: async () => 'https://pds.example.org',
    fetchImpl: async (url) => {
      if (url.includes(DOCUMENT_COLLECTION)) {
        return jsonResponse({
          value: {
            title: 'Independent',
            publishedAt: '2025-11-20T10:00:00.000Z',
            site: PUBLICATION_URI,
            content: { $type: 'blog.pckt.content', items: [] },
          },
          cid: 'bafy-doc',
        });
      }
      return jsonResponse({ error: 'RecordNotFound' }, 404);
    },
  });
  assert.equal(result.state, 'ok');
  if (result.state !== 'ok') return;
  assert.equal(result.publication, null);
  assert.equal(result.verification, 'unavailable');
  // Without the publication record there is no honestly known publication URL.
  assert.equal(result.document.canonicalUrl, null);

  assert.equal(
    await checkStandardSiteVerification('https://notes.pckt.blog', 'at://did:plc:other/site.standard.publication/x', async () => jsonResponse('')),
    'unavailable',
  );
  assert.equal(
    await checkStandardSiteVerification('https://notes.pckt.blog', PUBLICATION_URI, async () => jsonResponse(PUBLICATION_URI)),
    'verified',
  );
});
