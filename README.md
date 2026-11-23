<p align="center">
  <a href="https://github.com/ewanc26/balla/actions/workflows/ci.yml"><img src="https://github.com/ewanc26/balla/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ewanc26/balla?label=licence" alt="Licence"></a>
  <a href="https://github.com/sponsors/ewanc26"><img src="https://img.shields.io/github/sponsors/ewanc26?logo=githubsponsors&logoColor=white&label=sponsors" alt="Sponsor"></a>
</p>

# Balla

> a Facebook-inspired Bluesky client

Balla renders Bluesky the way Facebook reads: your friends' posts as cards on a
home feed, newest first, with no algorithm deciding what you see.

Balla is independent software, not an official Bluesky client, and is not
affiliated with, endorsed by or sponsored by Bluesky Social PBC or Meta
Platforms, Inc. Facebook-era styling is a visual reference only.

## Why

Balla exists because of my mum. She was comfortable with Facebook and found
Bluesky's interface confusing; the posts were there, but the shape of the app
was not. Balla is my attempt to give her a familiar wall without taking away
her Bluesky account or the protocol underneath it.

Facebook's reading experience was never the problem. A warm grey canvas, cards
from people you actually know, newest first — that part worked. The dark
patterns wrapped around it were the problem: engagement ranking, ads dressed up
as posts, suggested content on every surface. Balla keeps the reading experience
and refuses the rest. It is an ordinary AT Protocol client talking to Bluesky
like any other; what it changes is what you see, and how honestly it is
labelled.

## Why the name?

Balla is Gàidhlig for **wall**. Facebook's defining surface was the Wall — the
place you left things for people you knew, in order, before "the algorithm"
became a job title. The name keeps the good half of that history.

## Goals

- The chronological Following feed as the home feed. Always.
- Facebook's reading ergonomics — cards, generous touch targets, honest
  timestamps — on iOS, Android and the web.
- Works with AT Protocol services that expose the relevant lexicons, so accounts
  on other providers are not tied to one appview.

## Non-goals

- Engagement ranking, suggested posts, or ads of any kind. Ever.
- A Facebook clone: no pages, no reactions palette, no dark patterns, no
  "people you may know".
- Scope beyond the Bluesky app lexicons.

## Status

