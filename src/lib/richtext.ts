export type RichTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; uri: string }
  | { kind: 'mention'; text: string; actor: string }
  | { kind: 'tag'; text: string; tag: string };

type Candidate = {
  start: number;
  end: number;
  segment: RichTextSegment;
};

const LINK = 'app.bsky.richtext.facet#link';
const MENTION = 'app.bsky.richtext.facet#mention';
const TAG = 'app.bsky.richtext.facet#tag';

export function utf8Length(value: string): number {
  let length = 0;
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index) || 0;
    length +=
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    index += codePoint > 0xffff ? 2 : 1;
  }
  return length;
}

// Bluesky facet offsets are UTF-8 byte offsets, not JavaScript UTF-16 indices.
// Slicing the original string would corrupt emoji and non-Latin text.
export function utf8Slice(value: string, start: number, end: number): string {
  let byte = 0;
  let result = '';
  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index) || 0;
    const charLength = codePoint > 0xffff ? 2 : 1;
    const byteLength =
      codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    const next = byte + byteLength;
    if (next > start && byte < end) {
      result += value.slice(index, index + charLength);
    }
    byte = next;
    index += charLength;
  }
  return result;
}

function candidateForFacet(
  facet: any,
  totalBytes: number
): Candidate | null {
  if (!facet || !facet.index || !Array.isArray(facet.features)) return null;
  const start = Number(facet.index.byteStart);
  const end = Number(facet.index.byteEnd);
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > totalBytes
  ) {
    return null;
  }

  const link = facet.features.find((feature: any) => feature?.$type === LINK);
  if (
    link &&
    typeof link.uri === 'string' &&
    /^https?:\/\//i.test(link.uri)
  ) {
    return {
      start,
      end,
      segment: { kind: 'link', text: '', uri: link.uri },
    };
  }
  const mention = facet.features.find(
    (feature: any) => feature?.$type === MENTION
  );
  if (mention) {
    return {
      start,
      end,
      segment: {
        kind: 'mention',
        text: '',
        actor: typeof mention.did === 'string' ? mention.did : '',
      },
    };
  }
  const tag = facet.features.find((feature: any) => feature?.$type === TAG);
  if (tag && typeof tag.tag === 'string' && tag.tag) {
    return {
      start,
      end,
      segment: { kind: 'tag', text: '', tag: tag.tag.replace(/^#+/, '') },
    };
  }
  return null;
}

export function richTextSegments(text: string, facets: unknown): RichTextSegment[] {
  if (!text) return [];
  const totalBytes = utf8Length(text);
  const candidates: Candidate[] = [];
  if (Array.isArray(facets)) {
    for (const facet of facets) {
      const candidate = candidateForFacet(facet, totalBytes);
      if (candidate) candidates.push(candidate);
    }
  }
  candidates.sort(
    (left, right) => left.start - right.start || right.end - left.end
  );

  const segments: RichTextSegment[] = [];
  let cursor = 0;
  for (const candidate of candidates) {
    // Overlapping facets are malformed. Keep the first valid range and leave
    // the overlapping text visible instead of dropping part of the record.
    if (candidate.start < cursor) continue;
    if (candidate.start > cursor) {
      segments.push({
        kind: 'text',
        text: utf8Slice(text, cursor, candidate.start),
      });
    }
    const rawText = utf8Slice(text, candidate.start, candidate.end);
    const segment = candidate.segment;
    if (segment.kind === 'mention' && !segment.actor) {
      segment.actor = rawText.replace(/^@/, '');
    }
    segments.push({ ...segment, text: rawText });
    cursor = candidate.end;
  }

  if (cursor < totalBytes) {
    segments.push({ kind: 'text', text: utf8Slice(text, cursor, totalBytes) });
  }
  if (segments.length === 0) return [{ kind: 'text', text }];
  return segments;
}
