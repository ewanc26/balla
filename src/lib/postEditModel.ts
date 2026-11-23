/**
 * The honest edit rule for #160, adopting mu's shipped pattern rather than
 * inventing post versioning. AT Protocol has no standard post history, so an
 * edit is an explicit, one-time recreation: the same AT-URI and rkey, a new
 * record with `updatedAt` and the previous text kept in `originalText`, and
 * the engagement reset disclosed before the write.
 *
 * Every rule here is a client guardrail, not a protocol enforcement. Another
 * client can still write to the repository directly.
 */

export const EDIT_WINDOW_MS = 5 * 60 * 1000;
export const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const POST_COLLECTION = 'app.bsky.feed.post';

export const EDIT_DISCLOSURE =
  'Editing recreates this post at the same address. Likes, reposts and replies reset to zero. You can edit once, within five minutes of posting, and the full history stays visible with an Edited badge.';

export type PostEditBlockedReason =
  | 'not-own'
  | 'invalid-post'
  | 'edited'
  | 'window-closed'
  | 'account-too-new'
  | 'account-age-unknown';

export type PostEditState =
  | {
      kind: 'editable';
      text: string;
      createdAt: string;
      expiresAt: string;
    }
  | { kind: 'blocked'; reason: PostEditBlockedReason; message: string };

export type EditOffer =
  | { ok: true; expiresAt: string }
  | {
      ok: false;
      reason: 'invalid-post' | 'edited' | 'window-closed';
      message: string;
    };

export type EditHistoryEntry = {
  label: 'Original' | 'Current';
  at: string;
  text: string | null;
};

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function object(value: any): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

/** A record that carries a valid `updatedAt` has already used its one edit. */
export function editedAt(record: any): string | null {
  const value = object(record)?.updatedAt;
  return typeof value === 'string' && parseTime(value) !== null ? value : null;
}

export function isEdited(record: any): boolean {
  return editedAt(record) !== null;
}

/** The text the post had before its one edit, when the client kept it. */
export function editOriginalText(record: any): string | null {
  const value = object(record)?.originalText;
  return typeof value === 'string' ? value : null;
}

export function editWindowExpiresAt(record: any): string | null {
  const created = parseTime(object(record)?.createdAt);
  return created === null
    ? null
    : new Date(created + EDIT_WINDOW_MS).toISOString();
}

/**
 * Whether the post menu should offer Edit at all. This deliberately does not
 * check account age: the edit screen reads the viewer profile and enforces
 * that guard, so the menu never invents a fact the feed does not carry.
 */
export function canOfferEdit(record: any, now = Date.now()): EditOffer {
  const value = object(record);
  if (!value || typeof value.text !== 'string') {
    return {
      ok: false,
      reason: 'invalid-post',
      message: 'This record is not a post Balla can edit.',
    };
  }
  if (editedAt(value)) {
    return {
      ok: false,
      reason: 'edited',
      message:
        'This post has already been edited once. Balla keeps one edit per post, so nothing can be quietly rewritten twice.',
    };
  }
  const created = parseTime(value.createdAt);
  if (created === null) {
    return {
      ok: false,
      reason: 'invalid-post',
      message:
        'This post has no readable creation time, so Balla will not edit it.',
    };
  }
  if (now > created + EDIT_WINDOW_MS) {
    return {
      ok: false,
      reason: 'window-closed',
      message:
        'The five-minute edit window has closed. Post a new correction instead; Balla will not rewrite this post after the window.',
    };
  }
  return {
    ok: true,
    expiresAt: new Date(created + EDIT_WINDOW_MS).toISOString(),
  };
}

