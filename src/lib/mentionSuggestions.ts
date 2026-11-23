export type TextSelection = { start: number; end: number };

export type ActiveMention = { query: string; start: number; end: number };

export type MentionActor = {
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
};

const HANDLE_CHARACTER = /[A-Za-z0-9.-]/;
const EMAIL_CHARACTER = /[A-Za-z0-9._%+-]/;

/**
 * Finds the @handle token under a collapsed cursor. Email-like text is not a
 * mention, and a range selection has no single token to replace.
 */
export function activeMentionQuery(
  text: string,
  selection: TextSelection
): ActiveMention | null {
  const cursorStart = Math.max(0, Math.min(selection.start, text.length));
  const cursorEnd = Math.max(0, Math.min(selection.end, text.length));
  if (cursorStart !== cursorEnd) return null;

  let start = -1;
  for (let index = cursorStart - 1; index >= 0; index -= 1) {
    const character = text[index];
    if (character === '@') {
      // "name@example.com" is an address, not a mention.
      if (index > 0 && EMAIL_CHARACTER.test(text[index - 1])) return null;
      start = index;
      break;
    }
    if (!HANDLE_CHARACTER.test(character)) return null;
  }
  if (start < 0) return null;

  let end = cursorEnd;
  while (end < text.length && HANDLE_CHARACTER.test(text[end])) end += 1;

  // A trailing dot cannot end a Bluesky handle. Leave it outside the token so
  // choosing a result preserves sentence punctuation instead of consuming it.
  let tokenEnd = end;
  while (tokenEnd > start + 1 && text[tokenEnd - 1] === '.') tokenEnd -= 1;

  return {
    query: text.slice(start + 1, tokenEnd),
    start,
    end: tokenEnd,
  };
}

/** A search result is only usable when it carries a real handle. */
export function normaliseMentionHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@+/, '');
  if (!handle || /\s/.test(handle)) return null;
  return handle;
}

/**
 * Replaces the active token with a canonical handle and leaves the cursor ready
 * to keep typing. Existing whitespace or punctuation after the token is kept
 * as-is, so a sentence does not gain a space before its comma.
 */
export function applyMention(
  text: string,
  mention: ActiveMention,
  handle: unknown
): { text: string; cursor: number } {
  const cleaned = normaliseMentionHandle(handle);
  if (!cleaned) return { text, cursor: mention.end };

  const suffix = text.slice(mention.end);
  const separator = !suffix || !/^[\s.,;:!?)]/.test(suffix) ? ' ' : '';
  const inserted = `@${cleaned}${separator}`;

  return {
    text: `${text.slice(0, mention.start)}${inserted}${suffix}`,
    cursor: mention.start + inserted.length,
  };
}

/** Filters AppView results to unique, usable handles, capped for the picker. */
export function mentionActors(value: unknown, limit = 6): MentionActor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const actors: MentionActor[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as MentionActor;
    const handle = normaliseMentionHandle(candidate.handle);
    if (!handle) continue;

    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    actors.push({ ...candidate, handle });
    if (actors.length >= Math.max(1, limit)) break;
  }

  return actors;
}
