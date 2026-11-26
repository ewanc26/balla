import { agent } from './agent';
import { recordReportReceipt } from './reportReceipts';
import { SERVICE_HOSTS } from './serviceHosts.ts';
import {
  buildProfileLinkReportSubject,
  REPORT_REASONS,
  type ReportReason,
  type ReportSubjectKind,
} from './reportModel';
import {
  buildConvoReportSubject,
  buildMessageReportSubject,
} from './chatGroupModel';

export { REPORT_REASONS, type ReportReason } from './reportModel';

// Bluesky's moderation service. Reports must be sent to the labeler through
// the atproto-proxy header, not to the AppView.
export const BSKY_LABELER_DID: string = SERVICE_HOSTS.labelerDid;
export const BSKY_LABELER_PROXY = `${BSKY_LABELER_DID}#atproto_labeler`;

type ActorHiddenListener = (did: string) => void;
const actorHiddenListeners = new Set<ActorHiddenListener>();

export function notifyActorHidden(did: string) {
  for (const listener of actorHiddenListeners) listener(did);
}

export function subscribeActorHidden(listener: ActorHiddenListener) {
  actorHiddenListeners.add(listener);
  return () => {
    actorHiddenListeners.delete(listener);
  };
}

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

function recordKey(uri: string): string {
  const key = typeof uri === 'string' ? uri.split('/').pop() : '';
  if (!key) throw new Error('This record has no address.');
  return key;
}

/**
 * One submission path for every subject kind: the API call through the labeler
 * proxy, then a local receipt only after the service has accepted the report.
 */
type ReportSubject =
  | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string }
  | { $type: 'com.atproto.admin.defs#repoRef'; did: string }
  // The createReport union is open; chat refs are carried in its unlisted arm.
  | { $type: string; [key: string]: unknown };

async function submitReport(
  subject: ReportSubject,
  subjectKind: ReportSubjectKind,
  subjectLabel: string,
  subjectUri: string | undefined,
  reasonType: ReportReason,
  details: string
) {
  const reason = details.trim();
  const response = await agent.com.atproto.moderation.createReport(
    { reasonType, ...(reason ? { reason } : {}), subject },
    { headers: { 'atproto-proxy': BSKY_LABELER_PROXY } }
  );
  await recordReportReceipt({
    id: response.data.id,
    createdAt: response.data.createdAt,
    reasonType,
    subjectKind,
    subjectLabel,
    ...(subjectUri ? { subjectUri } : {}),
  });
  return response;
}

export async function reportPost(
  post: any,
  reasonType: ReportReason,
  details: string
) {
  const handle = post?.author?.handle || 'unknown account';
  return submitReport(
    {
      $type: 'com.atproto.repo.strongRef',
      uri: post.uri,
      cid: post.cid,
    },
    'post',
    `Post by @${handle}`,
    post.uri,
    reasonType,
    details
  );
}

export async function reportProfile(
  profile: any,
  reasonType: ReportReason,
  details: string
) {
  return submitReport(
    { $type: 'com.atproto.admin.defs#repoRef', did: profile.did },
    'profile',
    `@${profile.handle || 'unknown account'}`,
    undefined,
    reasonType,
    details
  );
}

/**
 * Chat reports use the open end of the createReport subject union. The subject
 * carries ids only — never message text. Reports still go to the labeler
 * service, not to the chat service.
 */
export async function reportChatMessage(
  convoId: string,
  message: any,
  reasonType: ReportReason,
  details: string
) {
  return submitReport(
    buildMessageReportSubject(convoId, message),
    'chat-message',
    'Chat message',
    undefined,
    reasonType,
    details
  );
}

export async function reportChatConversation(
  convoId: string,
  members: any[] | undefined,
  reasonType: ReportReason,
  details: string
) {
  return submitReport(
    buildConvoReportSubject(convoId, members),
    'chat-convo',
    'Conversation',
    undefined,
    reasonType,
    details
  );
}

/** Profile links are reported as link views, carrying the record strong ref. */
export async function reportProfileLink(
  link: any,
  reasonType: ReportReason,
  details: string
) {
  const label =
    typeof link?.title === 'string' && link.title.trim()
      ? link.title.trim()
      : link?.url || 'Profile link';
  return submitReport(
    buildProfileLinkReportSubject(link),
    'profile-link',
    `Link “${label}”`,
    link?.uri,
    reasonType,
    details
  );
}

/** Lists are records, so they are reported by strong ref like posts. */
export async function reportList(
  list: any,
  reasonType: ReportReason,
  details: string
) {
  const name = typeof list?.name === 'string' && list.name.trim()
    ? list.name.trim()
    : 'Unnamed list';
  return submitReport(
    {
      $type: 'com.atproto.repo.strongRef',
      uri: list.uri,
      cid: list.cid,
    },
    'list',
    `List “${name}”`,
    list.uri,
    reasonType,
    details
  );
}

/** Feed generators are records, so they are reported by strong ref like lists. */
export async function reportFeed(
  feed: any,
  reasonType: ReportReason,
  details: string
) {
  const name =
    typeof feed?.displayName === 'string' && feed.displayName.trim()
      ? feed.displayName.trim()
      : 'Unnamed feed';
  return submitReport(
    {
      $type: 'com.atproto.repo.strongRef',
      uri: feed.uri,
      cid: feed.cid,
    },
    'feed',
    `Feed “${name}”`,
    feed.uri,
    reasonType,
    details
  );
}

export async function muteActor(did: string) {
  return agent.app.bsky.graph.muteActor({ actor: did });
}

/** Repost-only muting is a scoped actor mute, not a separate record write. */
export async function muteRepostsActor(did: string) {
  return agent.app.bsky.graph.muteActor({ actor: did, onlyReposts: true });
}

export async function unmuteActor(did: string) {
  return agent.app.bsky.graph.unmuteActor({ actor: did });
}

export async function blockActor(did: string): Promise<string> {
  const res = await agent.com.atproto.repo.createRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.block',
    record: {
      $type: 'app.bsky.graph.block',
      subject: did,
      createdAt: new Date().toISOString(),
    },
  });
  return res.data.uri;
}

export async function unblockActor(blockUri: string) {
  return agent.com.atproto.repo.deleteRecord({
    repo: signedInDid(),
    collection: 'app.bsky.graph.block',
    rkey: recordKey(blockUri),
  });
}

export async function deletePost(postUri: string) {
  return agent.com.atproto.repo.deleteRecord({
    repo: signedInDid(),
    collection: 'app.bsky.feed.post',
    rkey: recordKey(postUri),
  });
}
