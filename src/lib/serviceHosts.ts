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
  pds: 'https://eurosky.social',
  appviewDid: 'did:web:api.eurosky.network',
  appviewAudience: 'did:web:api.eurosky.network#bsky_appview',
  chatDid: 'did:web:api.bsky.chat',
  chatAudience: 'did:web:api.bsky.chat#bsky_chat',
  videoService: 'https://video.bsky.app',
  videoAudience: 'did:web:video.bsky.app',
  labelerDid: 'did:plc:ar7c4by46qjdydhdevvrndac',
  labelerAudience: 'did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler',
  plcDirectory: 'https://plc.directory',
  /** Public places provider for typed search; nearby search needs a device position and is not used. */
  places: 'https://places.eurosky.tech',
} as const;

/**
 * Official Bluesky web links are link-outs, not service endpoints: they are
 * canonical pages for a person post or control panel, and never decide which
 * host Balla calls. Keeping them here (#97) makes every `bsky.app` / `bsky.social`
 * literal auditable in one file without implying that those pages are configurable.
 */
const BLUESKY_WEB_ORIGIN = 'https://bsky.app';
const BLUESKY_SOCIAL_ORIGIN = 'https://bsky.social';

const blueskyProfileUrl = (actor: string) =>
  `${BLUESKY_WEB_ORIGIN}/profile/${actor}`;

export const BLUESKY_WEB = {
  host: 'bsky.app',
  origin: BLUESKY_WEB_ORIGIN,
  accountSettings: `${BLUESKY_WEB_ORIGIN}/settings/account`,
  privacySettings: `${BLUESKY_WEB_ORIGIN}/settings/privacy-and-security`,
  appPasswords: `${BLUESKY_WEB_ORIGIN}/settings/app-passwords`,
  chatSettings: `${BLUESKY_WEB_ORIGIN}/settings/chat`,
  profile: blueskyProfileUrl,
  post: (actor: string, rkey: string) => `${blueskyProfileUrl(actor)}/post/${rkey}`,
  feed: (actor: string, rkey: string) => `${blueskyProfileUrl(actor)}/feed/${rkey}`,
  list: (actor: string, rkey: string) => `${blueskyProfileUrl(actor)}/lists/${rkey}`,
  starterPack: (actor: string, rkey: string) =>
    `${blueskyProfileUrl(actor)}/starter-pack/${rkey}`,
  starterPackShort: (name: string, rkey: string) =>
    `${BLUESKY_WEB_ORIGIN}/start/${name}/${rkey}`,
  chatInvite: (code: string) => `${BLUESKY_WEB_ORIGIN}/chat/${code}`,
} as const;

export const BLUESKY_SOCIAL = {
  host: 'bsky.social',
  origin: BLUESKY_SOCIAL_ORIGIN,
  communityGuidelines: `${BLUESKY_SOCIAL_ORIGIN}/about/support/community-guidelines`,
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
  webProfile: BLUESKY_WEB.profile('ewancroft.uk'),
  supportUrl: SUPPORT_URL,
} as const;

/**
 * The one did:web document URL builder (#97). A did:web identifier maps to an
 * https host with optional path segments; a bare host uses /.well-known. Only
 * the structured identifier is parsed here: no provider prose is read or stored.
 */
export function didWebDocumentUrl(did: string): string | null {
  if (typeof did !== 'string' || !/^did:[a-z]+:[A-Za-z0-9._:%-]+$/i.test(did)) return null;
  if (!did.startsWith('did:web:')) return null;
  try {
    const raw = did.slice('did:web:'.length).replace(/%3A/gi, ':');
    const [host, ...path] = raw.split(':');
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) return null;
    const suffix = path.length ? `/${path.map(encodeURIComponent).join('/')}` : '/.well-known';
    return `https://${host}${suffix}/did.json`;
  } catch {
    return null;
  }
}

function requiredDidWebDocumentUrl(did: string): string {
  const url = didWebDocumentUrl(did);
  // These are compile-time host facts; a malformed one is a build error, not a
  // runtime failure that could be mistaken for an unreachable provider.
  if (!url) throw new Error(`Invalid did:web service host: ${did}`);
  return url;
}

/** Public DID documents read by the informational service checks. */
export const APPVIEW_DID_DOCUMENT_URL = requiredDidWebDocumentUrl(SERVICE_HOSTS.appviewDid);
export const CHAT_DID_DOCUMENT_URL = requiredDidWebDocumentUrl(SERVICE_HOSTS.chatDid);

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
