import { agent } from './agent';
import { recordReportReceipt } from './reportReceipts';
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportSubjectKind,
} from './reportModel';

export { REPORT_REASONS, type ReportReason } from './reportModel';

// Bluesky's moderation service. Reports must be sent to the labeler through
// the atproto-proxy header, not to the AppView.
export const BSKY_LABELER_DID = 'did:plc:ar7c4by46qjdydhdevvrndac';
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
  | { $type: 'com.atproto.admin.defs#repoRef'; did: string };

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

export async function muteActor(did: string) {
  return agent.app.bsky.graph.muteActor({ actor: did });
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
