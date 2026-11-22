/**
 * Framework-free rules for who may subscribe to your activity. The official
 * client stores this in a single `app.bsky.notification.declaration` record at
 * rkey `self`; absence of the record means `followers`.
 */

export const DECLARATION_COLLECTION = 'app.bsky.notification.declaration';
export const DECLARATION_RKEY = 'self';

export type AllowSubscriptions = 'followers' | 'mutuals' | 'none';

export const ALLOW_OPTIONS: Array<{ value: AllowSubscriptions; label: string; detail: string }> = [
  {
    value: 'followers',
    label: 'Anyone who follows me',
    detail: 'People who follow you can opt in to notifications for your activity.',
  },
  {
    value: 'mutuals',
    label: 'Only followers who I follow',
    detail: 'Only mutual follows can opt in to notifications for your activity.',
  },
  {
    value: 'none',
    label: 'No one',
    detail: 'No one can opt in to notifications for your activity.',
  },
];

/** Normalise a declaration value, falling back to the published default. */
export function normaliseAllowSubscriptions(value: unknown): AllowSubscriptions {
  return value === 'mutuals' || value === 'none' ? value : 'followers';
}

/** Build the published declaration record. */
export function declarationRecord(allow: AllowSubscriptions): Record<string, unknown> {
  return {
    $type: DECLARATION_COLLECTION,
    allowSubscriptions: normaliseAllowSubscriptions(allow),
  };
}
