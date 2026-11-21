<p align="center">
  <a href="https://github.com/ewanc26/balla/actions/workflows/ci.yml"><img src="https://github.com/ewanc26/balla/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/ewanc26/balla?label=licence" alt="Licence"></a>
  <a href="https://github.com/sponsors/ewanc26"><img src="https://img.shields.io/github/sponsors/ewanc26?logo=githubsponsors&logoColor=white&label=sponsors" alt="Sponsor"></a>
</p>

# Balla

> a Facebook-like Bluesky client

Balla renders Bluesky the way Facebook reads: your friends' posts as cards on a
home feed, newest first, with no algorithm deciding what you see.

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
- Works with any service host, so accounts on other providers are first-class.

## Non-goals

- Engagement ranking, suggested posts, or ads of any kind. Ever.
- A Facebook clone: no pages, no reactions palette, no dark patterns, no
  "people you may know".
- Scope beyond the Bluesky app lexicons.

## Status

Scaffold stage, growing fast. Expo SDK 58, React Native 0.88.1, TypeScript.
What exists today: AT Protocol OAuth login; the chronological Following feed as
cards with pull-to-refresh and endless scroll, with a What's-on-your-mind
composer sitting above it; threads — tap a card's comment
button to read the conversation, including nested reply branches, and reply
from a composer at the bottom; a full-screen image viewer — tap any post image
for the
fullsize render with visible close and step buttons, and the alt text printed
under it; notifications that open the conversation they belong to when tapped;
public profiles — tap any author to view their profile, follow or unfollow, and
see their posts, followers and following, plus known followers and liked-by,
reposted-by and quote lists; photo posts with up to ten images, per-photo alt
text, an optional requirement to describe every image, cancellable uploads and
retries; profile editing for name, bio, pronouns, links,
avatar and banner; a Search tab with Top, Latest, People, Feeds and Starter
Packs, structured filters and local history; a Feeds screen for saved and pinned custom feeds, with discovery, search, pin/unpin, reorder and removal; a Saved tab for private bookmarks; per-post copy link, copy text, share sheet and
translation with a show-original toggle; labeler subscriptions with per-label
filters, an adult-content gate and muted words; per-category notification
preferences; dark mode; a generated icon set;
account export, deactivation and deletion guidance that links to the PDS controls;
a moderation inbox for reports, decisions, notices, account standing and appeals;
and a web client at <https://balla.croft.click/app>. The shell follows Facebook's current
white chrome, grey canvas, 8px cards and responsive three-column desktop
layout; the research and mapping are in
[docs/facebook-ui.md](docs/facebook-ui.md). DMs and lists are still on the
roadmap.

CI runs the typecheck, dependency audit and icon sync on every push, so a green
check is a real claim about the commit it ran on. The research and gap analysis
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
production project is `balla`; deploy with:

    vercel --prod --project balla

The custom domain is a Cloudflare CNAME to Vercel, verified on 20 November
2026. Vercel manages the Let's Encrypt certificate.

## Logging in

Balla uses **AT Protocol OAuth**. Enter a handle, a DID, or the URL of your PDS;
the app opens your server's authorisation page in the system browser and you
approve access there. Balla never asks for or stores your password.

The OAuth client is identified by `oauth-client-metadata.json`. That exact file
must be published at `https://balla.croft.click/oauth-client-metadata.json`
before sign-in can work; the server fetches it from the URL in `client_id`. The
app bundles the same file at build time, so rebuild after changing the redirect
URIs or scope. On the web, sign-in opens your server's approval page in a popup
and returns to `https://balla.croft.click/app`, where the popup passes the
session to the tab that opened it.

## Icon

The app icon, the Android adaptive foreground, the splash mark and the favicon
are all generated by `scripts/gen-icons.py` — the white brick on the brand
blue is a wall, which is the name. Visual identity changes go through that
script rather than editing assets by hand, and once the assets are committed,
CI fails the build if the committed files and the script disagree
(`python3 scripts/gen-icons.py --check` locally).

## Trademarks

AT Protocol, atproto, Bluesky, and the Bluesky butterfly logo are trademarks of
Bluesky Social PBC. Facebook and the Facebook logo are trademarks of Meta
Platforms, Inc. Balla is an independent project, not affiliated with or endorsed
by either; it interoperates with the AT Protocol and uses no one's trademarks
as branding.

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
