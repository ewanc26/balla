/**
 * Live status writes against the account's own repo. The official client
 * stores a single `app.bsky.actor.status` record at rkey `self`, upserted with
 * `swapRecord` so a second device cannot silently overwrite a newer status.
 */
import { agent } from './agent';
import {
  DEFAULT_DURATION_MINUTES,
  LIVE_STATUS,
  STATUS_COLLECTION,
  STATUS_RKEY,
  displayDuration,
  expiresAtFor,
  liveStatusRecord,
  statusIsActive,
} from './liveStatusModel';

export {
  DEFAULT_DURATION_MINUTES,
  DURATION_MINUTES,
  LIVE_STATUS,
  STATUS_COLLECTION,
  STATUS_RKEY,
  displayDuration,
  expiresAtFor,
  liveLinkFromStatus,
  normaliseLiveLink,
  statusIsActive,
} from './liveStatusModel';

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

/** Read the signed-in account's own status record and its CID, if present. */
export async function loadMyLiveStatus(): Promise<{ value: any; cid?: string } | null> {
  const repo = signedInDid();
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo,
      collection: STATUS_COLLECTION,
      rkey: STATUS_RKEY,
    });
    return { value: res.data.value, cid: res.data.cid };
  } catch {
    // No record is the normal case before the first Go Live.
    return null;
  }
}

/**
 * Publish or update the live status. A `swapRecord` of null means "must not
 * already exist"; the official client retries on InvalidSwap so a stale read
 * from another device is resolved by fetching the current CID and retrying.
 */
export async function upsertLiveStatus(
  link: string | undefined,
  durationMinutes: number = DEFAULT_DURATION_MINUTES
): Promise<void> {
  const repo = signedInDid();
  const createdAt = new Date().toISOString();
  const record = liveStatusRecord(link, durationMinutes, createdAt);
  if (!record) throw new Error('Could not build a live status record.');

  for (let attempt = 0; attempt < 5; attempt++) {
    let swapRecord: string | null = null;
    try {
      const existing = await agent.com.atproto.repo.getRecord({
        repo,
        collection: STATUS_COLLECTION,
        rkey: STATUS_RKEY,
      });
      swapRecord = existing.data.cid || null;
    } catch {
      swapRecord = null;
    }

    try {
      await agent.com.atproto.repo.putRecord({
        repo,
        collection: STATUS_COLLECTION,
        rkey: STATUS_RKEY,
        record,
        // The lexicon allows null ("must not exist"); the record helper type
        // only allows string | undefined, so the cast is deliberate.
        swapRecord,
      } as any);
      return;
    } catch (err: any) {
      const message = String(err?.message || err?.error || err || '');
      if (!/InvalidSwap/i.test(message)) throw err;
      // A newer status exists; re-read its CID on the next attempt.
    }
  }
  throw new Error('This live status changed on another device. Try again.');
}

/** End the live status by deleting the `self` record. */
export async function endLiveStatus(): Promise<void> {
  const repo = signedInDid();
  try {
    await agent.com.atproto.repo.deleteRecord({
      repo,
      collection: STATUS_COLLECTION,
      rkey: STATUS_RKEY,
    });
  } catch (err: any) {
    // A missing record already means the status is over.
    const message = String(err?.message || err?.error || err || '');
    if (!/NotFound|Could not find|RecordNotFound/i.test(message)) throw err;
  }
}

export { STATUS_COLLECTION as COLLECTION, STATUS_RKEY as RKEY };
