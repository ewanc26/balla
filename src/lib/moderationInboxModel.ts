// Pure moderation-inbox rules shared by the screens and Node tests. Nothing
// here invents a moderation outcome: unknown service values are shown verbatim
// or described as unknown.

export type InboxFilter = 'all' | 'pending' | 'resolved' | 'unread';
export type InboxSection = 'reports' | 'subjects' | 'accountStatus';
export type SubjectKind =
  | 'post'
  | 'account'
  | 'feed'
  | 'list'
  | 'starterPack'
  | 'status'
  | 'content'
  | 'chatMessage'
  | 'chatConvo';

export type SubjectDescriptor = {
  kind: SubjectKind;
  uri?: string;
  did?: string;
  collection?: string;
  rkey?: string;
};

export type ModerationAction = {
  id: number;
  type: string;
  scope?: string;
  createdAt: string;
  reversedAt?: string;
  expiresAt?: string;
  labels?: string[];
  policies?: { key: string; displayName: string; link: string }[];
};

const REASON_LABELS: Record<string, string> = {
  'com.atproto.moderation.defs#reasonSpam': 'Spam',
  'com.atproto.moderation.defs#reasonViolation': 'Violence or illegal content',
  'com.atproto.moderation.defs#reasonMisleading': 'Misleading',
  'com.atproto.moderation.defs#reasonSexual': 'Sexual content',
  'com.atproto.moderation.defs#reasonRude': 'Harassment or abuse',
  'com.atproto.moderation.defs#reasonOther': 'Something else',
  'com.atproto.moderation.defs#reasonAppeal': 'Appeal',
  'tools.ozone.report.defs#reasonAppeal': 'Appeal',
  'tools.ozone.report.defs#reasonOther': 'Something else',
  'tools.ozone.report.defs#reasonMisleadingSpam': 'Spam',
  'tools.ozone.report.defs#reasonMisleadingScam': 'Scam',
  'tools.ozone.report.defs#reasonMisleadingBot': 'Automated account',
  'tools.ozone.report.defs#reasonMisleadingImpersonation': 'Impersonation',
  'tools.ozone.report.defs#reasonHarassmentTroll': 'Trolling',
  'tools.ozone.report.defs#reasonHarassmentTargeted': 'Targeted harassment',
  'tools.ozone.report.defs#reasonHarassmentHateSpeech': 'Hate speech',
  'tools.ozone.report.defs#reasonHarassmentDoxxing': 'Doxxing',
  'tools.ozone.report.defs#reasonHarassmentOther': 'Harassment or abuse',
  'tools.ozone.report.defs#reasonViolenceThreats': 'Threats of violence',
  'tools.ozone.report.defs#reasonViolenceGraphicContent': 'Graphic violence',
  'tools.ozone.report.defs#reasonViolenceAnimal': 'Animal abuse',
  'tools.ozone.report.defs#reasonSexualUnlabeled': 'Unlabelled sexual content',
  'tools.ozone.report.defs#reasonSexualAbuseContent': 'Sexual abuse content',
  'tools.ozone.report.defs#reasonSexualNCII': 'Non-consensual intimate imagery',
  'tools.ozone.report.defs#reasonChildSafetyCSAM': 'Child sexual abuse material',
  'tools.ozone.report.defs#reasonSelfHarmContent': 'Self-harm content',
  'tools.ozone.report.defs#reasonRuleSiteSecurity': 'Site security',
  'tools.ozone.report.defs#reasonRuleProhibitedSales': 'Prohibited sales',
  'tools.ozone.report.defs#reasonRuleBanEvasion': 'Ban evasion',
  'tools.ozone.report.defs#reasonRuleOther': 'Breaking the rules',
};

const ACTION_LABELS: Record<string, string> = {
  contentRemoved: 'Content removed',
  contentRestored: 'Content restored',
  accountSuspended: 'Account suspended',
  accountTakedown: 'Account taken down',
  accountRestored: 'Account restored',
  labelApplied: 'Label applied',
  labelRemoved: 'Label removed',
  communicationSent: 'Communication sent',
  reportingRestricted: 'Reporting restricted',
  credentialsRevoked: 'Credentials revoked',
};

const APPEAL_DECISIONS = [
  'contentRemoved',
  'accountSuspended',
  'accountTakedown',
  'labelApplied',
];

function parseAtUri(uri: string): {
  did?: string;
  collection?: string;
  rkey?: string;
} {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!match) return {};
  return { did: match[1], collection: match[2], rkey: match[3] };
}

