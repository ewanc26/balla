/**
 * The News bundle pack (#159). This is curation data, not an algorithm: a
 * topic crossed with a region names the publisher accounts that will be put on
 * one ordinary Balla curation list. The list feed is newest-first like every
 * other list, and nothing here is written to a feed preference, a follow or an
 * engagement count.
 *
 * Handles and DIDs were resolved against the public AppView on 23 November
 * 2026. A publisher that leaves Bluesky simply disappears from that bundle on
 * the next app update; Balla never guesses a replacement.
 */

export const NEWS_REGIONS = [
  { id: 'global', label: 'Global' },
  { id: 'uk', label: 'UK' },
  { id: 'us', label: 'US' },
  { id: 'europe', label: 'Europe' },
] as const;

export type NewsRegionId = (typeof NEWS_REGIONS)[number]['id'];

export type NewsPublisher = {
  did: string;
  handle: string;
  name: string;
  /**
   * The newsroom's base. International outlets are tagged `global` and appear
   * only in the Global bundle rather than being claimed for a region.
   */
  region: 'global' | 'uk' | 'us' | 'europe';
};

export type NewsTopic = {
  id: string;
  name: string;
  /** One sentence naming the coverage, not a claim of neutrality. */
  summary: string;
  publishers: NewsPublisher[];
};

export type NewsCuration = {
  topics: NewsTopic[];
};

export type NewsCurationState =
  | { ok: true; curation: NewsCuration }
  | { ok: false; error: string };

export const NEWS_INTRO =
  'Pick a topic and a region. Each bundle is one public curation list of publisher accounts; its feed reads newest-first and nothing is inserted into Following.';

export const NEWS_TRANSPARENCY =
  'This adds one public list to your account. It follows nobody, likes nothing, blocks and mutes nobody, and leaves Following and Home unchanged.';

export const NEWS_NO_RANKING =
  'No ranking at any point: the list feed shows the publishers’ posts newest-first, exactly like every other list feed.';

export const NEWS_CURATION_ERROR =
  'The news pack could not be read. No publishers are shown and nothing has been added.';

const TOPIC_IDS = new Set([
  'politics',
  'climate',
  'culture',
  'technology',
  'sport',
]);

const REGION_IDS = new Set<string>(NEWS_REGIONS.map((region) => region.id));

const DID_PATTERN = /^did:(plc|web):[a-zA-Z0-9._:%-]+$/;
const HANDLE_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

/**
 * The published pack. Every entry is a real publisher account; the editor of
 * this file is the editorial surface, so a change shows up in the picker and in
 * the roster before a single record is written.
 */
