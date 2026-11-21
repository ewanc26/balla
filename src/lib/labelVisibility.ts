import type { ModerationCause, ModerationUI } from '@atproto/api';

/**
 * Bluesky's moderation API only sets `filter` for a label whose preference is
 * `hide`. `blur` and `alert` are `warn`: they must show a warning card, not
 * conceal the account. Keeping the decision here stops either surface from
 * inventing its own hide rule.
 */
export function hiddenByLabel(ui: ModerationUI | null | undefined): boolean {
  return !!ui?.filter;
}

export function warnedByLabel(...uis: (ModerationUI | null | undefined)[]): boolean {
  return uis.some((ui) => !!ui?.blur || !!ui?.alert);
}

/** Warnings shown beside an identity must come from account/profile labels. */
export function accountLabelCauses(
  causes: ModerationCause[] | undefined
): ModerationCause[] {
  return (causes || []).filter(
    (cause) =>
      cause.type === 'label' &&
      (cause.target === 'account' || cause.target === 'profile')
  );
}
