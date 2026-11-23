/**
 * Real availability probe for the account's chat service. A single minimal
 * chat RPC goes through the documented service proxy, which is the only way
 * to know whether THIS account's host can serve chat: the existence of a
 * chat.bsky DID document says nothing about whether a PDS will proxy to it.
 */
import { getChatAgent } from './agent';
import { chatServiceStateFromError, type ChatServiceState } from './chatServiceModel';

export async function checkChatService(): Promise<ChatServiceState> {
  try {
    await getChatAgent().chat.bsky.convo.listConvos({ limit: 1 });
    return 'reachable';
  } catch (err) {
    return chatServiceStateFromError(err);
  }
}
