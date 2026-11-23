/**
 * Framework-free rules for the public profile URL used by the profile menu.
 * The official client links to bsky.app; Balla uses the same canonical shape so
 * a copied link works in any browser, including outside Balla.
 */
export function buildProfileShareUrl(profile: any): string | null {
  const handle =
    typeof profile?.handle === 'string' ? profile.handle.trim() : '';
  const did = typeof profile?.did === 'string' ? profile.did.trim() : '';
  const actor = handle || did;
  return actor ? `https://bsky.app/profile/${actor}` : null;
}

export function profileShareText(profile: any): string {
  const handle =
    typeof profile?.handle === 'string' ? profile.handle.trim() : '';
  return handle
    ? `Follow @${handle} on Bluesky`
    : 'View this profile on Bluesky';
}