export function postEditState({
  record,
  authorDid,
  viewerDid,
  accountCreatedAt,
  now = Date.now(),
}: {
  record: any;
  authorDid?: string | null;
  viewerDid?: string | null;
  accountCreatedAt?: string | null;
  now?: number;
}): PostEditState {
  if (!viewerDid || !authorDid || authorDid !== viewerDid) {
    return {
      kind: 'blocked',
      reason: 'not-own',
      message: 'Only the author can edit this post.',
    };
  }

  const offer = canOfferEdit(record, now);
  if (!offer.ok) {
    return { kind: 'blocked', reason: offer.reason, message: offer.message };
  }

  const accountCreated = parseTime(accountCreatedAt);
  if (accountCreated === null) {
    return {
      kind: 'blocked',
      reason: 'account-age-unknown',
      message:
        'Balla could not read this account’s age, so it will not risk an edit. Try again in a moment.',
    };
  }
  if (now - accountCreated < MIN_ACCOUNT_AGE_MS) {
    return {
      kind: 'blocked',
      reason: 'account-too-new',
      message:
        'Accounts younger than seven days cannot edit in Balla. This is a client guardrail, not a protocol rule; delete and post again if the text must change.',
    };
  }

  const recordValue = object(record)!;
  return {
    kind: 'editable',
    text: recordValue.text,
    createdAt: recordValue.createdAt,
    expiresAt: offer.expiresAt,
  };
}

/**
 * The replacement record. Everything the edit does not own — createdAt, reply
 * parent, embeds, languages, self-labels, tags — is preserved. Facets are
 * rebuilt by the caller for the new text; stale facets are removed rather than
 * left pointing at the old offsets.
 */
export function buildEditedRecord(
  record: any,
  text: string,
  facets: any[] | undefined,
  updatedAt: string
): Record<string, any> {
  const current = object(record);
  if (!current || typeof current.text !== 'string') {
    throw new Error('This record is not a post Balla can edit.');
  }
  if (editedAt(current)) {
    throw new Error('This post has already been edited once.');
  }
  const next: Record<string, any> = {
    ...current,
    $type: current.$type || POST_COLLECTION,
    text,
    originalText: editOriginalText(current) ?? current.text,
    updatedAt,
  };
  if (facets && facets.length > 0) next.facets = facets;
  else delete next.facets;
  return next;
}

export function postRkey(uri: string): string | null {
  const match =
    /^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([A-Za-z0-9._~:-]+)$/.exec(
      typeof uri === 'string' ? uri : ''
    );
  return match ? match[1] : null;
}

export type EditWrite = {
  $type: string;
  collection: string;
  rkey: string;
  value?: Record<string, any>;
};

/**
 * One atomic applyWrites: delete the old record and create the replacement at
 * the same rkey. The AT-URI never changes, so quotes and reply anchors keep
 * pointing at the post. This is why the operation needs create and delete, not
 * an update action, and why no new OAuth scope is required.
 */
export function buildEditWrites(
  uri: string,
  record: any,
  text: string,
  facets: any[] | undefined,
  updatedAt: string
): { rkey: string; record: Record<string, any>; writes: EditWrite[] } {
  const rkey = postRkey(uri);
  if (!rkey) {
    throw new Error('This post address is not a single post Balla can edit.');
  }
  const value = buildEditedRecord(record, text, facets, updatedAt);
  return {
    rkey,
    record: value,
    writes: [
      {
        $type: 'com.atproto.repo.applyWrites#delete',
        collection: POST_COLLECTION,
        rkey,
      },
      {
        $type: 'com.atproto.repo.applyWrites#create',
        collection: POST_COLLECTION,
        rkey,
        value,
      },
    ],
  };
}

/**
 * Always exactly two entries, because the one-edit cap guarantees at most two
 * versions. A missing `originalText` is reported as unavailable rather than
 * reconstructed from the current text.
 */
export function editHistory(record: any): EditHistoryEntry[] | null {
  const updatedAt = editedAt(record);
  if (!updatedAt) return null;
  const current = object(record)!;
  return [
    {
      label: 'Original',
      at: typeof current.createdAt === 'string' ? current.createdAt : '',
      text: editOriginalText(current),
    },
    {
      label: 'Current',
      at: updatedAt,
      text: typeof current.text === 'string' ? current.text : null,
    },
  ];
}
