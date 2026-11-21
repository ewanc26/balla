import { agent } from './agent';

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

export const REPORT_REASONS = [
  {
    value: 'com.atproto.moderation.defs#reasonSpam',
    label: 'Spam',
    detail: 'Scams, repeated unwanted posts, or bulk commercial content.',
  },
  {
    value: 'com.atproto.moderation.defs#reasonRude',
    label: 'Harassment or abuse',
    detail: 'Targeted abuse, threats, or bullying.',
  },
  {
    value: 'com.atproto.moderation.defs#reasonMisleading',
    label: 'Misleading',
    detail: 'False or deceptive claims, including manipulated media.',
  },
  {
    value: 'com.atproto.moderation.defs#reasonSexual',
    label: 'Sexual content',
    detail: 'Explicit sexual content or nudity.',
  },
  {
    value: 'com.atproto.moderation.defs#reasonViolation',
    label: 'Violence or illegal content',
    detail: 'Graphic violence, self-harm, or illegal activity.',
  },
  {
    value: 'com.atproto.moderation.defs#reasonOther',
    label: 'Something else',
    detail: 'Content that does not fit the categories above.',
  },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

function recordKey(uri: string): string {
  const key = typeof uri === 'string' ? uri.split('/').pop() : '';
  if (!key) throw new Error('This record has no address.');
  return key;
}

export async function reportPost(
  post: any,
  reasonType: ReportReason,
  details: string
) {
  const reason = details.trim();
  return agent.com.atproto.moderation.createReport(
    {
      reasonType,
      ...(reason ? { reason } : {}),
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uri,
        cid: post.cid,
      },
    },
    { headers: { 'atproto-proxy': BSKY_LABELER_PROXY } }
  );
}

export async function reportProfile(
  profile: any,
  reasonType: ReportReason,
  details: string
) {
  const reason = details.trim();
  return agent.com.atproto.moderation.createReport(
    {
      reasonType,
      ...(reason ? { reason } : {}),
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: profile.did,
      },
    },
    { headers: { 'atproto-proxy': BSKY_LABELER_PROXY } }
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
