# Changelog

Versions follow the app version in `package.json`, `app.json` and the native
Info.plist. Each release is tagged `vX.Y.Z` on `main`.

## 0.26.0

- Profiles with public teal.fm scrobbles now show a compact **Recently played** strip: a small horizontal row of track chips with the title, artist and real relative time. Tapping a chip opens a light detail sheet with the record's metadata and a link out to the profile on teal.fm; there is no player, no music tab and no listening stats.
- Both `fm.teal.feed.play` and the removed-but-still-present `fm.teal.alpha.feed.play` are read from the profile's own repository. The DID is resolved first so reads work against whichever PDS hosts that repository, and every read is bounded and retryable. Accounts with no plays see nothing new.
- Appearance gains one **Show recent plays** switch. It is on by default, stored on this device only, and hides the strip and skips the reads when off. Balla never writes to a teal collection and adds no OAuth scope or dependency.
- Add deterministic tests for both lexicon spellings, record normalisation, ordering, DID-document PDS extraction, the visibility toggle and the no-write/no-storage guard, plus a live read against a real PDS during development. No dependency or OAuth scope changed.

## 0.25.1

- Interaction settings now preserve existing `hiddenReplies` and `detachedEmbeddingUris` when saving reply or quote rules, so editing one gate can no longer silently undo a hidden reply or a detached quote.
- The inbox now asks the chat service for unread counts with `includeGroupChats: true`, so group conversations are included in the unread totals.
- Group join previews now read pending join requests from the preview's conversation rather than an invented shape, so the owner's count is real when the service supplies it and omitted otherwise.
- No dependency or OAuth scope changed.

## 0.25.0

- Appearance now offers a **Dark theme** choice with **Dim** and **Dark** when the resolved scheme is dark. Dim lifts the era dark surfaces and accent towards white while keeping the published text and accent-soft tokens, and the choice is stored on this device only. Light mode is unchanged.
- Message actions now offer visible **Copy text** and **Translate** controls for messages that contain text. Copy writes the exact message text to the clipboard with a visible notice; Translate uses the primary language and offers **Show original** / **Show translation**. Embed-only messages do not show the controls, and Balla still does not log or store message text.
- Fix delete-for-self using the conversation id from the route instead of a field on the message. No dependency or OAuth scope changed.

## 0.24.0

- The post overflow now has **Mute words & tags** immediately after Mute thread. It opens Content filters with the muted-words section in view.
- Other people's profile menus now offer **Share via…**, **Copy link to profile**, **Hide reposts in feeds** / **Show reposts in feeds**, and **Report a link** when the profile has reportable link records. Sharing uses the canonical public profile URL with the existing native and browser clipboard fallbacks; repost muting uses `onlyReposts` on the real actor-mute RPC; link reports use the published `app.bsky.actor.defs#profileLinkView` subject and leave the usual local-only receipt.
- Add deterministic tests for profile URLs, menu wiring, scoped repost muting and link-report subjects. No dependency or OAuth scope changed.

## 0.23.3

- The CI job named "dependency audit" now actually audits published advisories
  with `npm audit --audit-level=moderate`, in addition to checking Expo SDK
  drift. A newly disclosed moderate or high advisory fails the CI gate until it
  is fixed or deliberately overridden.
- Extend the deterministic workflow test and update the README and contributing
  guide so the documented check matches the enforced one. No dependency or
  OAuth scope changed.

## 0.23.2

- Clear both open lockfile advisories with pinned transitive overrides:
  minimatch 11.0.9 and zod 4.6.6. `npm audit` now reports zero vulnerabilities.
- Add deterministic tests that verify the patched versions in the committed
  lockfile and exercise the installed zod against real AT Protocol records, so
  an upstream regression cannot pass CI silently. No OAuth scope changed.

## 0.23.1

