/**
 * Framework-free conversion between Balla's composer choices and the published
 * `app.bsky.draft` lexicon shapes used by the AppView's draft RPCs.
 *
 * Only what Balla can honestly restore is persisted: text, self-labels,
 * languages, gate rules, an external link and a quoted post strong ref. Media
 * blobs are device-bound in the official client too (they live in a local
 * cache keyed by localRef path), so Balla never invents a media ref — loading a
 * draft reopens its text and choices, and photos/videos are added again.
 */

import { gatesToInteractionPref } from './accountPreferencesModel.ts';
import {
  listUriFromRecord,
  normaliseGates,
  quoteAccessFromRecord,
  replyAccessFromRecord,
  type InteractionGates,
} from './interactionGates.ts';
import { normaliseLanguages, normaliseSelfLabels } from './postOptions.ts';

export type DraftChoiceState = {
  text: string;
  selfLabels: string[];
  languages: string[];
  gates: InteractionGates;
  externalUri?: string | null;
  quote?: { uri: string; cid: string } | null;
};

export type DraftSummary = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  hasQuote: boolean;
  hasExternal: boolean;
  labels: string[];
  languages: string[];
};

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= limit) break;
  }
  return out;
}

/** A strong ref needs both an at:// uri and a cid; never store a half ref. */
function strongRef(value: unknown): { uri: string; cid: string } | null {
  if (!value || typeof value !== 'object') return null;
  const uri = (value as any).uri;
  const cid = (value as any).cid;
  if (
    typeof uri === 'string' &&
    uri.startsWith('at://') &&
    typeof cid === 'string' &&
    cid.trim().length > 0
  ) {
    return { uri: uri.trim(), cid: cid.trim() };
  }
  return null;
}

/** Build the `app.bsky.draft.defs#draft` body for createDraft/updateDraft. */
export function buildDraftBody(state: DraftChoiceState): Record<string, unknown> {
  const post: Record<string, unknown> = {
    $type: 'app.bsky.draft.defs#draftPost',
    text: typeof state.text === 'string' ? state.text : '',
  };
  const labels = normaliseSelfLabels(state.selfLabels || []);
  if (labels.length) {
    post.labels = {
      $type: 'com.atproto.label.defs#selfLabels',
      values: labels.map((val) => ({ val })),
    };
  }
  const quote = strongRef(state.quote);
  if (quote) {
    post.embedRecords = [{ $type: 'app.bsky.draft.defs#draftEmbedRecord', record: quote }];
  }
  const external = typeof state.externalUri === 'string' ? state.externalUri.trim() : '';
  if (external) {
    post.embedExternals = [
      { $type: 'app.bsky.draft.defs#draftEmbedExternal', uri: external },
    ];
  }
  const { threadgateAllowRules, postgateEmbeddingRules } = gatesToInteractionPref(
    normaliseGates(state.gates)
  );
  const draft: Record<string, unknown> = {
    $type: 'app.bsky.draft.defs#draft',
    posts: [post],
  };
  const langs = normaliseLanguages(state.languages || []);
  if (langs.length) draft.langs = langs;
  if (threadgateAllowRules) draft.threadgateAllow = threadgateAllowRules;
  if (postgateEmbeddingRules) draft.postgateEmbeddingRules = postgateEmbeddingRules;
  return draft;
}

/** Turn a DraftView into a compact, honest list summary. */
export function draftViewSummary(view: any): DraftSummary | null {
  if (!view || typeof view.id !== 'string') return null;
  const draft = view.draft && typeof view.draft === 'object' ? view.draft : {};
  const posts = Array.isArray(draft.posts) ? draft.posts : [];
  const first = posts[0] && typeof posts[0] === 'object' ? posts[0] : {};
  const labels = Array.isArray(first.labels?.values)
    ? first.labels.values
        .map((item: any) => (typeof item?.val === 'string' ? item.val : ''))
        .filter(Boolean)
    : [];
  return {
    id: view.id,
    text: typeof first.text === 'string' ? first.text : '',
    createdAt: typeof view.createdAt === 'string' ? view.createdAt : '',
    updatedAt: typeof view.updatedAt === 'string' ? view.updatedAt : '',
    hasQuote: Array.isArray(first.embedRecords) && first.embedRecords.length > 0,
    hasExternal: Array.isArray(first.embedExternals) && first.embedExternals.length > 0,
    labels: stringList(labels, 8),
    languages: stringList(draft.langs, 3),
  };
}

/** Restore the part of a draft the composer can actually reopen. */
export function draftViewToChoices(view: any): DraftChoiceState {
  const summary = draftViewSummary(view);
  const draft = view?.draft && typeof view.draft === 'object' ? view.draft : {};
  const post = Array.isArray(draft.posts) && draft.posts[0] ? draft.posts[0] : {};
  const quote = strongRef(post.embedRecords?.[0]?.record);
  const external =
    typeof post.embedExternals?.[0]?.uri === 'string'
      ? post.embedExternals[0].uri.trim()
      : undefined;
  // Drafts persist raw gate rule arrays under threadgateAllow /
  // postgateEmbeddingRules. Map them through the record helpers so a list rule
  // only restores when it still carries a real app.bsky.graph.list AT-URI.
  const allow = Array.isArray(draft.threadgateAllow) ? draft.threadgateAllow : undefined;
  const embeddingRules = Array.isArray(draft.postgateEmbeddingRules)
    ? draft.postgateEmbeddingRules
    : undefined;
  const restoredGates: InteractionGates = {
    reply: replyAccessFromRecord({ allow }),
    quote: quoteAccessFromRecord({ embeddingRules }),
  };
  if (restoredGates.reply === 'list') {
    restoredGates.listUri = listUriFromRecord({ allow }) || undefined;
  }
  const gates = normaliseGates(restoredGates);
  return {
    text: summary?.text || '',
    selfLabels: summary?.labels || [],
    languages: summary?.languages || [],
    gates,
    quote,
    externalUri: external,
  };
}

/** Newest-updated first, with an id tiebreak for deterministic ordering. */
export function sortDrafts(views: any[]): any[] {
  return (Array.isArray(views) ? views : [])
    .filter((view) => view && typeof view.id === 'string')
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      if (bTime !== aTime) return bTime - aTime;
      return String(a.id).localeCompare(String(b.id));
    });
}
