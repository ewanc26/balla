/**
 * Public chat-service DID document read for Advanced → Chat (#97, partial).
 *
 * The screen used to fetch the chat service's DID document with a raw,
 * unbounded fetch. A host that accepted the request but never answered left
 * the availability line on "Checking…" indefinitely. The read now goes through
 * the shared bounded identity reader, so the deadline, abort signal and
 * "never read provider prose" rule live in one place. Any failure fails closed
 * to null: the proxy probe result still decides the visible chat state.
 */

import { chatServiceAdvertised } from './chatServiceModel.ts';
import {
  fetchIdentityDocument,
  type IdentityDocumentReadDeps,
} from './identityDocumentRead.ts';
import { CHAT_DID_DOCUMENT_URL } from './serviceHosts.ts';

export type ChatDidReadDeps = IdentityDocumentReadDeps;

export async function readChatDidAdvertises(deps: ChatDidReadDeps = {}): Promise<boolean | null> {
  const document = await fetchIdentityDocument(CHAT_DID_DOCUMENT_URL, deps);
  if (!document) return null;
  return chatServiceAdvertised(document);
}
