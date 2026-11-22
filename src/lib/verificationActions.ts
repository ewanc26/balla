/**
 * Verifier actions backed by published AT Protocol repo writes. A trusted
 * verifier issues a `app.bsky.graph.verification` record in their own repo and
 * deletes that same record to remove it. No state is faked locally.
 */
import { agent } from './agent';
import {
  canVerifyProfile,
  issuedVerificationUris,
  recordKeyFromUri,
  verificationRecord,
  VERIFICATION_COLLECTION,
} from './verificationActionsModel';

export {
  canVerifyProfile,
  issuedVerificationUris,
  viewerIsVerifier,
  VERIFICATION_COLLECTION,
} from './verificationActionsModel';

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

/**
 * Issue a verification only when the signed-in account currently has the
 * verifier role, as reported by its own profile. The record is written to the
 * verifier's own repo with the subject's current DID and handle.
 */
export async function issueVerificationAsViewer(
  viewerProfile: any,
  targetProfile: any
): Promise<void> {
  const did = signedInDid();
  if (!canVerifyProfile(viewerProfile, targetProfile?.did)) {
    throw new Error('Only trusted verifiers can verify other accounts.');
  }
  const record = verificationRecord(targetProfile, new Date().toISOString());
  if (!record) throw new Error('This profile has no usable handle.');
  await agent.com.atproto.repo.createRecord({
    repo: did,
    collection: VERIFICATION_COLLECTION,
    record,
  });
}

/** Remove every verification the signed-in verifier issued to this profile. */
export async function removeMyVerification(targetProfile: any): Promise<void> {
  const did = signedInDid();
  const uris = issuedVerificationUris(targetProfile, did);
  if (!uris.length) throw new Error('You have not verified this account.');
  await Promise.all(
    uris.map((uri) => {
      const rkey = recordKeyFromUri(uri);
      if (!rkey) throw new Error('A verification record has no usable address.');
      return agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection: VERIFICATION_COLLECTION,
        rkey,
      });
    })
  );
}