export const NEWS_CURATION: NewsCuration = {
  topics: [
    {
      id: 'politics',
      name: 'Politics',
      summary:
        'Elections, governments and policy reporting from established newsrooms.',
      publishers: [
        { did: 'did:plc:eclio37ymobqex2ncko63h4r', handle: 'nytimes.com', name: 'The New York Times', region: 'us' },
        { did: 'did:plc:a67zdrt4nl2tv2qojpngogbq', handle: 'apnews.com', name: 'The Associated Press', region: 'us' },
        { did: 'did:plc:ln72v57ivz2g46uqf4xxqiuh', handle: 'npr.org', name: 'NPR', region: 'us' },
        { did: 'did:plc:yf6hctt2ug3qyfty4in64yob', handle: 'politico.com', name: 'Politico', region: 'us' },
        { did: 'did:plc:f6avy7jkujdhusski5n64joj', handle: 'axios.com', name: 'Axios', region: 'us' },
        { did: 'did:plc:vovinwhtulbsx4mwfw26r5ni', handle: 'theguardian.com', name: 'The Guardian', region: 'uk' },
        { did: 'did:plc:jbvnehrrdqoulco4rf5gxg5r', handle: 'reuters.com', name: 'Reuters', region: 'uk' },
        { did: 'did:plc:mhzk3blh4pfxo3fqh2meowbb', handle: 'economist.com', name: 'The Economist', region: 'uk' },
        { did: 'did:plc:tshrll7hb5scyeg4m6nitxtr', handle: 'news.sky.com', name: 'Sky News', region: 'uk' },
        { did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4', handle: 'lemonde.fr', name: 'Le Monde', region: 'europe' },
        { did: 'did:plc:u6mkbcgviwlbhuwqirmhcgu3', handle: 'elpais.com', name: 'El País', region: 'europe' },
        { did: 'did:plc:6xofcnvvojjnmggqx43zghwh', handle: 'spiegel.de', name: 'Der Spiegel', region: 'europe' },
        { did: 'did:plc:bak7f4b3jsiqlpyo6o4ejaji', handle: 'politico.eu', name: 'Politico Europe', region: 'europe' },
        { did: 'did:plc:2lofqead276vtc5647ye7sl2', handle: 'aljazeera.com', name: 'Al Jazeera English', region: 'global' },
      ],
    },
    {
      id: 'climate',
      name: 'Climate',
      summary:
        'Climate science, energy and policy reporting from specialist and general newsrooms.',
      publishers: [
        { did: 'did:plc:zme3usssbyhtqtg2rsilkeh4', handle: 'insideclimatenews.org', name: 'Inside Climate News', region: 'us' },
        { did: 'did:plc:ngqdkvttdmzsbwb2mngquwip', handle: 'grist.org', name: 'Grist', region: 'us' },
        { did: 'did:plc:mec75muei3zce23djcw2afqa', handle: 'canarymedia.com', name: 'Canary Media', region: 'us' },
        { did: 'did:plc:2d6kuvaoa7qi6bq5cwq4isee', handle: 'carbonbrief.org', name: 'Carbon Brief', region: 'uk' },
        { did: 'did:plc:vovinwhtulbsx4mwfw26r5ni', handle: 'theguardian.com', name: 'The Guardian', region: 'uk' },
        { did: 'did:plc:vrsppvjc5fysqnm2zshiirey', handle: 'nature.com', name: 'Nature', region: 'uk' },
        { did: 'did:plc:jbvnehrrdqoulco4rf5gxg5r', handle: 'reuters.com', name: 'Reuters', region: 'uk' },
        { did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4', handle: 'lemonde.fr', name: 'Le Monde', region: 'europe' },
        { did: 'did:plc:u6mkbcgviwlbhuwqirmhcgu3', handle: 'elpais.com', name: 'El País', region: 'europe' },
        { did: 'did:plc:6xofcnvvojjnmggqx43zghwh', handle: 'spiegel.de', name: 'Der Spiegel', region: 'europe' },
        { did: 'did:plc:2lofqead276vtc5647ye7sl2', handle: 'aljazeera.com', name: 'Al Jazeera English', region: 'global' },
      ],
    },
    {
      id: 'culture',
      name: 'Culture',
      summary:
        'Arts, music, film and publishing reporting from newsroom and magazine accounts.',
      publishers: [
        { did: 'did:plc:azhp7skmdpph62i3zgy4jixy', handle: 'variety.com', name: 'Variety', region: 'us' },
        { did: 'did:plc:vf32tdeunh3ra6nvclxhmeuo', handle: 'rollingstone.com', name: 'Rolling Stone', region: 'us' },
        { did: 'did:plc:t2dfq4ktezmwjdnjjaygw4bl', handle: 'newyorker.com', name: 'The New Yorker', region: 'us' },
        { did: 'did:plc:4isvv7q3p52sbntcd3npzh7s', handle: 'hyperallergic.com', name: 'Hyperallergic', region: 'us' },
        { did: 'did:plc:bz2qt2eyn4wu5nnpqxu7iydz', handle: 'pitchfork.com', name: 'Pitchfork', region: 'us' },
        { did: 'did:plc:vovinwhtulbsx4mwfw26r5ni', handle: 'theguardian.com', name: 'The Guardian', region: 'uk' },
        { did: 'did:plc:smvbjlizzjuuzki36mpfwpdc', handle: 'nme.com', name: 'NME', region: 'uk' },
        { did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4', handle: 'lemonde.fr', name: 'Le Monde', region: 'europe' },
        { did: 'did:plc:u6mkbcgviwlbhuwqirmhcgu3', handle: 'elpais.com', name: 'El País', region: 'europe' },
        { did: 'did:plc:6xofcnvvojjnmggqx43zghwh', handle: 'spiegel.de', name: 'Der Spiegel', region: 'europe' },
        { did: 'did:plc:2lofqead276vtc5647ye7sl2', handle: 'aljazeera.com', name: 'Al Jazeera English', region: 'global' },
      ],
    },
    {
      id: 'technology',
      name: 'Technology',
      summary:
        'Products, platforms, security and the business of technology.',
      publishers: [
        { did: 'did:plc:7exlcsle4mjfhu3wnhcgizz6', handle: 'theverge.com', name: 'The Verge', region: 'us' },
        { did: 'did:plc:wld6fad6xsm4tz4kfkoikun2', handle: 'arstechnica.com', name: 'Ars Technica', region: 'us' },
        { did: 'did:plc:inz4fkbbp7ms3ixufw6xuvdi', handle: 'wired.com', name: 'WIRED', region: 'us' },
        { did: 'did:plc:vtpyqvwce4x6gpa5dcizqecy', handle: 'techcrunch.com', name: 'TechCrunch', region: 'us' },
        { did: 'did:plc:hpnjvcdy2eb4f7wmrdfuka3h', handle: 'engadget.com', name: 'Engadget', region: 'us' },
        { did: 'did:plc:n6ntylxdpoo74zfscij4zpwr', handle: 'technologyreview.com', name: 'MIT Technology Review', region: 'us' },
        { did: 'did:plc:bz67dxqh5nmjl5it36xylqyy', handle: 'theregister.com', name: 'The Register', region: 'uk' },
        { did: 'did:plc:2wb4cogkkv2l7oxlqxj6sxgn', handle: 'techradar.com', name: 'TechRadar', region: 'uk' },
        { did: 'did:plc:vovinwhtulbsx4mwfw26r5ni', handle: 'theguardian.com', name: 'The Guardian', region: 'uk' },
        { did: 'did:plc:zv657bpskxtjkvbdd5wymjam', handle: 'heise.de', name: 'heise online', region: 'europe' },
        { did: 'did:plc:qqxqxgdu5z3he2piqfbfaku4', handle: 'lemonde.fr', name: 'Le Monde', region: 'europe' },
        { did: 'did:plc:2lofqead276vtc5647ye7sl2', handle: 'aljazeera.com', name: 'Al Jazeera English', region: 'global' },
      ],
    },
    {
      id: 'sport',
      name: 'Sport',
      summary:
        'Results, reporting and analysis from general and specialist sports desks.',
      publishers: [
        { did: 'did:plc:x7d6j54pm22ufehkes6jo4jf', handle: 'espn.com', name: 'ESPN', region: 'us' },
        { did: 'did:plc:b2kutgxqlltwc6lhs724cfwr', handle: 'theathletic.com', name: 'The Athletic', region: 'us' },
        { did: 'did:plc:eclio37ymobqex2ncko63h4r', handle: 'nytimes.com', name: 'The New York Times', region: 'us' },
        { did: 'did:plc:vovinwhtulbsx4mwfw26r5ni', handle: 'theguardian.com', name: 'The Guardian', region: 'uk' },
        { did: 'did:plc:p5ttlazxiqq36y7fohbnpw6s', handle: 'fourfourtwo.com', name: 'FourFourTwo', region: 'uk' },
        { did: 'did:plc:tshrll7hb5scyeg4m6nitxtr', handle: 'news.sky.com', name: 'Sky News', region: 'uk' },
        { did: 'did:plc:qanbnbrtaa4xjz35zfrfqlgh', handle: 'the42.ie', name: 'The 42', region: 'europe' },
        { did: 'did:plc:ilo5g7lh5xvh7ppgl7xqygpk', handle: 'rte.ie', name: 'RTÉ', region: 'europe' },
        { did: 'did:plc:vwc3u2sqfxdykd2m6qu3p74b', handle: 'as.com', name: 'Diario AS', region: 'europe' },
        { did: 'did:plc:fbs7q5ymtsv6kbokagsk6dan', handle: 'kicker.de', name: 'kicker', region: 'europe' },
        { did: 'did:plc:jbvnehrrdqoulco4rf5gxg5r', handle: 'reuters.com', name: 'Reuters', region: 'uk' },
        { did: 'did:plc:2lofqead276vtc5647ye7sl2', handle: 'aljazeera.com', name: 'Al Jazeera English', region: 'global' },
      ],
    },
  ],
};

function fail(error: string): NewsCurationState {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates the compiled pack rather than trusting it. The pack is data, so a
 * malformed entry must degrade to the house empty state instead of rendering a
 * half-built roster or writing a list with missing members.
 */
export function parseNewsCuration(input: unknown): NewsCurationState {
  if (!isRecord(input) || !Array.isArray(input.topics)) {
    return fail(NEWS_CURATION_ERROR);
  }
  if (input.topics.length === 0) return fail(NEWS_CURATION_ERROR);

  const seenTopics = new Set<string>();
  const topics: NewsTopic[] = [];

  for (const rawTopic of input.topics) {
    if (!isRecord(rawTopic)) return fail(NEWS_CURATION_ERROR);
    const { id, name, summary, publishers } = rawTopic;
    if (typeof id !== 'string' || !TOPIC_IDS.has(id)) {
      return fail(NEWS_CURATION_ERROR);
    }
    if (seenTopics.has(id)) return fail(NEWS_CURATION_ERROR);
    if (typeof name !== 'string' || !name.trim()) {
      return fail(NEWS_CURATION_ERROR);
    }
    if (typeof summary !== 'string' || !summary.trim()) {
      return fail(NEWS_CURATION_ERROR);
    }
    if (!Array.isArray(publishers)) return fail(NEWS_CURATION_ERROR);

    const seenDids = new Set<string>();
    const parsedPublishers: NewsPublisher[] = [];
    for (const rawPublisher of publishers) {
      if (!isRecord(rawPublisher)) return fail(NEWS_CURATION_ERROR);
      const { did, handle, name: publisherName, region } = rawPublisher;
      if (typeof did !== 'string' || !DID_PATTERN.test(did)) {
        return fail(NEWS_CURATION_ERROR);
      }
      if (seenDids.has(did)) return fail(NEWS_CURATION_ERROR);
      if (typeof handle !== 'string' || !HANDLE_PATTERN.test(handle)) {
        return fail(NEWS_CURATION_ERROR);
      }
      if (typeof publisherName !== 'string' || !publisherName.trim()) {
        return fail(NEWS_CURATION_ERROR);
      }
      if (typeof region !== 'string' || !REGION_IDS.has(region)) {
        return fail(NEWS_CURATION_ERROR);
      }
      seenDids.add(did);
      parsedPublishers.push({
        did,
        handle,
        name: publisherName.trim(),
        region: region as NewsPublisher['region'],
      });
    }

    seenTopics.add(id);
    topics.push({
      id,
      name: name.trim(),
      summary: summary.trim(),
      publishers: parsedPublishers,
    });
  }

  return { ok: true, curation: { topics } };
}

export function loadNewsCuration(
  input: unknown = NEWS_CURATION
): NewsCurationState {
  return parseNewsCuration(input);
}

export function findNewsTopic(
  curation: NewsCuration,
  topicId: string
): NewsTopic | undefined {
  return curation.topics.find((topic) => topic.id === topicId);
}

/**
 * Global includes every publisher. A regional bundle is only the newsrooms
 * based in that region; international outlets are never claimed as local.
 */
export function publishersForBundle(
  curation: NewsCuration,
  topicId: string,
  regionId: string
): NewsPublisher[] {
  const topic = findNewsTopic(curation, topicId);
  if (!topic) return [];
  if (regionId === 'global') return topic.publishers;
  return topic.publishers.filter(
    (publisher) => publisher.region === regionId
  );
}

export function newsRegionLabel(regionId: string): string {
  return NEWS_REGIONS.find((region) => region.id === regionId)?.label || 'Global';
}

export function validateNewsBundleSelection(
  topicId: unknown,
  regionId: unknown
): string | null {
  if (typeof topicId !== 'string' || !TOPIC_IDS.has(topicId)) {
    return 'This bundle is not part of the published news pack.';
  }
  if (typeof regionId !== 'string' || !REGION_IDS.has(regionId)) {
    return 'This bundle is not part of the published news pack.';
  }
  return null;
}

export function bundleName(topicName: string, regionId: string): string {
  return `News: ${topicName} (${newsRegionLabel(regionId)})`;
}

export function bundleDescription(topic: NewsTopic): string {
  return `${topic.summary} One public curation list created by Balla; its feed is newest-first.`;
}
