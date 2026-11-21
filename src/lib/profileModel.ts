/**
 * Derivations from `app.bsky.actor.defs#profileViewDetailed` that the profile
 * UI needs. Kept framework-free so the badge rules, counts and pinned-post
 * handling can be tested without a renderer, and so no screen re-implements
 * its own reading of the lexicon.
 */

export type VerificationSummary = {
  /** `verifiedStatus === 'valid'`: a check badge can be shown. */
  verified: boolean;
  /** `trustedVerifierStatus === 'valid'`: a verifier badge can be shown. */
  verifier: boolean;
  /** Valid verifications, one per issuer, in the order the AppView sent them. */
  verifiers: Array<{
    did: string;
    name: string;
    handle: string;
    uri: string;
    createdAt: string;
  }>;
};

export function profileVerification(profile: any): VerificationSummary {
  const state = profile?.verification;
  const seen = new Set<string>();
  const verifiers: VerificationSummary['verifiers'] = [];

  for (const item of Array.isArray(state?.verifications) ? state.verifications : []) {
    if (!item || item.isValid === false) continue;
    if (typeof item.issuer !== 'string' || !item.issuer) continue;
    if (seen.has(item.issuer)) continue;
    seen.add(item.issuer);
    verifiers.push({
      did: item.issuer,
      name: String(item.issuerDisplayName || item.issuerHandle || item.issuer).trim(),
      handle: typeof item.issuerHandle === 'string' ? item.issuerHandle : '',
      uri: typeof item.uri === 'string' ? item.uri : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    });
  }

  return {
    verified: state?.verifiedStatus === 'valid',
    verifier: state?.trustedVerifierStatus === 'valid',
    verifiers,
  };
}

/** Copy shared by the badge's accessibility label and the details sheet. */
export function verificationBadgeLabel(summary: VerificationSummary): string {
  if (summary.verified && summary.verifier) {
    return 'Verified account and trusted verifier';
  }
  if (summary.verified) return 'Verified account';
  if (summary.verifier) return 'Trusted verifier';
  return '';
}

export function profileIsLabeler(profile: any): boolean {
  return profile?.associated?.labeler === true;
}

export function profileAssociatedCounts(profile: any): {
  lists: number;
  feeds: number;
  starterPacks: number;
} {
  const associated = profile?.associated || {};
  const count = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 0;
  return {
    lists: count(associated.lists),
    feeds: count(associated.feedgens),
    starterPacks: count(associated.starterPacks),
  };
}

/** Only a real AT-URI is worth a follow-up `getPosts` call. */
export function profilePinnedUri(profile: any): string | undefined {
  const uri = profile?.pinnedPost?.uri;
  return typeof uri === 'string' && uri.startsWith('at://') ? uri : undefined;
}
