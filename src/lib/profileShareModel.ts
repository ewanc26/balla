/**
 * Framework-free rules for the public profile URL used by the profile menu.
 * The official client links to bsky.app; Balla uses the same canonical shape so
 * a copied link works in any browser, including outside Balla. The origin lives
 * with the other official web links in serviceHosts.ts (#97).
 */
import { BLUESKY_WEB } from './serviceHosts.ts';

export function buildProfileShareUrl(profile: any): string | null {
  const handle =
    typeof profile?.handle === 'string' ? profile.handle.trim() : '';
  const did = typeof profile?.did === 'string' ? profile.did.trim() : '';
  const actor = handle || did;
  return actor ? BLUESKY_WEB.profile(actor) : null;
}

export function profileShareText(profile: any): string {
  const handle =
    typeof profile?.handle === 'string' ? profile.handle.trim() : '';
  return handle
    ? `Follow @${handle} on Bluesky`
    : 'View this profile on Bluesky';
}