- CI now runs the deterministic test suite and the static-site build on every
  push and pull request, in addition to typechecking, Expo dependency drift and
  icon sync. All install steps use `npm ci` so a green check is tied to the
  committed lockfile.
- Add a deterministic workflow test and update the contributing guide and README
  so the documented checks match the enforced ones. No dependency or OAuth
  scope changed.

## 0.23.0

- Curation list feeds can now be pinned to Home through the published saved-feed
  preference (`type: 'list'`). Pinned list feeds appear in Switch feed with the
  real list name and creator, load through `app.bsky.feed.getListFeed`, and can
  be reordered or removed in the Feeds screen. Following remains first and
  chronological; this adds a separate destination, not ranking.
- The Feeds screen now manages generator feeds and list feeds together. List
  metadata comes from `app.bsky.graph.getList`; no OAuth scope changed.

## 0.22.1

- Both composers now enforce the published `app.bsky.feed.post` text caps: 300
  graphemes and 3,000 UTF-8 bytes. The main composer previously checked only
  graphemes; the reply composer checked neither. Both show a live grapheme
  counter, report the byte cap honestly, and disable Post/Reply before an
  invalid request is sent. Text is never truncated or rewritten.
- Add a shared text-measurement helper and deterministic tests for ASCII,
  grapheme and byte boundaries, including emoji-heavy text that fits the
  grapheme cap but not the byte cap. No OAuth scope or dependency changed.

## 0.22.0

- Thread replies now write real rich-text facets for links, hashtags and
  mentions, using the same detector and unresolved-mention filter as new posts.
  A reply's facets are generated from the trimmed reply text and sent with the
  `agent.post` call; an unresolvable mention stays plain text rather than being
  stored with an empty DID.
- The reply composer now offers the same inline mention suggestions as the main
  composer. Picker state lives in one shared hook used by both screens, so
  debouncing, stale-response protection and loading, empty and failure states
  cannot drift. No OAuth scope or dependency changed; the AppView scope remains
  111 tokens.
- Add deterministic tests for reply facets and shared picker wiring, and update
  the README, current-state, compliance note, reference inventory and site copy.

## 0.21.0

- The composer now suggests matching accounts while a mention is typed.
  Suggestions appear after `@` and two characters, wait 250 ms before searching,
  and use the already-authorised `app.bsky.actor.searchActors` AppView call.
  Choosing a result replaces the whole token with the canonical handle and
  preserves surrounding whitespace and punctuation. Email-like text and range
  selections do not trigger the picker.
- The picker shows explicit loading, empty and failure states, uses 48pt rows and
  labels every result for assistive technology. No OAuth scope, dependency or
  automatic mention insertion was added; the AppView scope remains 111 tokens.
- Add deterministic tests for token detection, replacement, result filtering and
  composer wiring, and update the README, current-state, OAuth inventory,
  compliance note, reference inventory and site copy.

## 0.20.0

- New posts now carry real rich-text facets (`app.bsky.richtext.facet`) for
  links, hashtags and mentions. Mention handles are resolved through the official SDK
  rich-text detector; an unresolved handle stays plain text instead of being
  written with an empty DID. No OAuth scope or dependency changed.
- Starter packs can now be deleted by their owner from the pack page, after an
  explicit confirmation. Deletion removes the `app.bsky.graph.starterpack`
  record and the private reference list it owns, including list membership; a
  pack owned by another account is refused at the data layer. The confirmation
  says that links will stop working and the action cannot be undone.
- Add `action=delete` to the existing narrow
  `repo:app.bsky.graph.starterpack` scope. Sessions authorised before 0.20.0
  need one re-authorisation before they can delete a pack. No broad repo, RPC or
  blob scope was added.
- Add deterministic facet and deletion tests, and update the OAuth scope
  inventory, compliance note, reference inventory, README, site and
  current-state docs to match. No new dependency was added.

## 0.19.0