export function describeSubject(subject: any): SubjectDescriptor {
  if (!subject || typeof subject !== 'object') return { kind: 'content' };

  if (typeof subject.convoId === 'string') {
    return {
      kind: typeof subject.messageId === 'string' ? 'chatMessage' : 'chatConvo',
    };
  }

  if (typeof subject.uri === 'string') {
    const parsed = parseAtUri(subject.uri);
    switch (parsed.collection) {
      case 'app.bsky.feed.post':
        return { kind: 'post', uri: subject.uri, ...parsed };
      case 'app.bsky.feed.generator':
        return { kind: 'feed', uri: subject.uri, ...parsed };
      case 'app.bsky.graph.list':
        return { kind: 'list', uri: subject.uri, ...parsed };
      case 'app.bsky.graph.starterpack':
        return { kind: 'starterPack', uri: subject.uri, ...parsed };
      case 'app.bsky.actor.status':
        return { kind: 'status', uri: subject.uri, ...parsed };
      default:
        return { kind: 'content', uri: subject.uri, ...parsed };
    }
  }

  if (typeof subject.did === 'string') {
    return { kind: 'account', did: subject.did };
  }

  return { kind: 'content' };
}

export function subjectLabel(
  subject: any,
  perspective: 'report' | 'notice' = 'report'
): string {
  const descriptor = describeSubject(subject);
  const yours = perspective === 'notice';
  switch (descriptor.kind) {
    case 'post':
      return yours ? 'Your post' : 'Post';
    case 'account':
      return yours ? 'Your account' : 'Account';
    case 'feed':
      return yours ? 'Your feed' : 'Feed';
    case 'list':
      return yours ? 'Your list' : 'List';
    case 'starterPack':
      return yours ? 'Your starter pack' : 'Starter pack';
    case 'status':
      return yours ? 'Your account status' : 'Account status';
    case 'chatMessage':
      return 'Chat message';
    case 'chatConvo':
      return 'Conversation';
    default:
      return yours ? 'Your content' : 'Content';
  }
}

export function subjectWebUrl(subject: any): string | undefined {
  const descriptor = describeSubject(subject);
  if (descriptor.kind === 'account' && descriptor.did) {
    return `https://bsky.app/profile/${descriptor.did}`;
  }
  if (!descriptor.did || !descriptor.rkey) return undefined;
  const base = `https://bsky.app/profile/${descriptor.did}`;
  switch (descriptor.kind) {
    case 'post':
    case 'status':
      return `${base}/post/${descriptor.rkey}`;
    case 'feed':
      return `${base}/feed/${descriptor.rkey}`;
    case 'list':
      return `${base}/lists/${descriptor.rkey}`;
    case 'starterPack':
      return `${base}/starter-pack/${descriptor.rkey}`;
    default:
      return undefined;
  }
}

export function reportReasonLabel(reasonType?: string): string {
  if (!reasonType) return 'Report reason not supplied';
  return REASON_LABELS[reasonType] || 'Unknown report reason';
}

export function actionLabel(type?: string): string {
  if (!type) return 'Moderation action';
  return ACTION_LABELS[type] || 'Moderation action';
}

export function scopeLabel(scope?: string): string | undefined {
  switch (scope) {
    case 'network':
      return 'Network-wide';
    case 'app':
      return 'Bluesky app';
    case 'labelOnly':
      return 'Label only';
    default:
      return scope ? `Scope: ${scope}` : undefined;
  }
}

export function reportActionLabel({
  status,
  lastActionTaken,
  resolutionOutcome,
}: {
  status?: string;
  lastActionTaken?: string;
  resolutionOutcome?: string;
}): string | undefined {
  if (resolutionOutcome === 'noAction') return 'Reviewed, no action taken';
  if (lastActionTaken) return actionLabel(lastActionTaken);
  if (resolutionOutcome === 'actionTaken') return 'Action taken';
  if (status === 'pending') return 'Awaiting review';
  if (status === 'resolved') return 'Report resolved';
  return undefined;
}

export function isAppealDecision(action?: ModerationAction): boolean {
  return !!action && APPEAL_DECISIONS.includes(action.type);
}

export function currentAccountAction(
  data: any,
  actions: ModerationAction[]
): ModerationAction | undefined {
  if (!data || !('did' in (data.subject || {}))) return undefined;
  const type =
    data.enforcement?.state === 'takendown'
      ? 'accountTakedown'
      : data.enforcement?.state === 'suspended'
        ? 'accountSuspended'
        : undefined;
  return type
    ? actions.find((action) => action.type === type && !action.reversedAt)
    : undefined;
}

export function appealAction(
  data: any,
  actions: ModerationAction[]
): ModerationAction | undefined {
  if (
    data &&
    'did' in (data.subject || {}) &&
    (data.enforcement?.state === 'takendown' ||
      data.enforcement?.state === 'suspended')
  ) {
    return currentAccountAction(data, actions);
  }
  return actions.find(
    (action) => !action.reversedAt && isAppealDecision(action)
  );
}

