/**
 * Framework-free model for the composer's local draft recovery.
 *
 * Only text and simple choices are persisted. Photos are binary blobs and
 * quotes are full AppView objects, so neither is written to storage; the
 * recovery prompt says so out loud rather than implying a complete restore.
 */

import {
  DEFAULT_INTERACTION_GATES,
  gatesEqual,
  normaliseGates,
  type InteractionGates,
} from './interactionGates.ts';

export type StoredDraft = {
  text: string;
  selfLabels: string[];
  languages: string[];
  gates: InteractionGates;
  savedAt: string;
};

export const EMPTY_STORED_DRAFT: StoredDraft = {
  text: '',
  selfLabels: [],
  languages: [],
  gates: DEFAULT_INTERACTION_GATES,
  savedAt: '',
};

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= limit) break;
  }
  return result;
}

/** Parse untrusted JSON into a draft, or return null when there is nothing to recover. */
export function parseStoredDraft(value: string | null | undefined): StoredDraft | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const draft: StoredDraft = {
    text: typeof record.text === 'string' ? record.text : '',
    selfLabels: stringList(record.selfLabels, 8),
    languages: stringList(record.languages, 3),
    gates: normaliseGates(record.gates),
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
  };
  return hasDraftContent(draft) ? draft : null;
}

/** A draft with only default settings is not worth prompting to recover. */
export function hasDraftContent(draft: StoredDraft | null | undefined): boolean {
  if (!draft) return false;
  return (
    draft.text.trim().length > 0 ||
    draft.selfLabels.length > 0 ||
    draft.languages.length > 0 ||
    !gatesEqual(draft.gates, DEFAULT_INTERACTION_GATES)
  );
}

export function serialiseDraft(draft: StoredDraft): string {
  return JSON.stringify({
    text: draft.text,
    selfLabels: draft.selfLabels,
    languages: draft.languages,
    gates: draft.gates,
    savedAt: draft.savedAt,
  });
}

export function describeDraft(draft: StoredDraft): string {
  const parts: string[] = [];
  const text = draft.text.trim();
  if (text) parts.push(text.length > 80 ? `${text.slice(0, 80)}…` : text);
  if (draft.selfLabels.length) {
    parts.push(
      `${draft.selfLabels.length} content warning${draft.selfLabels.length === 1 ? '' : 's'}`
    );
  }
  if (draft.languages.length) {
    parts.push(
      `${draft.languages.length} language${draft.languages.length === 1 ? '' : 's'}`
    );
  }
  return parts.join(' · ');
}
