# Bluesky client compliance

Research date: **20 November 2026**. Implementation update: **22 November 2026**.

This is an engineering research note, not a claim of certification. Bluesky does
not run a general client certification programme. “Fully compliant” here means
three separate things that can each be tested:

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
| OAuth | OAuth-only login through `@atproto/oauth-client-expo`; DPoP-bound tokens; no app passwords; granular repo, AppView, video-service, caption-blob and chat-service RPC scopes; multi-account sessions stored separately by DID with a DID/handle-only local registry and an account-keyed UI remount on switch | Sessions predating the video or chat scopes must re-authorise |
| Client identity | `oauth-client-metadata.json`; native callback `click.croft.balla:/oauth-callback`; site deployment | Metadata must resolve at the exact `client_id` URL |
| Home feed | Chronological Following first, a visible feed switcher for saved feeds, pagination and pull-to-refresh | Following stays unranked; custom generator order is labelled and never injected |
| Threads | Ancestor chain, nested replies, reply composer, and reply/quote gates read from real threadgate and postgate records | Some moderation states remain |
| Profiles | Public profile view, follow/unfollow, counts, follower/following/known-follower lists, post likes/reposts/quotes lists, authored lists/feeds/starter packs, label warnings, verification and trusted-verifier badges with their AppView records, pinned post, report/block/mute actions, and editing of name, bio, pronouns, links, avatar and banner. Starter packs have explicit follow, add-feed and share actions, plus creation/editing for packs the signed-in account owns | Verification is display-only — Balla never issues verifications; starter-pack writes need one narrow scope and re-authorisation for older sessions |
| Search | Top/Latest/People/Feeds/Starter Packs, structured include/exclude filters, persisted local history, in-app feed/starter-pack destinations, and account-scoped post search from a profile | Scoped search uses the same `searchPostsV2.authors` filter as structured `from` |
| Notifications | Tabs, grouped activity, unread count, mark-all-read and a real per-category settings route with in-app/push switches and audience filters | No device push registration yet (#36) |
| Saved | Private Bluesky bookmarks, remove in place | Uses AppView bookmark stash; good privacy model |
| Media | Profile photo/banner upload; post photos with up to 10 images, alt text, previews, compression, retries, full-screen viewer, record-with-media quotes and label warnings; MP4/GIF video posts through `video.bsky.app`, published video views and WebVTT captions | Balla's 100 MB / 10-minute local limits are shown before upload; Bluesky's service limits still apply |
| Composer | Multi-post threads, link cards, quotes, per-photo and per-video alt text, self-applied content warnings from the Bluesky vocabulary, up to three post languages, local draft recovery, and reply/quote gate records written after publishing | List-based gate rules remain (#16) |
| Moderation | Post/profile report, block/unblock, mute/unmute, label warnings with labeler attribution, labeler subscriptions, per-label filters, adult-content gate, muted words, and a moderation inbox for reports, decisions, notices, account standing, action history and appeals | Missing list/feed reports and device push for inbox outcomes (#36) |
| Deletion | Post deletion from the overflow menu; account/data screen explains export, deactivation and permanent deletion and links to the PDS controls | Account-level actions are PDS operations and stay outside the client |
| Lists/feeds | Saved and pinned custom feeds; curation and moderation lists with create/edit, membership, list feeds, subscribe/block states and profile links | List/feed reports remain; the AppView has no global list-search endpoint |
| DMs | Inbox, real unread counts and join-request counts, chat requests, paginated messages with replies and reactions, text and post-embed sends, group creation, members, invite links and join requests, conversation settings with lock/unlock, mark-all-read, mute/unmute and leave, report/message and actor block, plus chat notification preferences, all through the chat-service proxy | Built on narrow `chat.bsky.convo.*`, `chat.bsky.group.*` and `chat.bsky.notification.*` RPCs; device push delivery remains blocked (#36) |
| Settings | Settings shell with account, privacy/security, session, moderation, notifications, content filters, appearance, accessibility, language, feed/thread, help, legal, about and sign-out routes. Birthday, automation and logged-out visibility use real profile/personal-details writes; session facts are read from non-secret OAuth metadata | Email, password, 2FA, app passwords, activity privacy, account lifecycle and push delivery remain provider-owned or ungranted, and are linked to rather than faked |
| Support/legal | In-app Help, privacy, terms, community guidelines, copyright, contact and about pages; matching public site pages | Monitored public contact is the GitHub issue tracker and private advisory form |
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
- rich-text facets for mentions, links and hashtags;
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
- **Done:** honest grapheme counting and posting errors.

List-based gate rules are deliberately absent: a published list URI needs a
real picker, and a made-up one would be a protocol lie.

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
   replies, deletes and reports stay visible with a retry.
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
   membership, list feeds, subscribe/block states and profile links are shipped;
   list/feed reports remain. Saved/custom feeds, hashtag/topic/video pages and
   the opt-in Discover surface are shipped; Following stays chronological.
6. Settings preference editors for content, language, appearance, privacy and
   account. Content filtering, labelers, adult content and muted words are
   shipped, along with System/Light/Dark, post text size, description badges,
   primary/content languages, Following filters, thread reply order, birthday,
   automation and logged-out visibility self-labels, and non-secret session
   facts. UI translation is not shipped (the interface is English only),
   haptics are not emitted so no toggle is offered, and provider-owned account
   security controls stay on the PDS behind honest links.
7. In-app post deletion and sign-out cleanup.
8. ~~DMs.~~ Done: inbox, unread counts, requests, messages, text/post embeds and conversation controls. Chat moderation and group creation remain.

### P2 — depth and federation

1. ~~Starter packs.~~ Done: search, landing pages, explicit member/feed actions, official sharing and owner-only creation/editing with one narrow repo scope. Labeler subscriptions and custom labeler preferences remain.
2. ~~Multi-account support.~~ Done: separate OAuth sessions keyed by DID, labelled switch/add/remove flows, an account-keyed UI remount and honest handling of revoked grants. Drafts and scheduling-adjacent workflows remain.
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
