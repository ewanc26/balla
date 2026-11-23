/**
 * The one place the default AT Protocol host literals live (#97). Everything
 * else derives its defaults from here, so "no Bluesky host outside the config"
 * is auditable with a single source scan. This module has no imports and no
 * platform dependencies: it is facts only, never an editable setting.
 *
 * Grant-bound audiences are written into this sign-in's OAuth grant; showing
 * them is honest, but changing one needs a fresh authorisation. Only the
 * pre-auth resolver has a persisted override (see servicesModel.ts).
 */

export const SERVICE_HOSTS = {
  /** Public XRPC resolver used before sign-in. */
  handleResolver: 'https://bsky.social',
  /** Fallback PDS value; the active account's real PDS comes from its DID document. */
  pds: 'https://bsky.social',
  appviewDid: 'did:web:api.bsky.app',
  appviewAudience: 'did:web:api.bsky.app#bsky_appview',
  chatDid: 'did:web:api.bsky.chat',
  chatAudience: 'did:web:api.bsky.chat#bsky_chat',
  videoService: 'https://video.bsky.app',
  videoAudience: 'did:web:video.bsky.app',
  labelerDid: 'did:plc:ar7c4by46qjdydhdevvrndac',
  labelerAudience: 'did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler',
  plcDirectory: 'https://plc.directory',
} as const;

/** The reader support page (#163), beside the hosts so the URL has one home. */
export const SUPPORT_URL = 'https://ewancroft.uk/support';

/**
 * The creator's public links, kept beside the protocol hosts so no surface
 * invents a second copy. The support page owns its routes: Balla links out and
 * stops, and never hydrates support details from records.
 */
export const CREATOR = {
  name: 'Ewan Croft',
  handle: 'ewancroft.uk',
  site: 'https://ewancroft.uk',
  webProfile: 'https://bsky.app/profile/ewancroft.uk',
  supportUrl: SUPPORT_URL,
} as const;

/** Public DID documents read by the informational service checks. */
export const APPVIEW_DID_DOCUMENT_URL = 'https://api.bsky.app/.well-known/did.json';
export const CHAT_DID_DOCUMENT_URL = 'https://api.bsky.chat/.well-known/did.json';

/** Published video lexicon used by both the quota and reachability checks. */
export const VIDEO_LIMITS_LXM = 'app.bsky.video.getUploadLimits';

/**
 * The public directory URL for a did:plc identifier. `directory` is the
 * configured override when present; it is validated as an https origin here so
 * a persisted value can never turn the path into an off-origin request.
 */
export function plcDocumentUrl(did: string, directory: string = SERVICE_HOSTS.plcDirectory): string | null {
  if (!/^did:plc:[a-z0-9]+$/i.test(did) || !/^https:\/\/[a-z0-9.-]+$/i.test(directory)) return null;
  return `${directory}/${did}`;
}