- Add account-level moderation and preference parity. Settings now reaches a
  blocked/muted-account manager backed by the published graph endpoints,
  default reply/quote settings, verification badge display and interests
  editors backed by real account preferences, and working Media and About
  pages. Verification badges now honour the stored hide preference and new
  posts start from the saved interaction defaults.
- Composer reply rules can now target a real list, chosen from the account's
  own `app.bsky.graph.list` records; an invalid or invented URI is never
  written. Hidden replies use the published threadgate `hiddenReplies` field:
  the root post author can hide or unhide a reply, the existing allow rules are
  preserved, and hidden replies render in an expandable section. No local-only
  hide is used.
- Feed generators can now be reported from their detail screen through the
  published `com.atproto.moderation.createReport` strong-ref path, using the
  same categories and local receipt flow as list reports.
- The post menu now exposes pin/unpin (a real strong ref on the profile record),
  thread mute/unmute through the graph service, and quote detach/reattach through
  the postgate `detachedEmbeddingUris` field. Detach preserves existing quote
  rules and only appears when the viewer owns the quoted post. No action stores
  a local-only state.
- Profiles now support temporary live status through the published
  `app.bsky.actor.status` record at rkey `self`: go live, edit the link and
  duration, and end it, with an optimistic-concurrency `swapRecord` write. An
  active status appears as a LIVE badge and link card on the profile, and the
  narrow repo write scope is included in the OAuth grant.
- Activity privacy is now a real account control: choose who may opt in to
  notifications for your activity (followers, mutuals or no one), stored in the
  published `app.bsky.notification.declaration` record at rkey `self` with its
  narrow OAuth write scope. It is reachable from Privacy and Security.
- Per-account activity notifications now match the official client: a bell on
  each profile opens a dialog to opt in to its posts and optionally its replies
  (replies never without posts), backed by the real `putActivitySubscription`
  RPC. Notification Settings lists and manages subscriptions through
  `listActivitySubscriptions`, with narrow AppView RPC scopes.
- Trusted verifiers can now issue and remove verification records from another
  account's menu through the published `app.bsky.graph.verification` lexicon,
  writing to and deleting from their own repo. The actions only appear for a
  verifier viewing someone else and update the profile on success.
- The post menu now offers "Hide post for me" and "Hide reply for me", stored
  in device-local persistence and merged into moderation prefs so the hide is
  applied by `@atproto/api` on every feed, thread, profile and search surface,
  including quoted posts. No report or server write is sent.
- The post menu now offers "Show more/less like this" for custom feeds that
  accept interactions. Feedback is sent through the published
  `app.bsky.feed.sendInteractions` call, routed to the feed generator's
  `bsky_fg` proxy with the post's `feedContext` and `reqId` preserved. The
  chronological Following timeline never sends ranking feedback.
- Profiles now have real tabbed feeds matching the official client: Posts,
  Replies, Media, Videos and (on your own profile) Likes. Each tab uses a
  published author-feed filter or the `getActorLikes` RPC; tab visibility
  follows the official rules, an invalid deep-linked tab falls back to Posts,
  and pinned posts appear only on the Posts tab.
- Feed generators and labelers can now be liked and unliked through the same
  `app.bsky.feed.like` record used for posts, with a "Liked by N users" link
  into the real `getLikes` list. Labeler likes resolve the service view through
  `getServices`; invalid strong refs are never written.
- The post menu now offers "Send via direct message": pick a recent chat or a
  person and the post is sent as an `app.bsky.embed.record` strong ref through
  the real `getConvoForMembers` and `sendMessage` chat RPCs. New 1:1 chats are
  resolved before sending; no message text is logged.
- External links now share one opener: the first HTTP(S) link asks whether to
  use the in-app browser or the system browser, remembers the choice in Content
  and media, and always leaves mailto, tel and SMS links with the system handler.
