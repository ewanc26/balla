import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { agent } from './agent';
import { errorCode, isAuthFailure, statusCode } from './failureCopyModel.ts';
import { BSKY_LABELER_DID } from './moderation';
import type { InboxFilter, InboxSection } from './moderationInboxModel';

// The inbox lives on the moderation service, not the AppView. Each call is
// routed with atproto-proxy for the labeler service DID.
function proxyHeaders(serviceDid = BSKY_LABELER_DID) {
  return { 'atproto-proxy': `${serviceDid}#atproto_labeler` };
}

function requireService(service: string): string {
  if (!/^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(service)) {
    throw new Error('The moderation service address is invalid.');
  }
  return service;
}

function requireId(id: number): number {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('The report ID is invalid.');
  }
  return id;
}

export async function listInboxReports({
  filter,
  cursor,
  limit = 50,
}: {
  filter: InboxFilter;
  cursor?: string;
  limit?: number;
}) {
  const res = await agent.tools.ozone.inbox.listReports(
    { filter, limit, cursor },
    { headers: proxyHeaders() }
  );
  return res.data;
}

export async function getInboxReport(service: string, id: number) {
  const res = await agent.tools.ozone.inbox.getReport(
    { id: requireId(id) },
    { headers: proxyHeaders(requireService(service)) }
  );
  return res.data;
}

export async function listInboxActionedSubjects({
  filter,
  cursor,
  limit = 50,
}: {
  filter: InboxFilter;
  cursor?: string;
  limit?: number;
}) {
  const res = await agent.tools.ozone.inbox.listActionedSubjects(
    { filter, limit, cursor },
    { headers: proxyHeaders() }
  );
  return res.data;
}

export async function getInboxActionedSubject(
  service: string,
  subject: string,
  {
    cursor,
    limit = 50,
  }: {
    cursor?: string;
    limit?: number;
  } = {}
) {
  if (!subject) throw new Error('The moderation subject is missing.');
  const res = await agent.tools.ozone.inbox.getActionedSubject(
    { subject, limit, cursor },
    { headers: proxyHeaders(requireService(service)) }
  );
  return res.data;
}

export async function getInboxAccountStatus() {
  const res = await agent.tools.ozone.inbox.getAccountStatus(
    {},
    { headers: proxyHeaders() }
  );
  return res.data;
}

export async function getInboxUnreadCount() {
  const res = await agent.tools.ozone.inbox.getUnreadCount(
    {},
    { headers: proxyHeaders() }
  );
  return res.data.unreadCounts;
}

export async function markInboxSeen(sections: InboxSection[]) {
  const res = await agent.tools.ozone.inbox.updateSeen(
    { sections },
    { headers: proxyHeaders() }
  );
  return res.data;
}

export async function appealInboxSubject(
  service: string,
  input: {
    subject: any;
    reason: string;
    action?: any;
  }
) {
  const res = await agent.tools.ozone.inbox.appealActionedSubject(
    input,
    { headers: proxyHeaders(requireService(service)) }
  );
  return res.data;
}

export function describeInboxError(err: unknown, fallback: string): string {
  // No provider message is read. Only structured status and error codes can
  // select one of Balla's own sentences.
  if (isAuthFailure(err)) {
    return 'Your session needs renewing before it can read the moderation inbox. Sign out, sign in again, and retry.';
  }
  const status = statusCode(err);
  const code = errorCode(err) ?? '';
  if (status === 1 || /network|offline|fetch|abort|timeout|connection/.test(code)) {
    return 'Could not reach the moderation service. Check your connection and try again.';
  }
  if (code === 'not_found' || /not.?found|missing/.test(code)) {
    return 'That moderation record is no longer available.';
  }
  return fallback;
}

export function describeAppealError(err: unknown): string {
  const code = errorCode(err) ?? '';
  if (/alreadyappealed/.test(code)) {
    return 'This decision has already been appealed.';
  }
  if (/appealwindowexpired/.test(code)) {
    return 'The appeal window has closed.';
  }
  if (/notappealable/.test(code)) {
    return 'This decision can no longer be appealed.';
  }
  if (/invalidappealsubject/.test(code)) {
    return 'This content could not be appealed. Reload the notice and try again.';
  }
  if (isAuthFailure(err)) {
    return 'Your session needs renewing before it can submit an appeal. Sign out, sign in again, and retry.';
  }
  return describeInboxError(
    err,
    'Could not submit the appeal. Your explanation is still here; try again.'
  );
}

export function useModerationInboxUnread() {
  const [unreadCounts, setUnreadCounts] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const counts = await getInboxUnreadCount();
      setUnreadCounts(counts);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { unreadCounts, loading, error, refresh };
}
