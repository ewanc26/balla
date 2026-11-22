/**
 * Server-side drafts through the AppView's published `app.bsky.draft.*` RPCs,
 * the same endpoints the official client uses. The agent already routes
 * app.bsky.* through the AppView proxy and the OAuth metadata carries four
 * narrow `rpc:app.bsky.draft.*` scopes for these calls.
 *
 * Only text, labels, languages, gate rules and quote/external refs are stored:
 * media blobs are device-bound in the official client too, so loading a draft
 * reopens the choices and asks for photos/video again rather than inventing a
 * media ref.
 */
import { agent } from './agent';
import {
  buildDraftBody,
  type DraftChoiceState,
} from './serverDraftsModel.ts';

export type ServerDraft = {
  id: string;
  createdAt: string;
  updatedAt: string;
  draft: unknown;
};

/** Page through every draft for the signed-in account, newest page first. */
export async function listServerDrafts(): Promise<ServerDraft[]> {
  const all: ServerDraft[] = [];
  let cursor: string | undefined;
  do {
    const res = await agent.app.bsky.draft.getDrafts({
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...(res.data.drafts || []));
    cursor = res.data.cursor;
  } while (cursor);
  return all;
}

/** Create a new server draft and return its TID. */
export async function createServerDraft(state: DraftChoiceState): Promise<string> {
  const res = await agent.app.bsky.draft.createDraft({
    draft: buildDraftBody(state) as any,
  });
  return res.data.id;
}

/** Update an existing server draft in place with a full draft body. */
export async function updateServerDraft(
  id: string,
  state: DraftChoiceState
): Promise<void> {
  await agent.app.bsky.draft.updateDraft({
    draft: { id, draft: buildDraftBody(state) } as any,
  });
}

export async function deleteServerDraft(id: string): Promise<void> {
  await agent.app.bsky.draft.deleteDraft({ id });
}
