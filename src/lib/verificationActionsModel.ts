/**
 * Framework-free rules for verifier actions. Trusted verifiers can issue or
 * remove `app.bsky.graph.verification` records, exactly as the official client
 * does. Every record and URI rule lives here so it can be tested without a
 * renderer or an agent.
 */

export const VERIFICATION_COLLECTION = 'app.bsky.graph.verification';

/** The official client treats both valid and invalid verifier status as the verifier role. */
export function viewerIsVerifier(viewerProfile: any): boolean {
  const status = viewerProfile?.verification?.trustedVerifierStatus;
  return status === 'valid' || status === 'invalid';
}

/** A viewer cannot verify their own account. */
export function canVerifyProfile(viewerProfile: any, targetDid: string | undefined): boolean {
  if (!viewerIsVerifier(viewerProfile)) return false;
  if (!targetDid || targetDid === viewerProfile?.did) return false;
  return true;
}

/** The verification records the viewer has already issued to this profile. */
export function issuedVerificationUris(targetProfile: any, viewerDid: string): string[] {
  const views = targetProfile?.verification?.verifications;
  if (!Array.isArray(views)) return [];
  return views
    .filter((v: any) => v && v.issuer === viewerDid && typeof v.uri === 'string')
    .map((v: any) => v.uri as string);
}

/** Build the published verification record for a profile as it is right now. */
export function verificationRecord(
  targetProfile: any,
  createdAt: string
): { $type: typeof VERIFICATION_COLLECTION; subject: string; handle: string; displayName: string; createdAt: string } | null {
  const subject = targetProfile?.did;
  const handle = targetProfile?.handle;
  if (typeof subject !== 'string' || !subject.startsWith('did:')) return null;
  if (typeof handle !== 'string' || !handle) return null;
  return {
    $type: VERIFICATION_COLLECTION,
    subject,
    handle,
    displayName:
      typeof targetProfile.displayName === 'string' ? targetProfile.displayName : '',
    createdAt,
  };
}

/** Extract a record key from an AT-URI so a verification can be deleted. */
export function recordKeyFromUri(uri: string): string | null {
  if (typeof uri !== 'string' || !uri.startsWith('at://')) return null;
  const key = uri.split('/').pop();
  return key && key.length > 0 ? key : null;
}
