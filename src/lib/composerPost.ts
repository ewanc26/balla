import { countGraphemes } from 'unicode-segmenter/grapheme';

// The current official client accepts ten images. One to four use the legacy
// app.bsky.embed.images shape; five to ten use app.bsky.embed.gallery.
export const MAX_COMPOSER_IMAGES = 10;
export const LEGACY_IMAGE_EMBED_MAX = 4;
export const MAX_ALT_TEXT = 2000;
// The post image lexicon now permits 2 MB. Balla still re-encodes everything
// to JPEG so the existing blob:image/jpeg scope remains sufficient.
export const MAX_POST_IMAGE_BYTES = 2_000_000;

export type ComposerAttachment = {
  alt: string;
  blob: unknown;
  width: number;
  height: number;
};

type QuoteRef = { uri: string; cid: string };

function dimensions(image: ComposerAttachment): { width: number; height: number } {
  const width = Number.isFinite(image.width) ? Math.round(image.width) : 0;
  const height = Number.isFinite(image.height) ? Math.round(image.height) : 0;
  return {
    width: Math.min(10000, Math.max(1, width)),
    height: Math.min(10000, Math.max(1, height)),
  };
}

export function missingAltTextCount(images: { alt: string }[]): number {
  return images.filter((image) => !image.alt.trim()).length;
}

export function altTextTooLongCount(images: { alt: string }[]): number {
  return images.filter((image) => countGraphemes(image.alt.trim()) > MAX_ALT_TEXT)
    .length;
}

export function canPublishPost({
  text,
  imageCount,
  hasQuote,
}: {
  text: string;
  imageCount: number;
  hasQuote: boolean;
}): boolean {
  return text.trim().length > 0 || imageCount > 0 || hasQuote;
}

export function buildImageEmbed(images: ComposerAttachment[]): any {
  const selected = images.slice(0, MAX_COMPOSER_IMAGES);
  if (selected.length === 0) return undefined;

  if (selected.length <= LEGACY_IMAGE_EMBED_MAX) {
    return {
      $type: 'app.bsky.embed.images',
      images: selected.map((image) => {
        const ratio = dimensions(image);
        return {
          image: image.blob,
          alt: image.alt.trim(),
          aspectRatio: ratio,
        };
      }),
    };
  }

  return {
    $type: 'app.bsky.embed.gallery',
    items: selected.map((image) => {
      const ratio = dimensions(image);
      return {
        $type: 'app.bsky.embed.gallery#image',
        image: image.blob,
        alt: image.alt.trim(),
        aspectRatio: ratio,
      };
    }),
  };
}

export function buildPostEmbed(
  images: ComposerAttachment[],
  quote: QuoteRef | null
): any {
  const media = buildImageEmbed(images);
  const record =
    quote && quote.uri && quote.cid
      ? {
          $type: 'app.bsky.embed.record',
          record: { uri: quote.uri, cid: quote.cid },
        }
      : undefined;

  if (media && record) {
    return {
      $type: 'app.bsky.embed.recordWithMedia',
      record,
      media,
    };
  }
  return media || record;
}
