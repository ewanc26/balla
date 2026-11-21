/**
 * Framework-free report rules. Kept free of React Native and agent imports so
 * the categories and the local receipt format can be tested under Node.
 */

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
export type ReportSubjectKind = 'post' | 'profile' | 'list';

/** A local-only reminder of a report the moderation service accepted. */
export type ReportReceipt = {
  id: number;
  createdAt: string;
  reasonType: string;
  subjectKind: ReportSubjectKind;
  subjectLabel: string;
  subjectUri?: string;
};

export const REPORT_RECEIPT_KEY = 'balla.report.receipts.v1';

/** Receipts are a convenience, not a moderation archive; keep them bounded. */
export const MAX_REPORT_RECEIPTS = 50;

const SUBJECT_KINDS: ReportSubjectKind[] = ['post', 'profile', 'list'];

export function reasonLabel(reasonType: string): string {
  return (
    REPORT_REASONS.find((item: { value: string }) => item.value === reasonType)
      ?.label || 'Report'
  );
}

function isReceipt(value: unknown): value is ReportReceipt {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'number' &&
    Number.isFinite(item.id) &&
    typeof item.createdAt === 'string' &&
    typeof item.reasonType === 'string' &&
    SUBJECT_KINDS.includes(item.subjectKind as ReportSubjectKind) &&
    typeof item.subjectLabel === 'string' &&
    item.subjectLabel.trim().length > 0
  );
}

/** Drop malformed or stale stored entries instead of rendering them as truth. */
export function normaliseReceipts(value: unknown): ReportReceipt[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  return value
    .filter(isReceipt)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, MAX_REPORT_RECEIPTS)
    .map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      reasonType: item.reasonType,
      subjectKind: item.subjectKind,
      subjectLabel: item.subjectLabel.trim(),
      ...(typeof item.subjectUri === 'string'
        ? { subjectUri: item.subjectUri }
        : {}),
    }));
}

/** Newest first, with the same bounded cap used when reading storage. */
export function appendReceipt(
  receipts: ReportReceipt[],
  receipt: ReportReceipt
): ReportReceipt[] {
  return normaliseReceipts([receipt, ...receipts]);
}