- Composer drafts can now be saved to the account's private Bluesky draft stash,
  listed from the composer, reopened, updated and deleted through the real
  `app.bsky.draft.*` AppView RPCs. Text, warnings, languages, interaction rules
  and quote/link refs survive; photos and videos remain device-bound.
- Settings now offers the official Light/Dark app icon choice. The selected
  icon is read back from the OS, Android confirms the restart, and the web
  screen explains that icon changes need the native app instead of throwing.
  Generated Balla assets and an Expo config plugin bake the Dark variant; the
  internal Bluesky+ icon set stays excluded.
- Add deterministic model and wiring tests for the new preferences, gate
  writes, hidden replies, feed feedback, navigation, profile tabs, object likes,
  share-via-chat and app icons, and update the compliance and reference docs to
  match. The release adds only narrow permissions: repository scopes for
  threadgates, postgates, verification records, live status and the
  activity-privacy declaration, AppView RPCs for listing/writing activity
  subscriptions and `getActorLikes`, and
  `rpc:app.bsky.feed.sendInteractions?aud=*` for proxied generator feedback. The
  only new dependency is the Expo 58-compatible `expo-alternate-app-icons` native
  module; sessions authorised before 0.19.0 need one re-authorisation for the
  new scopes. Device push delivery remains blocked on the self-hosted gateway
  (#36).

## 0.18.0

- Tapping a notification now opens the destination it belongs to: replies, mentions, quotes, likes and reposts still open the post's thread, and a follow now opens the actor's public profile instead of leaving the row inert. The target is chosen from ids only, by a deterministic model shared with new tests; unmapped reasons stay inert rather than inventing a link.
- Add deterministic notification target and wiring tests and update the README and AGENTS state to match. No OAuth scope, dependency or message-content handling changed. Device push delivery remains blocked on the self-hosted gateway and its credentials (#36).

## 0.17.0

- Extend Messages to the full group, embed and moderation surface. Create groups with named members, add/remove members, manage invite links with real join rules, preview a group before asking to join, and review approve/reject join requests with honest counts.
- Add replies and reactions to messages, delete-for-self, and post embeds alongside text. Conversation settings expose group name editing, membership, lock/unlock where the service allows it, and leave/mute controls; owner checks use the full member list and moderation-locked groups hide the lock toggle.
- Report a conversation or message to Bluesky's labeler through the open end of the `createReport` subject union — ids only, never message text — and block the actor from the same labelled sheet. Chat notification preferences are read and written through the chat service, separate from AppView alerts.
- Add `chat.bsky.convo.*`, `chat.bsky.group.*` and `chat.bsky.notification.*` RPCs as narrow scopes on the chat-service audience (36 chat RPCs, 98 tokens total). No broad chat set, wildcard or new dependency was added; sessions authorised before 0.17.0 need to sign in again for chat groups and preferences. Message content is never stored by Balla or written to a log.
- Add deterministic group/model and wiring tests, preview fixtures for every new screen, explicit web paths, and update the compliance, scope, reference, README, site copy and AGENTS state to match.

## 0.16.0

- Add private messages through Bluesky's chat service. The inbox lists conversations, real unread counts and chat requests; a conversation pages through message history, sends text and post embeds, and offers labelled mark-read, mute/unmute, accept-request and leave controls.
- Handle blocked people, disabled chat, locked/request conversations and group join requests with honest, content-free copy. The chat settings screen reports the real proxy audience and the "who can message you" value Bluesky exposes, and links to the provider control rather than faking a write.
- Route chat through `withProxy('bsky_chat', 'did:web:api.bsky.chat')` and add twelve narrow `rpc:chat.bsky.convo.*` scopes against the chat-service audience. No broad chat permission set, wildcard or new dependency was added. Sessions authorised before 0.16.0 need to sign in again once for chat.
- Message content is never stored by Balla and never written to a log. Add deterministic model and wiring tests; update the compliance, scope, reference, README, site copy and AGENTS state to match.

## 0.15.0

- Add explicit discovery surfaces without touching Following. Hashtag, topic and video pages use the already-authorized `app.bsky.feed.searchPostsV2` call with `hashtags`, `query` and `hasVideo` filters, sorted newest first and paginated; no new OAuth scope or dependency was added.
- Add an opt-in Discover page, reachable only from Search, that uses the same call with `sort: 'top'`. It is clearly labelled “Suggested · Ranked”, states that it is not based on who you follow, and never inserts anything into the chronological Following feed.
- Hashtags in posts now open their own newest-first page instead of the ranked search tab. All four pages have explicit web paths, back navigation, refresh, pagination, hidden-post cleanup and honest empty/error states.
- Add deterministic model and wiring tests covering param building, ranking labels, scope usage and navigation. Update the compliance doc, README, site copy and AGENTS state to match.

## 0.14.0

- Add multi-account support. Each account keeps its own OAuth session and DPoP keys in the on-device store, keyed by DID; Balla's local registry holds only the DID and any handle it was given.
- Add an Accounts screen under Settings with a labelled switch, add and remove flow. Switching restores the chosen DID into a fresh Agent and rebuilds the whole authenticated tree, so no cached post, feed, preference or session state carries over.
- Removing an account revokes its grant and deletes its tokens, leaves the other accounts signed in, and moves to a neighbour if the removed account was active. A grant that cannot be restored is removed from the list with an honest message instead of silently reusing a stale session. Signing out clears every account.
- Add model and wiring tests for registry parsing, handle validation, display labels, removal selection and the account-keyed remount. No new OAuth scope or dependency was added.

## 0.13.0

- Add explicit feed-save and share actions to starter-pack landing pages. Recommended feeds keep their open action and gain a labelled “Add feed”/“Saved feed” button that writes Balla's existing saved-feed preferences. Share uses Bluesky's official `/start/{name}/{rkey}` link from the real pack URI and creator handle or DID, and is withheld for blocked creators with an honest note.
- Add starter-pack creation and editing from the signed-in profile and from a pack Balla can prove you own. The editor picks people from the accounts you follow and feeds from your saved feeds, writes `app.bsky.graph.list`, `app.bsky.graph.listitem` and `app.bsky.graph.starterpack` records through real lexicons, and preserves the original `createdAt` when editing. It never offers edit for another account's pack.
- Add exactly one narrow OAuth scope, `repo:app.bsky.graph.starterpack?action=create&action=update`. Sessions authorised before 0.13.0 need to sign in again before starter-pack writes are permitted. No account, chat or email scope was added.
- Add deterministic model and wiring tests for URI parsing, share links, validation, record bodies, member diffs, the new screen path and the exact scope count. Offline preview fixtures cover the new editor without enabling mocks in production.

## 0.12.0

- Add an Account and security screen with the identity Balla can read (handle, DID and PDS), a real birthday editor using `setPersonalDetails`, and an automation-label toggle using the existing profile self-label write. Email, password and handle changes stay on the provider and say so plainly.
- Add a Privacy and security screen with the logged-out visibility self-label, the real notification-preference editor, and honest provider links for 2FA, app passwords, activity privacy and algorithmic recommendations. Those controls are outside Balla's OAuth grant, so no fake toggles are shown.
- Add a Session security screen showing non-secret OAuth metadata: DID, authorization server, PDS, expiry and scope count. Access and refresh tokens are never displayed.
- Share one confirmed sign-out flow between Settings and Session security. Signing out clears the local session, asks the server to revoke the grant, and never claims to delete the account.
- Reuse the existing account lifecycle screen for export, deactivation and deletion guidance rather than duplicating provider-only copy.

## 0.11.0

- Add System/Light/Dark and post text size controls in Appearance. Both are device-only choices; the resolved scheme now drives the palette, navigation chrome and status bar, and one shared scale sizes post and composer text.
- Add an Accessibility screen for the existing alt-text requirement and a new larger-description-badge option. Described images and video now show a visible ALT badge. Balla emits no haptics, so no inert haptics toggle is offered.
- Add language settings: a primary language used as the first composer language and as the translation target, and up to three content languages that hide tagged posts in Following. The interface remains English only; no UI translation is claimed.
- Add Following filters for replies, reposts and quote posts, and thread reply ordering (oldest, newest or most liked), written through `app.bsky.actor.setFeedViewPrefs`/`setThreadViewPrefs` and applied locally. Following stays chronological; visible toggles roll back when a write fails.
- Document what is deliberately absent: tree-view and external-media toggles would do nothing because Balla always nests replies and embeds no third-party players.

## 0.10.1

- Remove the remaining template patterns from the marketing site: eyebrow labels above every heading, symmetric feature-card grids, decorative window dots in the hero preview and a static “live” footer badge. Features and roadmap now read as vertical lists, matching the wall rather than a SaaS landing page.
- Replace the overbroad “any AT Protocol service host” claim with “services that expose the relevant lexicons”, and drop the marketing word “researched” from the preset descriptions.
- Document the anti-slop design constraints in `AGENTS.md` so later work does not reintroduce the same defaults.

## 0.10.0

- Add MP4 video and animated GIF posts. Files are selected with visible controls, checked locally against Balla's stated 100 MB and 10-minute limits, and sent to Bluesky's video service; the post is only publishable once the job reports `JOB_STATE_COMPLETED` with a blob. Processing states, failures and cancellation are named plainly, and converting a GIF is left to Bluesky rather than claiming a local transcode.
- Add optional WebVTT caption files (up to 20 per video, 20 kB each) using the published `app.bsky.embed.video#caption` shape. Captions use the post's first language, show that language in the composer, and can be removed before posting.
- Render published video views, including Bluesky's GIF presentation as a muted loop, with native controls and the author's alt text; posts with videos and quotes use the real `recordWithMedia` embed.
- Add exact OAuth scopes for the video service and caption blobs. Sessions created before 0.10.0 need sign-in again before video uploads are permitted; the upload error says so instead of guessing.

## 0.9.1

- Strip the decorative AI-tell surface from the marketing site: flat warm-grey canvas instead of gradient blobs, a solid header instead of a blurred one, flat buttons and cards without hover lifts or glows, and the same 8px card radius the app uses.
- Drop numbered feature/principle markers and pulsing status dots. The hero preview now uses plain action labels instead of made-up counts and glyphs, so the site's "honest labels" claim holds on its own page.

## 0.9.0

- Add reply and quote controls built strictly from `app.bsky.feed.threadgate` and `app.bsky.feed.postgate`. The composer writes the gate records after publishing; the same rkey is reused, and open access means no record at all rather than an invented rule. List-based rules are left out until there is a real list picker.
- Add an Interaction settings screen to any post you authored. It reads both gate records through `com.atproto.repo.getRecord`, lets you change who can reply and whether quoting is allowed, and writes or deletes the records accordingly. A failed save leaves the previous settings unchanged.
- Persist the unfinished post on the device and offer Restore or Discard when the composer opens again. Only text, content warnings, languages and interaction settings are restored; the prompt says that photos and quoted posts need adding again. Successful publishing clears the saved draft, and a gate-write failure never republishes a post.
- Add framework-free tests for the gate record shapes, record reading and draft parsing, with accessible controls and no overflow at 320px and 390px.

## 0.8.0

- Complete the public profile: verification badges only for `valid` statuses, with an accessible sheet listing the verifiers and records Bluesky reports; a labeler chip from `associated.labeler`; and profile labels that keep Warn states visible behind a labelled warning.
- Show a pinned post once, using the real `pinnedPost.uri`, and list authored feeds and starter packs alongside authored lists. Optional lookups fail independently, so a missing AppView endpoint never hides the profile or its posts.
- Add “Search this account's posts” from a profile. It reuses the Search tab with a fixed `authors` filter on `searchPostsV2`, a visible scope banner with a clear action, and honest placeholder and results copy.
- Add framework-free profile derivations and tests, and correct the Settings copy that still said post languages were to come.

## 0.7.0

- Add per-post content warnings and post languages to the composer. Warnings use the four self-label values Bluesky publishes; languages use real BCP-47 codes, capped at three, and both are written to the post record only when chosen. Each post in a thread keeps its own choices.
- Put both options in one accessible sheet with 44pt controls, visible selection state and a keyboard-managed focus order, and show the chosen options on the queued-post preview.
- Split the composer's photo-count and media buttons into two rows so the 320px layout no longer overflows, and expose checkbox state to browser screen readers with `aria-checked`.

## 0.6.0

- Make the marketing site's mobile header a single compact row with a visible, keyboard-reachable menu button, 44pt menu targets and no horizontal overflow. The desktop navigation is unchanged.
- Cap the reading column at 680px at every width, so tablets and landscape phones keep the same line length as desktop.
- Give mobile a direct 44pt header action for Feeds and Lists instead of burying those destinations several taps deep. The five-tab bar still owns tab navigation, so nothing is duplicated.
- Shorten the Notifications tab label to “Alerts” on narrow phones so it is not clipped, and remove its fixed-height label box.
- Collapse deep thread reply indentation on phones so nested posts keep a readable text column, while the role label still states the real depth.
- Respect the bottom safe area in the reply composer, feed switcher, list report sheet and sign-in screen.
- Use one wall mark and one Balla blue across the site, the generated icons, the app mark, the app configuration and the theme metadata. The site's focus ring now follows the same accent and offset as the app.
- Route the app's loading colour and the composer's ALT badge through the theme, and read the in-app version from `app.json` so it cannot drift from the release.
- Make page metadata, status copy and roadmap wording consistent and honest across the site, README and docs.
- Give the quoted-post link in a card the shared 44pt minimum hit area.

## 0.5.1

- Correct the web deep-link fallback so nested `/app` routes serve the app shell under the site's `cleanUrls` setting.

## 0.5.0

- The web client now reflects the current screen in the address bar. Threads, profiles, lists, feeds and settings have shareable URLs under `/app`, and browser back/forward follows in-app navigation.
- The host serves the app shell for nested `/app` paths. Native navigation is unchanged; no tracking or analytics was added.

## 0.4.0

- Only a label whose preference is Hide conceals a post or account. A Warn
  label now keeps the author's name, handle and avatar visible and adds a labelled warning card with a visible reveal control where the label allows it.
- Hidden profile pages explain that the account was hidden by the user's label settings instead of showing a placeholder identity.
- List visibility copy now says “hidden in your list settings” rather than blaming a moderation label.

## 0.3.0

- Replace the horizontal Home feed tabs with a visible Switch feed button and
  sheet. Following is always first; pinned feeds keep the user's order, followed
  by other saved feeds.
- Add a Feeds entry to the desktop left rail for managing saved feeds, and keep
  the header free of duplicate navigation.

## 0.2.0

- Show quoted posts in cards and threads with their own author, text and
  labels. Unavailable quotes explain why instead of rendering an empty card.
- Show external link cards using only the metadata Bluesky returned.
- Build link cards in the composer from the first web link in the draft, with
  removal, honest failure messages and no card when photos are attached.
- Compose multi-post threads with per-post text, photos, quotes or link cards.
  Posts publish in order as one conversation; a partial failure keeps the
  unpublished posts and continues the same thread on retry.
- Remove duplicate navigation: the header no longer repeats the left rail on
  desktop or the bottom tabs on mobile. A shared layout rule guarantees exactly
  one primary navigation surface at every width.
- Add list reports and local-only report receipts (previous release work,
  recorded here for the first tagged release).