export function appealReference(
  data: any,
  action?: ModerationAction
): any | undefined {
  if (action) {
    return {
      $type: 'tools.ozone.inbox.appealActionedSubject#actionRef',
      id: action.id,
    };
  }
  if (
    data &&
    'did' in (data.subject || {}) &&
    (data.enforcement?.state === 'takendown' ||
      data.enforcement?.state === 'suspended')
  ) {
    return {
      $type: 'tools.ozone.inbox.appealActionedSubject#takedownRef',
    };
  }
  return undefined;
}

export function canAppeal(data: any): boolean {
  return !!data?.availableActions?.includes('appeal');
}

function actionIsNewerThanAppeal(data: any): boolean {
  if (data?.appeal?.state !== 'resolved' || !data.appeal.resolvedAt) return false;
  const action = data.actions?.[0];
  if (!action?.createdAt) return false;
  return (
    Date.parse(action.createdAt) > Date.parse(data.appeal.resolvedAt)
  );
}

export function appealSummary(data: any): {
  label: string;
  tone: 'pending' | 'good' | 'danger' | 'muted';
} | null {
  const appeal = data?.appeal;
  if (!appeal || appeal.state === 'none') return null;
  if (appeal.state === 'pending') {
    return { label: 'Appeal under review', tone: 'pending' };
  }
  if (appeal.state === 'resolved') {
    const newer = actionIsNewerThanAppeal(data);
    const prefix = newer ? 'Previous appeal' : 'Appeal';
    if (appeal.outcome === 'approved') {
      return { label: `${prefix} approved`, tone: 'good' };
    }
    if (appeal.outcome === 'denied') {
      return { label: `${prefix} denied`, tone: 'danger' };
    }
    return { label: `${prefix} resolved`, tone: 'muted' };
  }
  if (appeal.state === 'expired') {
    return { label: 'Appeal window closed', tone: 'muted' };
  }
  return { label: 'Previous appeal closed', tone: 'muted' };
}

export function noticeTitle(data: any): string {
  const appeal = appealSummary(data);
  if (appeal?.label === 'Appeal under review') return 'Appeal under review';
  if (
    appeal?.label.startsWith('Appeal ') &&
    data?.appeal?.state === 'resolved' &&
    !actionIsNewerThanAppeal(data)
  ) {
    return appeal.label;
  }
  const descriptor = describeSubject(data?.subject);
  const account = descriptor.kind === 'account';
  if (account && data?.enforcement?.state === 'takendown') {
    return 'Your account is suspended';
  }
  if (account && data?.enforcement?.state === 'suspended') {
    return 'Your account is temporarily suspended';
  }
  const action = data?.actions?.[0];
  if (action?.reversedAt) {
    return account
      ? 'The action against your account was reversed'
      : 'The action against your content was reversed';
  }
  if (action?.type === 'contentRemoved') {
    return descriptor.kind === 'post' ? 'Your post was removed' : 'Your content was removed';
  }
  if (action?.type === 'labelApplied') {
    return account
      ? 'A label was added to your account'
      : descriptor.kind === 'post'
        ? 'A label was added to your post'
        : 'A label was added to your content';
  }
  if (action?.type === 'communicationSent') {
    return 'An email was sent about your account';
  }
  if (action?.type) return actionLabel(action.type);
  if (data?.enforcement?.state && data.enforcement.state !== 'none') {
    return 'Account enforcement notice';
  }
  return 'Moderation notice';
}

export function enforcementLabel(state?: string): string {
  switch (state) {
    case 'none':
      return 'No active enforcement';
    case 'labeled':
      return 'Active label';
    case 'removed':
      return 'Content removed';
    case 'suspended':
      return 'Temporarily suspended';
    case 'takendown':
      return 'Suspended';
    default:
      return state ? `Enforcement: ${state}` : 'Enforcement not supplied';
  }
}

export function standingLabel(standing?: string): {
  label: string;
  tone: 'good' | 'warning' | 'danger' | 'muted';
} | null {
  switch (standing) {
    case 'good':
      return { label: 'Account in good standing', tone: 'good' };
    case 'warning':
      return { label: 'Account has moderation actions', tone: 'warning' };
    case 'atRisk':
      return { label: 'Account is at risk', tone: 'danger' };
    case undefined:
    case '':
      return null;
    default:
      return { label: `Account standing: ${standing}`, tone: 'muted' };
  }
}

export function formatModerationDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatModerationDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function isSafeHttpUrl(value?: string): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}
