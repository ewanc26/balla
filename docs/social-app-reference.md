# Bluesky Social app reference

Research date: **21 November 2026**.

This note is based on a local clone of the official Bluesky client,
[`bluesky-social/social-app`](https://github.com/bluesky-social/social-app).
It is the primary reference for feature parity work in Balla. It is not a fork:
Balla keeps its own Facebook-style shell, chronological Following feed, OAuth
client and screen structure.

## Reference snapshot

| Item | Value |
| --- | --- |
| Upstream | `https://github.com/bluesky-social/social-app` |
| Local clone | `.research/social-app` (git-ignored; excluded from Vercel uploads) |
| Version | `1.139.0` |
| Commit | `17393322eec4f22bfb0d07bd27c3d2af1db8d398` |
| Commit date | 21 November 2026 |
| Commit subject | `Nightly source-language update` |

The clone is shallow (`--depth=1`) and is research material only. Do not commit
it, deploy it, or copy its branding, illustrations, icon set, fonts or analytics.
The source code is MIT licensed, but the repository's `ASSETS.md` explicitly
carves out artwork, icons, fonts and trademarks that are not covered by that
licence. Balla uses its own generated icons and visual system.

## Why this is the reference now

The official app's route registry is effectively a complete surface inventory.
It also shows how the protocol features are composed, not merely which API
methods exist. The useful observations are:

- The primary bottom bar is **Home, Search, Messages, Notifications, Profile**.
  Feeds, Lists, Saved, Settings and Atmosphere are full tab navigators reached
  from the wider navigation surface.
- The app separates API clients by service: AppView, PDS and chat. Balla's
  single OAuth `Agent` can still make the same calls, but chat needs its own
  service proxy and OAuth audience.
- Post actions, reports and moderation are composed as reusable menus/dialogs,
  not scattered per screen. This is the pattern Balla should copy.
- Labels are applied through a moderation layer before rendering, and reports
  are first-class UI, not a link to a help page.
- The official app uses feature flags and analytics heavily. Balla should not
  import either; parity means the user-facing capability, not the experiment
  machinery.

## Reference architecture

| Area | Source paths | What to learn |
| --- | --- | --- |
| Route registry | `src/routes.ts` | Canonical list of every navigable surface |
| Navigation | `src/Navigation.tsx` | Primary tabs, secondary tabs and screen ownership |
| Queries | `src/state/queries/` | One query/mutation per protocol concern |
| Session/service clients | `src/state/session/` | AppView, PDS and chat are separate clients |
| Moderation | `src/lib/moderation/`, `src/components/moderation/` | Labels, reports, blocks and warnings |
| Composer | `src/view/com/composer/` | Media, quote, drafts, languages, threadgates |
| Post controls | `src/components/PostControls/` | Menus for interactions, sharing and safety |
| Design system | `src/alf/` | Their system; Balla keeps its own palette and cards |

Balla's equivalents remain `src/lib/agent.ts`, `src/screens/` and
`src/components/`. Do not transplant the official design system or navigation
architecture wholesale.

## Full surface inventory

### Home and reading

- Following timeline and an explicit switcher for saved custom feeds.
- Pinned and saved feeds, including list feeds.
- Discover, video feed, hashtags, topics and shared starter-pack landing pages.
- Post thread with ancestors, nested replies, hidden replies, threadgates and
  reply sorting; tree view is a user preference.
- Liked-by, reposted-by and quote-post lists for a post.

Reference paths: `src/features/followingV2/home`, `src/screens/CustomFeed`,
`src/screens/PostThread`, `src/screens/Post/PostLikedBy.tsx`,
`PostRepostedBy.tsx`, `PostQuotes.tsx`, `src/screens/Hashtag.tsx`,
`src/screens/Topic.tsx`, `src/screens/VideoFeed`.

### Search

The official search result tabs are **Top, Latest, People, Feeds and Starter
Packs**. Advanced search supports author, mentions, domain, URL, hashtag,
exclusions, language, date range, replies-only/exclude-replies, media, video,
following-only and from-me. Search history is persisted.

Reference paths: `src/screens/Search/Shell.tsx`,
`src/screens/Search/SearchResults.tsx`,
`src/screens/Search/searchParams.ts`, `src/screens/Search/components/`.

### Notifications

The official notification tabs are **All, People I follow, Replies, Follows and
Post alerts**. The screen maintains seen state, unread counts and grouped
activity. It does not paint an invented unread state.

Reference paths: `src/screens/Notifications/index.tsx`,
`src/screens/Notifications/ActivityList.tsx`,
`src/state/queries/notifications/`.

### Profiles and social graph

- Edit profile, avatar and banner.
- Followers, following, known followers and profile-only post search.
- Verification, labels and labeler profiles.
- Profile lists, authored feeds and starter packs.
- Follow, unfollow, follow-back, block, unblock, mute and report.
- Pinned post and profile links.
- Posts, replies and media feed sections.

Reference paths: `src/screens/Profile/`, `src/screens/ProfileList/`,
`src/state/queries/profile-*.ts`, `src/state/queries/my-lists.ts`.

### Post composer

The official composer supports:

- text with rich-text facets, mentions, links and hashtags;
- multiple images/gallery, image editing, alt text and alt-text enforcement;
- video with transcoding, processing state, captions and alt text;
- GIFs, link cards and quote posts;
- post languages and suggested language;
- self-labels/content warnings;
- reply controls/threadgates, quote controls and interaction settings;
- multi-post threads, drafts and draft recovery;
- emoji picker and character-counting based on graphemes.

Reference paths: `src/view/com/composer/Composer.tsx`,
`src/view/com/composer/state/`, `src/view/com/composer/photos/`,
`src/view/com/composer/videos/`, `src/view/com/composer/threadgate/`,
`src/view/com/composer/labels/`, `src/view/com/composer/drafts/`.

### Feeds, lists and starter packs

- Saved and pinned feeds, reorder/remove, feed discovery and search.
- Curated lists and moderation lists; list creation, membership, list feeds and
  subscription/blocked-list states.
- Starter-pack search, landing pages, explicit member/feed actions, official sharing, and creation/editing for the signed-in account's own packs through one narrow repo scope.
- Feed generators and feed likes.

Reference paths: `src/view/screens/Feeds.tsx`, `src/screens/SavedFeeds.tsx`,
`src/view/screens/Lists.tsx`, `src/screens/ProfileList/`,
`src/screens/StarterPack/`, `src/state/queries/feed.ts`,
`src/state/queries/list.ts`, `src/state/queries/starter-packs.ts`.

### Messages

- Conversation list, unread counts, chat requests and mark-all-read.
- One-to-one and group conversations, join requests and group settings.
- Message composer with post embeds, replies and reactions.
- Mute, leave, lock, report and per-conversation settings.
- Chat preferences and actor declaration.

Reference paths: `src/screens/Messages/`,
`src/state/queries/messages/`, `src/state/messages/`.

### Moderation and safety

- Report post, profile, list and feed.
- Block and unblock; mute and unmute.
- Mute words and tags, thread mute and per-post interaction settings.
- Moderation lists, muted accounts and blocked accounts.
- Subscribed labelers, content filters and adult-content controls.
- Moderation inbox: reports made, decisions, notices and account status.
- Verification settings.
- Post deletion, hide-for-me and hide-reply-for-everyone.
- Content-warning and label handling before rendering.

Reference paths: `src/components/moderation/`, `src/screens/Moderation/`,
`src/screens/ModerationInbox/`, `src/lib/moderation/`,
`src/components/PostControls/PostMenu/PostMenuItems.tsx`.

### Settings and account lifecycle

The official settings surface includes Account, Privacy and security,
Notifications, Content and media, Appearance, Accessibility, Languages, Beta
features, About, Following feed preferences, Thread preferences, External
embeds, Saved feeds, App passwords, moderation tools, sign-out, and support
pages.

Account settings include email, password, handle, birthday, automation label,
data export, deactivation and permanent account deletion. Privacy settings
include 2FA, app passwords, activity privacy and post notification
preferences.

Reference paths: `src/screens/Settings/`, `src/screens/Settings/components/`,
`src/routes.ts`, `src/view/screens/PrivacyPolicy.tsx`,
`src/view/screens/TermsOfService.tsx`, `src/view/screens/CommunityGuidelines.tsx`.

## Balla coverage today

| Surface | Balla now | Gap |
| --- | --- | --- |
| Auth | OAuth-only, DPoP, native and web callback, granular collection and AppView scope | No multi-account; existing sessions need one re-authorisation for the narrower scope |
| Home | Chronological Following first, a visible switcher for saved feeds, pagination and pull-to-refresh | No Discover, video, hashtag or topic surfaces |
| Posts | Text, one-to-ten photo uploads with alt text and legacy/gallery embeds, record-with-media quotes, like, repost, bookmark, reply, delete, copy link/text, share sheet, translation with show-original and image viewing | No video, GIF, pin or edit interaction settings |
| Threads | Ancestors, nested replies, reply composer | No threadgate, hidden replies, reply sorting or tree preference |
| Profiles | Public profile, follow/unfollow, posts, follower/following/known-follower lists, likes/reposts/quotes lists, authored lists, report/block/mute, and editing of name, bio, pronouns, links, avatar and banner | No verification or pinned post |
| Search | Top, Latest, People, Feeds and Starter Packs; structured include/exclude filters; persisted device history; tappable hashtags, mentions and links; feed, starter-pack and list destinations | Profile-scoped search (#25); no global list-search endpoint |
| Notifications | Tabs, grouping, unread count, mark-all-read and per-category in-app/push preferences with audience filters | No device push registration (#36) |
| Saved | Private bookmarks and remove-in-place | Custom feed management lives in Feeds |
| Feeds/lists | Saved and pinned custom feeds; lists with create/edit, membership, list feeds, subscribe/block states and profile links | List/feed reports remain; no global list-search endpoint |
| Messages | Inbox, unread counts, chat requests, paginated messages, text/post embeds and mute/leave controls through the chat proxy | Group creation and chat moderation remain |
| Moderation | Post/profile report, block/mute, delete, labels with labeler attribution, labeler subscriptions, per-label filters, adult-content gate, muted words, and a moderation inbox with reports, account standing, notices, actions and appeals | List/feed reports and inbox push delivery absent |
| Settings | Settings shell with account/security, privacy/security, session, moderation, notifications, content filters, appearance, accessibility, language, help, legal, about and sign-out routes. Birthday, automation and logged-out visibility use real writes; session facts come from non-secret OAuth metadata | Email, password, 2FA, app passwords, activity privacy and account lifecycle are provider-owned and linked to rather than faked; push delivery preferences remain |
| Composer | Text, image/camera selection, up to ten compressed JPEGs, alt-text editor and enforcement preference, abortable uploads, retries, gallery previews, quotes and grapheme counter | Video, GIF, link cards, languages, labels, threadgates, drafts and threads absent |
| Account lifecycle | OAuth sign-out; account/data screen with confirmation-gated export, deactivation and deletion guidance, and explicit PDS limits | No in-client account deletion, because that is a PDS operation |
| Support/legal | In-app Help, Privacy, Terms, Guidelines, Copyright, Contact and About; matching site pages | Public contact is the issue tracker and private advisory form |

## Implementation order

### Slice 1 — safety and lifecycle (P0)

The first release blocker and current workstream:

1. **Done:** visible post overflow menu with **Quote**, **Copy link**, **Copy post
text**, **Share**, **Translate post**, **Mute account**, **Block account**,
   **Report post**, and **Delete post** for the author.
2. **Done:** profile report/block/mute actions, with blocked profiles unable to
   be followed. Followers/following entry points remain.
3. **Done:** report categories and `com.atproto.moderation.createReport` to the
   configured labeler. A local report receipt is still missing.
4. **Done:** post and profile block/mute through the AppView, filtering feeds,
   search, saved posts, threads and notifications.
5. **Done:** labels and content warnings are applied before rendering, including
   `!hide`, `!warn`, media, avatar and display-name labels. See
   `docs/moderation.md`.
6. **Done:** Settings shell with Account and security, Privacy and security,
   Session security, Moderation, Notifications, Content and media, Appearance,
   Accessibility, Languages, About and Sign out. Account and privacy screens use
   real birthday, automation and logged-out visibility writes plus provider
   links; session security reads non-secret OAuth facts only.
7. **Done:** in-app Help, Privacy, Terms, Community Guidelines, Copyright and
   report-handling pages, with public site equivalents. The monitored contact
   route is the issue tracker and private advisory form.

Useful reference files: `PostMenuItems.tsx`, `ReportDialog`,
`BlockDialog`, `src/screens/Settings/Settings.tsx`,
`src/screens/Moderation/index.tsx`, `src/lib/moderation/`.

### Slice 2 — composer and profile parity

1. Media composer with image upload, alt text, gallery, video/GIF and errors.
2. Quote posts, link cards, languages, self-labels and threadgates.
3. Drafts and multi-post threads.
4. Followers, following, known followers, post engagement lists and profile
   editing are **done**. Verification and pinned posts remain.
5. Likes/reposts/quotes lists on posts.

### Slice 3 — discovery and curation

1. Search Top/Latest/People/Feeds/Starter Packs and advanced filters are **done**.
2. **Done:** saved/pinned feeds, feed discovery and feed management.
3. Lists, list feeds, moderation lists and starter packs.
4. Notification seen state, filter tabs and grouped activity.
5. Settings for content, language, accessibility and following-feed filters.

### Slice 4 — chat and depth

1. Chat service proxy and OAuth scope are **done**.
2. Conversation list, requests, messages and post embeds are **done**; group settings and reporting remain.
3. Moderation inbox is **done**; verification settings remain.
4. Video feed, hashtags, topics and Atmosphere surfaces.
5. Account export/deactivation/deletion guidance is **done**; the controls stay on the PDS and Balla links to them with explicit limits.

## Protocol notes for Balla

- Keep `agent.ts` as the only session/agent module. Do not create screen-local
  `Agent` instances.
- Chat calls need the chat service audience and `atproto-proxy` — Balla uses
  `getChatAgent()` with `withProxy('bsky_chat', 'did:web:api.bsky.chat')`. They are
  not AppView calls.
- Reports need the labeler service DID and the correct audience in the OAuth
  scope. A report that only writes locally is not a report.
- The AppView only hydrates labels from labelers the client requests. Sending
  `atproto-accept-labelers` and using a moderation layer is mandatory for label
  parity.
- Media uploads go to the PDS with `uploadBlob`; video processing is a separate
  asynchronous flow and must expose failure/retry states.
- Deletion means deleting the PDS record, not hiding the card locally.
- The Following feed remains chronological and opt-in custom feeds are separate
  destinations. Do not import Discover ranking into Following.

## Source-of-truth links

- Local reference snapshot: `.research/social-app` at commit
  `17393322eec4f22bfb0d07bd27c3d2af1db8d398`.
- Route registry: `.research/social-app/src/routes.ts`.
- Navigation and tabs: `.research/social-app/src/Navigation.tsx`.
- Official compliance target: `docs/bluesky-compliance.md`.
- Facebook presentation mapping: `docs/facebook-ui.md`.
