import { countGraphemes } from 'unicode-segmenter/grapheme';

// app.bsky.feed.post caps text at 300 graphemes and 3,000 UTF-8 bytes. The
// byte limit matters for emoji-heavy text even when the visible count is low.
export const POST_TEXT_MAX_GRAPHEMES = 300;
export const POST_TEXT_MAX_BYTES = 3000;

export type PostTextMeasurement = {
  text: string;
  graphemes: number;
  bytes: number;
  graphemeOver: number;
  byteOver: number;
  over: boolean;
  message: string | null;
};

/** Counts UTF-8 bytes without depending on TextEncoder in the native runtime. */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/**
 * Measures the exact text that would be published. Whitespace is trimmed first,
 * matching the composer's send path; the content itself is never rewritten.
 */
export function measurePostText(input: string): PostTextMeasurement {
  const text = input.trim();
  const graphemes = countGraphemes(text);
  const bytes = utf8ByteLength(text);
  const graphemeOver = Math.max(0, graphemes - POST_TEXT_MAX_GRAPHEMES);
  const byteOver = Math.max(0, bytes - POST_TEXT_MAX_BYTES);

  let message: string | null = null;
  if (graphemeOver > 0) {
    message = `${graphemeOver} grapheme${graphemeOver === 1 ? '' : 's'} over the ${POST_TEXT_MAX_GRAPHEMES}-grapheme limit.`;
  } else if (byteOver > 0) {
    message = `${byteOver} UTF-8 bytes over Bluesky's 3,000-byte text cap.`;
  }

  return {
    text,
    graphemes,
    bytes,
    graphemeOver,
    byteOver,
    over: graphemeOver > 0 || byteOver > 0,
    message,
  };
}
