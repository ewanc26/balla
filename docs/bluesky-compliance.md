# Bluesky client compliance

Research date: **20 November 2026**. Implementation update: **23 November 2026**.

This is an engineering research note, not a claim of certification. Bluesky does
not run a general client certification programme. The Facebook-era concept map
that pairs each surface with its AT Protocol concept is maintained separately in
[docs/facebook-translation.md](facebook-translation.md) and tracked in
[issue #149](https://github.com/ewanc26/balla/issues/149). “Fully compliant”
here means three separate things that can each be tested:

1. **Protocol correctness** — AT Protocol lexicons, OAuth, DPoP, service routing,
   pagination and error handling.
2. **Bluesky Developer Guidelines** — the rules for communicating with Bluesky
   services, including reporting, blocking, deletion, report handling, a public
   monitored contact and reasonable security.
3. **User-protection compliance** — labels and content warnings, privacy,
   account/content deletion, store policies and accessibility.

Balla is not yet fully compliant. The gap is not primarily visual: the remaining
pieces are list/feed reporting, label handling on feed surfaces, chat moderation
and the remaining settings. Post-level reporting, muting, blocking, deletion,
quoting, image, video and GIF posts, lists, the moderation inbox and private
messages are now shipped. This document records the bar and the order in which
to close the rest.

## Current Balla coverage

| Surface | Current state | Compliance note |
| --- | --- | --- |
| OAuth | OAuth-only login through `@atproto/oauth-client-expo`; DPoP-bound tokens; no app passwords; granular repo, AppView, video-service, caption-blob and chat-service RPC scopes; multi-account sessions stored separately by DID with a DID/handle-only local registry and an account-keyed UI remount on switch | Sessions predating the video, chat or 0.20.0 scopes must re-authorise |
| Client identity | `oauth-client-metadata.json`; native callback `click.croft.balla:/oauth-callback`; site deployment | Metadata must resolve at the exact `client_id` URL |
| Home feed | Chronological Following first, a visible feed switcher for saved feeds, pagination, pull-to-refresh, and "show more/less like this" feedback sent to custom generators through `app.bsky.feed.sendInteractions` on the `bsky_fg` proxy with `feedContext` and `reqId` preserved | Following stays unranked; custom generator order is labelled and never injected |
| Threads | Ancestor chain, nested replies, reply composer, reply/quote gates read from real threadgate and postgate records, hidden replies in an expandable section driven by the threadgate `hiddenReplies` field, thread mute/unmute through the graph service, quote detach/reattach through the postgate `detachedEmbeddingUris` field, and device-local "hide post/reply for me" merged into moderation prefs | The root author can hide/unhide a reply for everyone; only that author sees the hidden section |
| Profiles | Public profile view with Posts/Replies/Media/Videos/Likes tabs backed by real author-feed filters and `getActorLikes`, follow/unfollow, counts, follower/following/known-follower lists, post likes/reposts/quotes lists, authored lists/feeds/starter packs, label warnings, verification and trusted-verifier badges with their AppView records, pin/unpin from the post menu, verifier-role issue/remove verification writes through `app.bsky.graph.verification`, temporary live status through the `app.bsky.actor.status` record at rkey `self` with a LIVE profile indicator, report/block/mute actions, repost-only mute, profile share/copy-link controls, reportable profile links, and editing of name, bio, pronouns, links, avatar and banner. Feed generators and labelers can be liked/unliked through `app.bsky.feed.like` with a real "Liked by" list. Starter packs have explicit follow, add-feed and share actions, plus creation, editing and deletion for packs the signed-in account owns | Verification writes are limited to trusted verifiers acting on another account; starter-pack writes need one narrow scope and re-authorisation for older sessions |
| Search | Top/Latest/People/Feeds/Starter Packs, structured include/exclude filters, persisted local history, in-app feed/starter-pack destinations, and account-scoped post search from a profile | Scoped search uses the same `searchPostsV2.authors` filter as structured `from` |
| Notifications | Tabs, grouped activity, unread count, mark-all-read and a real per-category settings route with in-app/push switches and audience filters; per-account activity subscriptions through the published `listActivitySubscriptions` and `putActivitySubscription` RPCs, with a bell on profiles and a management list in settings | No device push registration yet (#36) |
| Saved | Private Bluesky bookmarks, remove in place | Uses AppView bookmark stash; good privacy model |
| Media | Profile photo/banner upload; post photos with up to 10 images, alt text, previews, compression, retries, full-screen viewer, record-with-media quotes and label warnings; MP4/GIF video posts through `video.bsky.app`, published video views and WebVTT captions; Advanced → Media reads the grant-bound service's live `getUploadLimits` fields and uses them in the upload pre-flight | Balla's 100 MB / 10-minute local limits are separate from the service quota; alternative side-car switching and non-Bluesky playback remain open in #102 |
| Composer | Rich-text facets for links, mentions and hashtags, multi-post threads, link cards, quotes, per-photo and per-video alt text, self-applied content warnings from the Bluesky vocabulary, up to three post languages, local draft recovery plus account drafts in the official private AppView stash (`app.bsky.draft.*`), reply/quote gate records written after publishing, list rules chosen from a real list picker, inline mention suggestions from the existing `app.bsky.actor.searchActors` call, thread replies that write the same facets and use the same picker, and live 300-grapheme and 3,000-byte counters on both composers | Older OAuth sessions need one re-authorisation for the list scope; mention suggestions add no scope |
| Moderation | Post/profile/profile-link/list/feed report, block/unblock, full and repost-only mute, label warnings with labeler attribution, labeler subscriptions, per-label filters, adult-content gate, muted words with a post-menu shortcut into the visible section, arbitrary third-party labeler DIDs verified against the AppView or their own public label endpoint, a moderation inbox for reports, decisions, notices, account standing, action history and appeals, a blocked/muted-account manager, and hidden replies through the threadgate field | Device push for inbox outcomes remains blocked (#36); public label queries do not report queue lag or service-side mute state |
| Deletion | Post deletion from the overflow menu; account/data screen explains export, deactivation and permanent deletion and links to the PDS controls | Account-level actions are PDS operations and stay outside the client |
| Account portability | Advanced → Account → Move to another PDS is a read-only migration pre-flight: current account facts, public OpenPDS destination filtering, real `describeServer` checks, a local preferences JSON export and links to goat, PDS MOOVER and the authoritative guides | Full migration needs ungranted account, repo, blob, PLC and activation operations; Balla shows no move button and does not pretend a migration happened (#104, partial) |
| Community lexicons | Standard.site articles open in-app with verified publication records and readable blocks; the reader can check social signals from followed accounts by reading exact `site.standard.graph.*` and Leaflet equivalents from those accounts' public PDSs | Bounded to the first 20 follows and one page per collection; no subscription/recommend writes without new grants, and full Markdown/Leaflet parity remains open (#101, partial) |
| Lists/feeds | Saved and pinned custom feeds plus pinnable curation list feeds; curation and moderation lists with create/edit, membership, list feeds, subscribe/block states, profile links and list/feed reports | The AppView has no global list-search endpoint |
| DMs | Inbox, real unread counts and join-request counts, chat requests, paginated messages with replies and reactions, text and post-embed sends, "Send via direct message" from the post menu into a recent chat or a new 1:1 (post carried as an `app.bsky.embed.record` strong ref), group creation, members, invite links and join requests, conversation settings with lock/unlock, mark-all-read, mute/unmute and leave, report/message and actor block, plus chat notification preferences, all through the chat-service proxy. Group bubbles and reply banners name senders from real profiles already returned with message pages; an unknown sender stays unnamed. Group rows use the group name initial, and join-request rows use the owner, not an arbitrary member | Built on narrow `chat.bsky.convo.*`, `chat.bsky.group.*` and `chat.bsky.notification.*` RPCs; the full membership roster is available from a visible Participants button in the conversation and in conversation settings, and device push delivery remains blocked (#36) |
| Network backend seam | Advanced → Backend shows one registered AT Protocol adapter and a typed nine-verb contract. Home feed, thread hydration, notifications/follow reads, profile/tab reads and Search/Discovery reads consume the seam through the current Agent binding; retry, pagination and copy are unchanged | Partial #98: session, compose/reply, media and moderation screen calls are still direct, so this is not a completed migration, second backend, bridge or identity-mapping tool |
| Service reachability | Advanced → Services runs real unauthenticated public checks for the resolver, AppView, chat, video and labeler slots, reporting HTTP status and latency from this device without reading provider message text. The labeler test reuses `labelerProbe.ts` to resolve the DID document and issue one public label query; Content filters probes each subscribed labeler the same way | Partial #97: these are read-only checks, not a provider picker, failover or a repointed grant-bound audience; video endpoint reachability does not measure quota, which needs a sign-in token, and labeler reachability does not change which labels Balla applies |
| Public handle resolution | Sign-in and account pre-flight use a native-first resolver: the handle's own `/.well-known/atproto-did` is read first, then the configured, persisted XRPC endpoint is used as fallback. The in-app handle→DID fallback used when the AppView cannot serve a profile now uses that same resolver, so a saved host applies without a restart or a new sign-in. DID documents use one shared `did:web` document URL builder beside the host facts, derived from the same identifiers used by the service checks | Partial #97: this is a token-free public read path, not provider failover or a grant change. AppView, chat, video and labeler remain grant-bound and the PDS stays DID-discovered |
| Places provider | Advanced → Services can change the public places host used for typed search or switch the search off entirely. The saved off state stops the Services check and the composer's Search button, keeps the configured host, clears results already on screen in an open sheet, and is included in the configuration export. When it is on, the test performs one token-free `POST /v1/search` with a fixed word, checks the structured results and reports HTTP status and latency. The composer adds a visible typed place-name picker: the person presses Search, only `q` and `limit` are sent, and a picked name is inserted as plain text at the cursor with a visible control to use the typed name directly. Each result has a visible 44pt map button that opens an OpenStreetMap name search in the browser; the copy says it searches by name, is not an exact match and sends no position, and one shared builder serves Events too. One shared fail-closed places-host label is used by the composer sheet and Advanced → Services: a valid https origin is shown with the same wording on both surfaces, an invalid saved value is stated as invalid and never echoed on either surface, and an off state says the host is configured but unused. Each result's secondary line comes from one `placeResultDetail()` rule using the provider's published fields: an area the provider marks `cityState` is labelled City, a result found through another name says which name matched, and an approximate match says so. Rank, popularity, distance and check-in counts stay discarded, and same-named results keep distinct rows. The result's visible 44pt info button opens a detail view inside the same sheet, showing only the structured fields the provider published: type, category, group, subtype, provider class, country, matched name, match kind and the validated ATGeo place ID. Absent fields are omitted; coordinates, check-in counts, rank, popularity and provider prose never reach it. The detail view reuses one `placeRecordUrl()` rule for a public `org.atgeo.getPlace` browser link from the validated host and `origin` URN, and one `openStreetMapSearchUrl()` rule for a name-only OpenStreetMap search; a result with no valid URN gets no record link, and Balla makes no request for either link. A browser-open failure uses fixed copy in Balla's words. A visible 44pt Copy place ID control writes only the already-validated ATGeo URN to the device clipboard; a result with no valid ID gets no button, and success or clipboard failure uses fixed copy in Balla's words. Escape and the visible Back to results control step back from the detail view to the results before the picker closes; the shared dialog hook keeps the latest handler so focus is not lost or remounted. Android hardware back and the Apple TV menu button use the same step-back handler through `onRequestClose`, so one press returns from details to results and a second closes the picker. In the detail view, backdrop taps and the header close control use the same step-back handler, so neither closes the picker before returning to results. No latitude, longitude, accuracy or nearby lookup; response coordinates and check-in counts are discarded during parsing. Unknown providers fail closed with fixed copy in Balla's words | Partial #156: no granularity choice, check-in record, place chip or per-media location. The map button is a browser link-out, not an in-app map or an exact-place claim. The `social.eurosky.place.pin` record is an unsettled draft, so Balla writes no place records and makes no claim of ATGeo interoperability yet |
| Media fallback | When a post image or video cannot be shown from the AppView CDN, Balla resolves the author's DID document and reads the blob directly from the PDS. That resolution now uses the same strategy-aware resolver as profiles: configured did:plc directory, `did:web`, then the PDS in strategy order, with the on-device cache and DID validation kept | Partial #97: a token-free public read path, not provider failover or a grant change. Blob bytes still come from the author's PDS, and a cached DID document wins under the default `auto` strategy |
| Configuration export | Advanced → Services exports the effective handle resolver, the effective did:plc directory, whether each is still the compiled default, all default service DIDs/audiences and non-secret session metadata through a local-only file download or clipboard copy. Default hosts live in one auditable module | Partial #97: not a second backend and not a provider picker; grant-bound audiences still need a new authorisation, and the export is a record, not an import or a credential |
| Identity directory | Advanced → Services can change the public did:plc directory used for `did:plc` DID documents. The saved https origin is reversible with one tap, takes effect on the next read without a restart, and is honoured by both identity resolution and account pre-flight. A change forgets cached `did:plc` documents so already-seen identities are re-read from the new host; handle mappings and `did:web` documents survive. A public canary read checks a known DID document's structured `id` field | Partial #97: this is a token-free public read host, distinct from the handle resolver and from grant-bound services. A directory that cannot serve known `did:plc` identities makes those lookups fail until the default is restored; `did:web` identities are unaffected. No new scope and no grant change |
| Login pre-flight | The login screen can run the same public identity, PDS and OAuth metadata check before sign-in, showing the resolved DID, PDS, authorization server and a count of advertised OAuth capabilities without reading provider prose | Partial #100: a pre-login check on the login screen is not a verified independent-PDS login, a grant or an account creation; OAuth metadata is unchanged |
| Account pre-flight | Advanced → Account pre-flight resolves a handle or DID through its own well-known file or the public resolver, reads the DID document's `#atproto_pds`, then checks public `describeServer`, protected-resource and authorization-server metadata before sign-in. It classifies ten published OAuth capability fields Balla's public client needs and names any that are missing using fixed labels | Partial #100: no end-to-end login with an independent account has been verified, no app-password flow is offered, and passing these public checks is not a grant or an account creation; advertised fields are not a promise that the approval page will succeed |
| AppView health | Advanced → AppView shows the grant-bound AppView DID and audience, lists it as the timeline hydration source, resolves its advertised endpoint from the public `did:web` document and runs an unauthenticated document and profile canary, reporting HTTP status and latency from this device. The Home feed no longer repeats a hydration-source banner | Partial #99: no failover, primary/mirror picker or per-function routing. The hydration source is a fixed grant fact, not a live check, failover status or freshness claim; these reads expose no sync lag or feed freshness, and changing the audience needs a new OAuth grant |
| Settings | Settings shell with account, privacy/security, session, moderation, notifications, content filters, appearance, accessibility, language, feed/thread, help, legal, about and sign-out routes. Birthday, automation and logged-out visibility use real profile/personal-details writes; session facts are read from non-secret OAuth metadata. Verification badges, default post interaction settings and interests edit real account preferences; blocked/muted accounts are managed from a dedicated screen. Activity privacy writes the published `app.bsky.notification.declaration` record. Account, privacy/security and lifecycle link-outs read the signed-in session's `resourceServer`: only a `bsky.social` session opens the canonical `bsky.app` panel, and every other provider gets a fixed message with no inferred address rather than a wrong link | Partial #97: no new URL, request, setting or grant change, and other providers still need their own control panel. Email, password, 2FA, app passwords, account lifecycle and push delivery remain provider-owned or ungranted, and are never faked |
| Support/legal | In-app Help, privacy, terms, community guidelines, copyright, contact and about pages; matching public site pages | Monitored public contact is the GitHub issue tracker and private advisory form |
| Native app icon | Light/Dark icon choices in Settings, written through the OS with the current icon read back on focus; generated assets and an Expo config plugin bake the Dark variant, and Android confirms the restart | The Bluesky+ "core" icon set is an internal experiment and is excluded. A new icon only appears in a rebuilt native binary; the web screen explains this instead of throwing like the official client |
| Web | Expo web client at `/app`; popup OAuth returns to the same URL | Browser sessions use IndexedDB; the same client metadata covers native and web redirects |

## The hard requirements

### Bluesky Developer Guidelines

The current guidelines require apps with user-generated content or social
networking features to provide:

- a method to **report illegal content**;
- a method for **blocking forbidden content from being shared** in the app;
- a method for **blocking abusive users**;
- a method for **deleting content a user has requested to be deleted**;
- a system for **responding to all user reports**;
- **updated public contact information, including a regularly monitored email**;
- reasonable **security** for user data and app data;
- no automated or bulk interactions, follower generation, spam or spambots.

The guidelines also say developers should keep records of reports and responses,
and that failure to respond to known violations can lead to suspension of access
to Bluesky infrastructure. These are release blockers, not polish.

### OAuth and client metadata

The AT Protocol OAuth profile requires DPoP. Balla’s SDK handles PKCE, PAR, DPoP
and refresh. The metadata must keep:

- `client_id` exactly equal to the URL serving the JSON;
- `redirect_uris` containing the native custom scheme, with exactly one slash
  after the scheme, and the web callback `https://balla.croft.click/app`;
- `application_type: "native"`;
- `grant_types` including `authorization_code` and, because the client refreshes,
  `refresh_token`;
- `response_types: ["code"]`;
- `dpop_bound_access_tokens: true`;
- a scope that covers every permission the app can request.

The scope is now least-privilege rather than a wildcard: seven repository
collections (`post`, `like`, `repost`, `follow`, `block`, `profile`, `link`) with
only the actions Balla uses, explicit AppView RPC methods, a separate audience
for `com.atproto.moderation.createReport`, narrow `rpc:chat.bsky.convo.*`,
`rpc:chat.bsky.group.*` and `rpc:chat.bsky.notification.*` scopes against the
chat-service audience, and only `blob:image/jpeg` for the profile
photo and banner upload path. There is no `repo:*`, no `rpc:*`, no `blob:*/*` and
no broad chat permission set. `docs/oauth-scopes.md` is the source of truth.

### Labels and moderation

Moderation in the Atmosphere is layered: network takedowns, labels from labelers,
and user controls such as mutes and blocks. A client that renders posts must:

- subscribe to the Bluesky moderation labeler by default, and respect the user’s
  subscribed labelers;
- send `atproto-accept-labelers` and hydrate labels into post, profile and
  notification views;
- honour `!hide` (not click-through), `!warn` (click-through warning),
  `!no-unauthenticated`, and custom definitions’ `blurs`, `severity`,
  `defaultSetting` and `adultOnly` fields;
- apply content/media blurring and labels before rendering, not after the user
  has already seen the content;
- provide report, block and mute controls on posts and profiles;
- send reports to the selected labeler via
  `com.atproto.moderation.createReport`, with the correct service audience;
- handle labels on accounts, profiles, posts, lists and feeds.

The AppView only includes labels from the labelers the client asks for. Merely
displaying `post.labels` without configuring labelers is not moderation.

### Deletion and account lifecycle

Every create action needs a matching delete path:

- posts and replies: `com.atproto.repo.deleteRecord`;
- likes, reposts and follows: delete the corresponding record;
- profile fields and list memberships: update/delete the records;
- account deletion and data export: at minimum, link to the PDS/Bluesky account
  controls and explain the limits of a client-side deletion;
- sign-out: revoke the OAuth session and clear the local session.

Deletion must remove the record from the user’s PDS; hiding it locally is not
deletion.

### Media, quotes and composition

To match Bluesky’s composer, Balla eventually needs:

- **Done:** image upload through `com.atproto.repo.uploadBlob`, one-to-ten
  images, alt text, media dimensions, compression and failure/retry UI;
- **Done:** MP4 and animated GIF upload through `app.bsky.video.uploadVideo`, with a service auth token for the upload and honest polling of `app.bsky.video.getJobStatus`. The post is not publishable until the job reports `JOB_STATE_COMPLETED` with a blob; failures, cancellation and the optional 409 `already_exists` blob are named rather than treated as success;
- **Done:** `app.bsky.embed.video` embeds with alt text, aspect ratio, the published `presentation: 'gif'` hint and up to 20 `app.bsky.embed.video#caption` tracks from WebVTT blobs. Published views render the AppView's HLS playlist with native controls and an alt-text caption;
- **Done:** rich-text facets for mentions, links and hashtags, generated by
  the official SDK detector; a mention whose handle does not resolve stays plain
  text instead of being written with an empty DID;
- **Done:** inline composer mention suggestions through the already-authorised
  `app.bsky.actor.searchActors` call, with debounced loading, empty and failure
  states; choosing a result replaces the token and preserves punctuation;
- **Done:** thread replies write the same facets and use the same mention picker
  as new posts, through the shared `postFacets` helper and hook;
- **Done:** quote posts using `app.bsky.embed.record`, including the view in
  cards and threads with the quoted post's own labels and honest unavailable
  states;
- **Done:** external link cards resolved by `app.bsky.embed.getEmbedExternalView`,
  with removal and an honest fallback when Bluesky returns no metadata;
- **Done:** multi-post thread composition with per-post text, photos, quotes or
  link cards, one publish action, and `reply.root`/`reply.parent` chained to the
  first post and its predecessor;
- **Done:** thread and post gates using `app.bsky.feed.threadgate` (mention,
  following, follower and empty-allow rules) and `app.bsky.feed.postgate`
  (`disableRule`), with an editor for your own posts and no invented list URIs;
- **Done:** local drafts saved on the device with an accessible Restore or
  Discard prompt; photos and quotes are not persisted and the prompt says so;
- **Done:** account drafts in the official private AppView stash through the
  published `app.bsky.draft.*` RPCs: save/update from the composer, a Drafts
  sheet to list, reopen and delete, and cleanup after publishing. Text, content
  warnings, languages, interaction rules and quote/link refs survive; media is
  device-bound and is re-picked on load, as in the official client;
- **Done:** honest grapheme counting and posting errors.

List-based gate rules are written from a real list picker: `ReplyListPicker`
loads the account's actual `app.bsky.graph.list` records and an invalid or
invented URI falls back to open replies rather than being written.

### Feeds, lists and discovery

Bluesky’s client surface includes:

- saved and pinned custom feeds, feed discovery and feed generators;
- lists (curation, moderation and block lists), list feeds and list management;
- starter packs;
- hashtag, topic and video pages plus an opt-in Discover surface, all explicit
  user choices and never injected into the Following feed; only Discover is
  ranked, and it says so on the page;
- search results for posts, people, feeds and starter packs;
- language and reply/repost/quote filters.

Balla’s product rule remains: the home feed is chronological Following. Custom
feeds are opt-in destinations, never a replacement algorithm.

### DMs

The chat lexicons (`chat.bsky.convo`, `chat.bsky.group` and
`chat.bsky.notification`) are separate from the AppView. Balla proxies
authenticated chat calls to the chat service with
`withProxy('bsky_chat', 'did:web:api.bsky.chat')` and declares only the narrow
chat RPCs it calls. The inbox and conversation honour unread and join-request
counts, request status, muted and locked conversations and block/disabled-chat
errors. Groups use the real member/join-link methods; owner checks use the full
member list, and owner lock controls hide when moderation or a permanent lock
forbids the change. Chat reports go to the labeler through the open end of the
`createReport` subject union and carry ids only — never message text. Chat
notification preferences are read and written through the chat service and are
separate from AppView notification settings. Message content is not stored by
Balla and is never logged. Device push delivery remains blocked (#36).

## Prioritised roadmap

### P0 — before any public release

1. Report post, profile and list; show report categories; record the report.
   Done: all three subject kinds use
   `com.atproto.moderation.createReport` through the Bluesky labeler proxy,
   with the published reason categories. A successful report saves a bounded,
   local-only receipt (id, reason, subject and time) that is visible in
   Settings; receipts are explicitly not presented as an official status.
2. Block and mute users; hide their content; expose unblock/unmute. Post and
   profile actions, plus filtering across feeds, search, saved posts, threads
   and notifications, are shipped.
3. Honour Bluesky labels and content warnings; subscribe to the default labeler.
   Done: the default labeler is subscribed, custom definitions load, and
   `!hide`/`!warn`/media/profile labels are rendered before content.
4. Delete own posts and replies; delete likes/reposts/follows where applicable.
   Post deletion and in-place undo for likes, reposts and follows are shipped.
5. Publish a monitored public contact and privacy policy; document report
   handling and retention. Done: public policy pages, in-app help/legal pages
   and `docs/report-handling.md` are published; the monitored contact route is
   the issue tracker and private advisory form.
6. Reduce OAuth scopes to the exact collections and RPC methods used. Done:
   see `docs/oauth-scopes.md`; existing sessions need one fresh sign-in.
7. Add rate-limit handling, retry/backoff and clear offline errors. Done:
   `src/lib/reliability.ts` classifies 429, offline, auth-expired and server
   failures, reads retry idempotently with bounded backoff and `Retry-After`,
   optimistic like/repost/bookmark changes roll back, and failed posts,
   replies, deletes and reports stay visible with a retry. Failure messages are
   service-neutral because the helper also covers identity directories and
   third-party hosts. When a service advertises a wait longer than the
   automatic backoff cap, the read stops and the message tells the person to
   wait; Balla never retries earlier than the wait it describes.
8. Complete an accessibility pass: screen reader labels, focus order, Dynamic
   Type and reduced-motion behaviour. Done: shared rules in
   `src/lib/accessibilityModel.ts` and hooks in `src/lib/accessibility.ts`;
   every action, card and dialog is labelled, web dialogs trap focus with a
   visible keyboard ring, text scales without clipping, motion respects the
   system reduced-motion setting, and standalone controls are at least 44pt
   with no gesture-only actions (inline links keep the normal text flow).
   Thread views state their structure explicitly.

### P1 — parity with the main Bluesky surfaces

1. ~~Image/video composer with alt text.~~ Done: photo posts and MP4/GIF video posts both carry alt text, with captions for video.
2. Link cards and quote embeds are shipped, including multi-post composition.
3. Verification and pinned post. Profile editing, followers, following, known
   followers and per-post engagement lists are shipped.
4. Notification preferences route (tabs, grouping and seen state are shipped).
5. Lists, list feeds and list management. Curation and moderation lists,
   membership, list feeds, subscribe/block states, profile links and list/feed
   reports are shipped. Saved/custom feeds, hashtag/topic/video pages and the
   opt-in Discover surface are shipped; curation list feeds can be pinned to Home
   through the published saved-feed preference. Following stays chronological.
6. Settings preference editors for content, language, appearance, privacy and
   account. Content filtering, labelers, adult content and muted words are
   shipped, along with System/Light/Dark, post text size, description badges,
   primary/content languages, Following filters, thread reply order, birthday,
   automation and logged-out visibility self-labels, and non-secret session
   facts. UI translation is not shipped (the interface is English only),
   haptics are not emitted so no toggle is offered, and provider-owned account
   security controls stay on the PDS behind honest links.
7. In-app post deletion and sign-out cleanup.
8. ~~DMs.~~ Done: inbox, unread counts, requests, messages, text/post embeds, reactions, group creation, conversation settings, message/conversation reporting and chat notification preferences. Device push delivery remains blocked (#36).

### P2 — depth and federation

1. ~~Starter packs.~~ Done: search, landing pages, explicit member/feed actions, official sharing and owner-only creation, editing and deletion with one narrow repo scope. Labeler subscriptions, unsubscribe and per-label preferences are written through `app.bsky.actor.putPreferences`.
2. ~~Multi-account support.~~ Done: separate OAuth sessions keyed by DID, labelled switch/add/remove flows, an account-keyed UI remount and honest handling of revoked grants. Account drafts are done through the official `app.bsky.draft.*` AppView RPCs; scheduling remains out of scope as it has no published client API.
3. ~~Rich media (video, GIF, captions, aspect ratios).~~ Done: video-service upload, published video views, GIF presentation, WebVTT captions and real aspect ratios.
4. ~~Web client with the web OAuth callback, or removal of the web redirect.~~
   Done: the Expo app is exported at `/app` and signs in with popup OAuth back
   to that URL.
5. Account migration/export guidance and deeper PDS portability.
6. Independent labeler/reporting integrations.

## Acceptance tests for “compliant”

- A new user can sign in through OAuth on a non-Bsky PDS and sees no password
  field anywhere.
- A labeled post is hidden or warned before its content is rendered; `!hide`
  cannot be clicked through.
- A user can report a post and a profile, and the report reaches the configured
  labeler.
- A blocked user’s posts disappear from feeds, search and notifications, and
  interaction is prevented.
- A muted user’s posts do not appear in feeds or notifications.
- A deleted post is gone after a refresh and from a second client.
- The public privacy/contact page is reachable, and reports have an owner and a
  response process. Done: the in-app and site pages exist, with the issue
  tracker/advisory routes and `docs/report-handling.md`.
- The OAuth consent screen shows a scope no broader than the features the app
  exposes. Done for the current surface: granular collection actions, AppView
  RPCs, moderation-inbox RPCs and narrow chat-service RPCs are declared, with no
  wildcards, no broad chat permission set and only the JPEG blob scope needed for
  profile and post images.
- No analytics, ad or tracking SDK is present.
- The web client at `https://balla.croft.click/app` completes a popup login and
  restores the session after a reload.

## Deployment notes

The OAuth client metadata is served at:

`https://balla.croft.click/oauth-client-metadata.json`

The Vercel project is live at `https://balla.croft.click`, built from `site/`
by `scripts/build-site.mjs`. It serves the landing page, `/privacy`, the Expo
web client at `/app` and the OAuth metadata. The native app uses the
custom-scheme callback; the web app uses `https://balla.croft.click/app` as a
popup redirect. `/oauth-callback` permanently redirects to `/app`.

`client_id` must not be changed without updating the app’s bundled metadata and
the deployed file together. Vercel serves the JSON with HTTP 200 and a JSON
content type. The custom domain, CNAME and Let’s Encrypt certificate were
verified live on 20 November 2026.

The report audience was added to the OAuth scope on 21 November 2026, and the
moderation-inbox audience followed in the same release wave. Sessions authorised
before those changes need one fresh sign-in before `createReport` or the
`tools.ozone.inbox.*` calls will be accepted by the labeler.

## Sources

- Official Bluesky client source snapshot (v1.139.0, commit
  `17393322eec4f22bfb0d07bd27c3d2af1db8d398`):
  <https://github.com/bluesky-social/social-app>; local research clone and
  surface inventory are recorded in `docs/social-app-reference.md`.
- Bluesky Developer Guidelines: <https://bsky.network/docs/developer-guidelines>
- AT Protocol OAuth specification: <https://atproto.com/specs/oauth>
- AT Protocol scopes: <https://atproto.com/guides/scopes>
- Permission requests: <https://atproto.com/guides/permission-requests>
- Labels: <https://atproto.com/guides/labels>
- Labeler subscriptions: <https://atproto.com/guides/subscriptions>
- Moderation: <https://atproto.com/guides/moderation>
- Moderation guide: <https://docs.bsky.app/docs/advanced-guides/moderation>
- API hosts and auth: <https://docs.bsky.app/docs/advanced-guides/api-directory>
- Posts, quotes and embeds: <https://docs.bsky.app/docs/advanced-guides/posts>
- Following, muting and blocking: <https://docs.bsky.app/docs/tutorials/following>
- Muting: <https://docs.bsky.app/docs/tutorials/muting>
- Report-based moderation: <https://atproto.com/blog/report-based-moderation>
- Bluesky 2026 product direction: <https://bsky.social/about/blog/01-26-2026-whats-next-at-bluesky>
- AT Protocol reference implementation: <https://github.com/bluesky-social/atproto>
- Installed `@atproto/api` lexicons (inspected locally for the feature matrix):
  `app.bsky.*`, `chat.bsky.*`, `com.atproto.moderation.*`.
