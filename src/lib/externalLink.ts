import { agent } from './agent';
import {
  externalFromEmbed,
  normaliseWebUrl,
  type ExternalView,
} from './embedModel';

/**
 * Ask Bluesky's AppView for the link metadata instead of scraping the page in
 * the client. A failed or empty lookup is an honest failure: the URL still
 * lives in the post text, and no card is invented from it.
 */
export async function resolveExternalLink(rawUrl: string): Promise<ExternalView> {
  const url = normaliseWebUrl(rawUrl);
  if (!url) {
    throw new Error('That does not look like a complete web link.');
  }
  const response = await agent.app.bsky.embed.getEmbedExternalView({ url });
  const view = response.data.view;
  const card = view
    ? externalFromEmbed({
        $type: 'app.bsky.embed.external#view',
        external: view.external,
      })
    : null;
  if (!card || (!card.title && !card.description)) {
    throw new Error(
      'The service could not build a preview for that link. You can still post the link as text.'
    );
  }
  return card;
}
