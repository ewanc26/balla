/**
 * Reads and writes the activity-subscription declaration in the signed-in
 * account's own repo. The official client stores one record at rkey `self`;
 * absence of the record means `followers`.
 */
import { agent } from './agent';
import {
  ALLOW_OPTIONS,
  DECLARATION_COLLECTION,
  DECLARATION_RKEY,
  declarationRecord,
  normaliseAllowSubscriptions,
  type AllowSubscriptions,
} from './activityPrivacyModel';

export {
  ALLOW_OPTIONS,
  DECLARATION_COLLECTION,
  DECLARATION_RKEY,
  declarationRecord,
  normaliseAllowSubscriptions,
  type AllowSubscriptions,
} from './activityPrivacyModel';

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

/** Read the current declaration, defaulting to `followers` when absent. */
export async function loadActivityPrivacy(): Promise<AllowSubscriptions> {
  const repo = signedInDid();
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo,
      collection: DECLARATION_COLLECTION,
      rkey: DECLARATION_RKEY,
    });
    return normaliseAllowSubscriptions((res.data.value as any)?.allowSubscriptions);
  } catch {
    return 'followers';
  }
}

/** Publish the declaration. `putRecord` creates or replaces the `self` record. */
export async function setActivityPrivacy(allow: AllowSubscriptions): Promise<void> {
  const repo = signedInDid();
  await agent.com.atproto.repo.putRecord({
    repo,
    collection: DECLARATION_COLLECTION,
    rkey: DECLARATION_RKEY,
    record: declarationRecord(allow),
  });
}