Web, iOS and Android. Expo SDK 58, React Native 0.88.1, TypeScript.
What exists today: AT Protocol OAuth login; the chronological Following feed as
cards with pull-to-refresh and endless scroll, with a What's-on-your-mind
composer sitting above it; threads — tap a card's comment
button to read the conversation, including nested reply branches, and reply
from a composer at the bottom; a full-screen image viewer — tap any post image
for the
fullsize render with visible close and step buttons, and the alt text printed
under it; notifications that open the thread they belong to, or a follower's public profile, when tapped;
public profiles — tap any author to view their profile, follow or unfollow, and
see their posts, followers and following, plus known followers and liked-by,
reposted-by and quote lists, verification and labeler badges with the verifiers
Bluesky reports, label warnings, a pinned post, authored lists, feeds and starter
packs, profile tabs for Posts, Replies, Media, Videos and Likes, likeable feeds and labelers with a real liked-by list, and account-scoped post search; photo posts with up to ten images, per-photo alt
text, an optional requirement to describe every image, cancellable uploads and
retries; MP4 video and animated GIF posts with visible processing states, a
100 MB / 10-minute Balla limit, optional WebVTT captions and Bluesky's own GIF
presentation in the feed; rich-text facets for links, hashtags and mentions
whose handles resolve to DIDs, with unresolved mentions left as plain text; the
composer suggests matching accounts while a handle is typed, and thread replies
write the same facets and offer the same suggestions; both composers enforce
Bluesky's 300-grapheme and 3,000-byte text caps with a live counter; content
warnings from the Bluesky self-label
vocabulary and up to three post languages per post; local draft recovery with a Restore or Discard prompt plus account drafts saved to your private Bluesky stash through the real `app.bsky.draft.*` RPCs (reopen, update, delete and clear-on-publish);
reply and quote controls written to Bluesky's real threadgate and postgate
records, editable from any post you authored; profile editing for name, bio, pronouns, links,
avatar and banner; other people's profile menus share or copy the public profile link, hide only that account's reposts, and report one of its links; a Search tab with Top, Latest, People, Feeds and Starter
Packs, structured filters and local history; starter-pack landing pages with explicit follow, add-feed and share actions, plus creation, editing and deletion for packs you own using a narrow `repo:app.bsky.graph.starterpack` scope (sessions authorised before 0.20.0 need to sign in again before deleting a pack); a Feeds screen for saved and pinned custom feeds and list feeds, with discovery, search, pin/unpin, reorder and removal; hashtag, topic and video pages plus an opt-in Discover surface, each an explicit destination that never enters Following, with newest-first pages and a clearly ranked Discover; lists with create/edit, membership, list feeds (pinnable to Home), subscribe/block states and profile links; appearance settings with System/Light/Dark, a Dim/Dark choice in dark mode, post text size, four Facebook-era chrome presets and nine solid accent colours; accessibility settings for the alt-text requirement and larger description badges; language settings for a primary post/translation language and content-language filters; Following filters for replies, reposts and quote posts, and thread reply ordering, saved through Bluesky's `app.bsky.actor` preferences; a Saved tab for private bookmarks; temporary live status on your own profile through `app.bsky.actor.status` with a LIVE badge on active profiles; per-account activity notifications with a profile bell and a management list, plus account activity privacy, both stored in published records; per-post copy link, copy text, share sheet, send via direct message and
translation with a show-original toggle; Content and media settings for the
in-app browser choice and autoplay, with external links opening through one
opener that always leaves mailto, tel and SMS links with the system handler;
labeler subscriptions with per-label
filters, an adult-content gate and muted words with a post-menu shortcut into
the visible section; repost-only account mutes; per-category notification
preferences; a generated icon set;
multi-account support with a labelled Accounts screen to switch, add and remove OAuth sessions, each kept separate by DID with no shared tokens or carried-over state; account and security settings for the identity Balla can read, birthday and automation-label self-labels, privacy controls and non-secret OAuth session facts, with provider links for email, password, 2FA, app passwords and account lifecycle; account export, deactivation and deletion guidance that links to the PDS controls;
a moderation inbox for reports, decisions, notices, account standing and appeals;
and a web client at <https://balla.croft.click/app>. The shell follows Facebook's current
white chrome, grey canvas, 8px cards and responsive three-column desktop
layout; the research and mapping are in
[docs/facebook-ui.md](docs/facebook-ui.md). Messages cover conversations with
real unread counts, chat requests, group creation, members and invite links,
join requests, replies and reactions, per-message copy and translate for text
messages, conversation settings with lock/unlock, chat reporting and actor
blocking, and chat notification preferences. Message content stays with Bluesky
and is never stored or logged. Device push for chat remains blocked (#36). The list model, routes and deliberate gaps are
documented in [docs/lists.md](docs/lists.md).

CI installs from the committed lockfile and runs the typecheck, dependency
audit (`npm audit --audit-level=moderate`), deterministic test suite,
static-site build and icon sync on every push and pull request, so a green check
is a real claim about the commit it ran on.
The research and gap analysis
for a fully compliant client is in
[docs/bluesky-compliance.md](docs/bluesky-compliance.md).

## Getting started

Requires Node 22+, an Expo-friendly native toolchain, and Xcode or Android
Studio. OAuth needs a custom URL scheme and native crypto, so Balla runs in a
development build, not Expo Go.

    npm install
    npx expo install --check   # trues up any drift; commit the result
    python3 scripts/gen-icons.py
    npx expo run:ios           # or: npx expo run:android

After the first build, `npx expo start --dev-client` reuses the installed app.
`npm run site:build` exports the Expo web client into `dist-site/app`, copies
the landing page and OAuth metadata into `dist-site`, and is what Vercel runs.

## Deployment

`vercel.json` installs dependencies and runs `scripts/build-site.mjs`. The
deployment serves the landing page at `/`, the privacy note at `/privacy`, the
web client at `/app`, and `oauth-client-metadata.json` at the root. `/app` is
also the web OAuth redirect; the old `/oauth-callback` URL redirects there. The
web client uses React Navigation linking on the web only, so each screen has an
address under `/app` (for example `/app/post/…` or `/app/profile/…`); a rewrite
serves the app shell for those nested paths while native navigation is
untouched. The production project is `balla`; deploy with:

    vercel --prod --project balla

The custom domain is a Cloudflare CNAME to Vercel, verified on 20 November
2026. Vercel manages the Let's Encrypt certificate. The landing page links to
`https://balla.croft.click/features` for the issue-linked feature and roadmap
matrix; keep that page and the site's legal pages in step with the code.

## Logging in

Balla uses **AT Protocol OAuth**. Enter a handle, a DID, or the URL of your PDS;
the app opens your server's authorisation page in the system browser and you
approve access there. Balla never asks for or stores your password.

The OAuth client is identified by `oauth-client-metadata.json`. That exact file
must be published at `https://balla.croft.click/oauth-client-metadata.json`
before sign-in can work; the server fetches it from the URL in `client_id`. The
app bundles the same file at build time, so rebuild after changing the redirect
URIs or scope. Existing sessions keep the scope they were granted, so sign in
again when a new permission is added. On the web, sign-in opens your server's
approval page in a popup
and returns to `https://balla.croft.click/app`, where the popup passes the
session to the tab that opened it.

## Icon

The app icon, the Android adaptive foreground, the splash mark, the favicon and
both Light/Dark alternate-icon assets are all generated by
`scripts/gen-icons.py` — the white brick on the brand blue is a wall, which is
the name. Visual identity changes go through that script rather than editing
assets by hand, and once the assets are committed, CI fails the build if the
committed files and the script disagree (`python3 scripts/gen-icons.py --check`
locally). The Dark variant is baked into native builds by the
`expo-alternate-app-icons` config plugin and chosen through Settings → App Icon;
the official Bluesky+ icon set is internal and is not copied.

## Trademarks

AT Protocol, atproto, Bluesky, and the Bluesky butterfly logo are trademarks of
Bluesky Social PBC. Facebook and the Facebook logo are trademarks of Meta
Platforms, Inc. Balla is an independent project, not affiliated with, endorsed by
or sponsored by either; it interoperates with the AT Protocol and uses no one
else's marks as its branding.

References to Facebook-era design are visual references only, not claims of
affiliation. References to Bluesky identify the network and AT Protocol that Balla
connects to; they do not make Balla an official client or partner. All trademarks
remain the property of their owners.

## Contributing

Changes go through a branch and a pull request, and `main` is never pushed to
directly. The flow and the project rules are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Sponsors

If Balla is useful to you, you can support my work — one-off or recurring.
Everything in one place: [ewancroft.uk/support](https://ewancroft.uk/support).
Payments are handled securely by each platform; this project never sees your
payment details.

## Licence

Balla is licensed under the GNU Affero General Public License v3.0. See
[LICENSE](LICENSE).
