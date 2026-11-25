import { countGraphemes } from 'unicode-segmenter/grapheme';
import { isAuthFailure } from './failureCopyModel.ts';

export const CURATE_LIST = 'app.bsky.graph.defs#curatelist';
export const MOD_LIST = 'app.bsky.graph.defs#modlist';
export const REFERENCE_LIST = 'app.bsky.graph.defs#referencelist';

export const LIST_NAME_MAX = 64;
export const LIST_DESCRIPTION_MAX = 300;

export type CreatableListPurpose = typeof CURATE_LIST | typeof MOD_LIST;
export type ListPurpose =
  | CreatableListPurpose
  | typeof REFERENCE_LIST
  | (string & {});

export const CREATABLE_LIST_PURPOSES: ReadonlyArray<{
  value: CreatableListPurpose;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: CURATE_LIST,
    label: 'Curation list',
    shortLabel: 'Curation',
    description:
      'A group of people you want to read together. Curation lists have a chronological list feed.',
  },
  {
    value: MOD_LIST,
    label: 'Moderation list',
    shortLabel: 'Moderation',
    description:
      'A group of accounts you want to mute or block together. Subscribing applies the list to your account.',
  },
];

export function isCreatableListPurpose(
  value: unknown
): value is CreatableListPurpose {
  return value === CURATE_LIST || value === MOD_LIST;
}

export function listPurposeMeta(value: unknown): {
  label: string;
  shortLabel: string;
  description: string;
} {
  const found = CREATABLE_LIST_PURPOSES.find((item) => item.value === value);
  if (found) return found;
  if (value === REFERENCE_LIST) {
    return {
      label: 'Reference list',
      shortLabel: 'Reference',
      description: 'A list used to group accounts for reference.',
    };
  }
  return {
    label: 'List',
    shortLabel: 'List',
    description: 'An AT Protocol list.',
  };
}

export function isCurateList(list: any): boolean {
  return list?.purpose === CURATE_LIST;
}

export function isModList(list: any): boolean {
  return list?.purpose === MOD_LIST;
}

export function validateListDraft(
  name: unknown,
  description: unknown
): string | null {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanDescription =
    typeof description === 'string' ? description.trim() : '';

  if (!cleanName) return 'Give the list a name.';
  if (countGraphemes(cleanName) > LIST_NAME_MAX) {
    return `List names can be at most ${LIST_NAME_MAX} characters.`;
  }
  if (countGraphemes(cleanDescription) > LIST_DESCRIPTION_MAX) {
    return `List descriptions can be at most ${LIST_DESCRIPTION_MAX} characters.`;
  }
  return null;
}

export function listViewerState(list: any): {
  subscribed: boolean;
  blocked: boolean;
  hidden: boolean;
  blockedUri?: string;
} {
  const labels = Array.isArray(list?.labels) ? list.labels : [];
  return {
    subscribed: list?.viewer?.muted === true,
    blocked: typeof list?.viewer?.blocked === 'string',
    hidden: labels.some((label: any) => label?.val === '!hide'),
    blockedUri:
      typeof list?.viewer?.blocked === 'string'
        ? list.viewer.blocked
        : undefined,
  };
}

export function listMemberCount(list: any, fallback = 0): number {
  const count = Number(list?.listItemCount);
  return Number.isFinite(count) && count >= 0 ? count : fallback;
}

export function mergeUniqueLists(groups: any[][]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const group of groups) {
    for (const list of group || []) {
      if (!list || typeof list.uri !== 'string' || !list.uri) continue;
      if (seen.has(list.uri)) continue;
      seen.add(list.uri);
      result.push(list);
    }
  }
  return result;
}

export function filterLists(lists: any[], query: unknown): any[] {
  const term =
    typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
  if (!term) return lists;
  return lists.filter((list) => {
    const haystack = [
      list?.name,
      list?.description,
      list?.creator?.handle,
      list?.creator?.displayName,
    ]
      .filter((value) => typeof value === 'string')
      .join('\n')
      .toLocaleLowerCase();
    return haystack.includes(term);
  });
}

export function recordKey(uri: string): string {
  const key = typeof uri === 'string' ? uri.split('/').pop() : '';
  if (!key) throw new Error('This record has no address.');
  return key;
}

export function listSharePath(list: any): string | null {
  if (!list?.uri || !list?.creator?.handle) return null;
  const rkey = recordKey(list.uri);
  return `/profile/${list.creator.handle}/lists/${rkey}`;
}

export function listActionError(cause: unknown, fallback: string): string {
  if (isAuthFailure(cause)) {
    return 'Your session needs renewing before Balla can manage lists. Sign out, sign in again, and retry.';
  }
  return fallback;
}
