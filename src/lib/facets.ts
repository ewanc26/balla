import { RichText, type Agent } from '@atproto/api';

const MENTION = 'app.bsky.richtext.facet#mention';

/**
 * Builds the rich-text facets stored on a post. The SDK detects links, tags and
 * mentions, then resolves mention handles through the PDS. A handle that does
 * not resolve is removed instead of being written as an empty DID, and a
 * detection failure never blocks publishing the text.
 */
export async function postFacets(
  text: string,
  resolver: Agent
): Promise<any[] | undefined> {
  if (!text.trim()) return undefined;

  try {
    const rich = new RichText({ text });
    await rich.detectFacets(resolver);
    const facets = (rich.facets || []).filter((facet) =>
      facet.features.every((feature) => {
        if (feature.$type !== MENTION) return true;
        const did = (feature as { did?: unknown }).did;
        return typeof did === 'string' && did.startsWith('did:');
      })
    );
    return facets.length ? facets : undefined;
  } catch {
    return undefined;
  }
}
