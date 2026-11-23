# AGENTS.md

Guidance for AI coding agents working in **balla**.

## Project overview

A Facebook-inspired Bluesky client for iOS, Android and the web. Expo SDK 58,
React Native 0.88.1, TypeScript. The premise: Facebook's reading experience,
used as a visual reference, without its dark patterns — the chronological
Following feed, rendered as cards. Balla is independent software, not an official
Bluesky client, and is not affiliated with or endorsed by Meta or Bluesky Social
PBC.

- Language: TypeScript
- Default branch: main, rebase merges only

## Principles

1. **Chronological or nothing.** The Following feed, newest first, is the
   product. Anything that ranks, suggests, or inserts between a person and
   their follows belongs in another app. No experiments on this rule, no
   feature flags for it.
2. **Visible buttons only.** Every action is a tappable control of at least
   44pt with a visible affordance. No swipe-only, no long-press-only, no
   gesture a screen-reader or a reduced-grip hand cannot use. Reachability is
   a design constraint the maintainer personally relies on, not a nice-to-have.
3. **Honest surfaces.** Timestamps are real, counts are real, labels say what
   they mean. Nothing dressed as content that is not content. Claims in docs
   describe the code, not an aspiration.
4. **Lean dependencies.** RN core, react-navigation, `@atproto/api`,
   FlashList and stdlib scripts are the palette. Ad, analytics and tracking
   SDKs are banned outright; anything else new justifies itself in the PR.
5. **Protocol truth over convenience.** Follow the `app.bsky` lexicons rather
   than inferring a shape from one response. A bespoke response that does not
   match its lexicon is not a contract.
6. **No duplication.** Relative time lives once in `src/lib/time.ts`, count
   formatting once in `src/components/PostCard.tsx`, colours only through
   `usePalette()`. If a second implementation of a rule is about to be
   written, stop and use the first.
7. **Reference, not affiliation.** Facebook-era styling is a visual reference to
   public design history, not a claim of affiliation, endorsement or partnership
   with Meta. Bluesky references identify the network and protocol Balla uses;
   they do not make Balla official or endorsed. Keep that distinction in code,
   copy and documentation, and ship no Facebook logos or brand assets.

## Design constraints

The site and app follow the wall, not the current AI-landing-page default.
These are hard constraints, not preferences:

- No purple or blue gradients, glassmorphism, glow, emoji or generic icon
  badges. Flat colour, spacing and real UI previews carry the hierarchy.
- No centred hero plus three identical rounded cards. Use a vertical list for
  features and roadmap, with left-aligned copy and one clear point of emphasis.
- No eyebrow label above every heading, numbered `01 / 02 / 03` markers,
  pulsing status dots, fake metrics, invented counts or testimonials.
- Copy names the actual feature and its limit. Avoid “seamless”, “unlock”,
  “empower”, “elevate”, “revolutionise”, “game-changing” and “curated” unless
  the word is a quoted protocol term.
- Cards use the shared 8px radius; only avatars, pills and conventional chips
  are round. Shadows stay at 1–2px and are never used as a glow.

## Source boundaries

- `src/theme.ts` — the one palette (light and dark) and `usePalette()`.
- `src/lib/agent.ts` — the only auth, session and agent module. Screens never
  construct their own `Agent`.
- `oauth-client-metadata.json` — the AT Protocol OAuth client metadata. It must
  be served verbatim at the `client_id` URL; the app bundles the same file.
- `site/` — the static Vercel landing page, privacy note and assets.
  `scripts/build-site.mjs` copies them into `dist-site` and exports the Expo web
  client to `dist-site/app`; `vercel.json` serves the result.
- `metro.config.js` — Expo’s Metro config plus a scoped resolver shim for the
  OAuth package’s platform-specific entry files.
- `docs/bluesky-compliance.md` — the compliance bar and gap matrix.
  Keep its claims tied to the code and official guidance.
- `docs/facebook-ui.md` — the Facebook UI research and the surface-by-surface
  mapping. Keep it tied to the implemented components.
- `src/lib/mock.ts` — opt-in preview fixtures, enabled only by
  `EXPO_PUBLIC_BALLA_MOCK=1`. Never deploy a production build with the mock
  flag on; the yellow preview strip is the visible warning when it is.
- `src/lib/time.ts` — timestamps and relative times.
- `src/components/` — cross-screen pieces; `PostCard.tsx` renders a post
  everywhere a post is rendered.
- `src/screens/` — one folder-worth per screen, fed by the agent module.
- `scripts/gen-icons.py` — the only source of committed assets. Assets change
  through the script, never by hand.
- `assets/` — generated output, always regenerable from the script.

## Build and verification

    npm install
    npx expo install --check
    python3 scripts/gen-icons.py --check
    npx tsc --noEmit
    npm run site:build
    npx expo run:ios

- OAuth sessions live in MMKV through `@atproto/oauth-client-expo`; only the
  last DID is kept in `AsyncStorage` so the app knows what to restore. OAuth
  needs a development build, so Expo Go is not supported.
- The legacy app-password key is removed on startup and before a new login.
  Never migrate a password-equivalent session into OAuth.
- CI performs the clean install, typecheck, dependency audit and icon sync
  on every push, so it is the first authority on drift. What CI cannot cover is
  runtime. State exactly what you ran and where. Never claim checks you did not
  run.

## Conventions

- Conventional Commits, scoped by area: `feat(feed): …`, `fix(login): …`,
  `docs(agents): …`.
- British English in prose and UI copy.
- One responsibility per file; split before it stops being readable.
- Comments explain decisions and protocol constraints, not what the code
  already says.

## Current state

Login with AT Protocol OAuth, then a stack over a five-tab shell: the
chronological Following feed as cards (Home), explicit people/post search, a
notifications list, a Saved list of private Bluesky bookmarks, and the
signed-in profile with a logout. Every post author is tappable and opens a
public profile; other people's profiles have a follow/unfollow button, while
the signed-in profile keeps logout. Profiles show their posts, follows and
followers, plus verification badges (with the verifiers Bluesky reports), label
warnings, a pinned post, authored lists/feeds/starter packs and a control to
search that account's posts. The post overflow also opens Content filters at the muted-words section. Other profiles can be shared or copied as canonical links, muted by reposts only, and have their recorded links reported through the published link-view subject. Every card has a Save action; removing a bookmark from Saved takes
the card out of that list immediately, and the Saved tab reloads when focused.
Every card's comment button opens a Thread
screen: the ancestor chain, the highlighted post, its replies, and a composer
that replies into the same tree (root travels up correctly when replying to a
reply). Appearance settings offer System/Light/Dark, post text size, four
Facebook-era chrome presets and nine solid accent colours; they are stored on
the device and keep Following chronological. Accessibility settings cover the
alt-text requirement and larger description badges. Language settings choose a
primary post/translation language and content languages; Following filters and
thread reply order are saved through `app.bsky.actor` preferences and applied
locally. Hashtags in posts open their own newest-first page; Search also offers
explicit topic and video pages and an opt-in Discover surface. All four use the
already-authorized `searchPostsV2` call, paginate, and never enter Following;
only Discover is ranked, and its page says so. Account and security settings
show the identity Balla can read, a real
birthday and automation-label write, and non-secret OAuth session facts. A
Settings → Accounts screen lists the accounts on this device with labelled
switch, add and remove controls: each account keeps its own OAuth session in
the on-device store keyed by DID, Balla remembers only the DID and any handle,
and switching rebuilds the whole authenticated tree so no session or cached
state crosses accounts; removing revokes that grant and leaves the others
signed in;
privacy settings include the logged-out visibility self-label, the real
notification-preference editor and activity privacy through the published
`app.bsky.notification.declaration` record. Notification Settings lists and
manages per-account activity subscriptions through the real RPCs, and every
profile has a bell for opting in to an account's posts and replies. Email,
password, 2FA, app passwords and account lifecycle are provider-owned, so Balla
links to them rather than showing fake controls. Profiles support temporary live
status through `app.bsky.actor.status` with a LIVE badge, and trusted verifiers
can issue and remove verification records. Tapping any post image opens a full-screen
viewer (visible close and step buttons, alt text caption, the fullsize
render). The feed's What's-on-your-mind row opens a composer; failed sends
keep the text rather than eating it. New posts write rich-text facets for links,
hashtags and mentions whose handles resolve to DIDs; an unresolvable mention
stays plain text rather than being stored with an empty DID. The composer
suggests matching accounts while an `@handle` is typed, using the existing
people-search scope, and thread replies write the same facets and use the same
picker. Both composers enforce Bluesky's 300-grapheme and 3,000-byte text caps
with a live counter. It supports threads, photos with
alt text, MP4/GIF video with optional WebVTT captions and honest processing
states, link cards, quotes, self-applied content warnings, up to three post
languages per post, and reply and quote controls written to real threadgate and
postgate records. An unfinished post is kept locally with a Restore/Discard
prompt, and posts you authored have an Interaction settings screen. Tapping a notification opens the thread it belongs to; a follow opens the actor's public profile. Lists support creation and editing,
membership, list feeds, subscribe/block states and profile links; list and feed
reports are implemented through real strong-ref report writes, and curation list
feeds can be pinned through the published saved-feed preference into the Home
switcher beside generator feeds. Starter packs have search, landing pages, explicit
follow and add-feed actions, official share links, and creation, editing and
deletion for packs the signed-in account owns; writes use one narrow starter-pack repo scope;
sessions authorised before 0.20.0 need to sign in again before deleting a pack. Private messages are available through a Messages entry point: an inbox with real unread and join-request counts, chat requests, and conversations that page through history, send text and post embeds with replies and reactions. Groups can be created and managed with members, invite links and join requests; conversations expose settings with lock/unlock where allowed, mark-all-read, mute/unmute, leave, chat reporting and actor blocking, and separate chat notification preferences. Chat calls use the chat-service proxy and thirty-six narrow `rpc:chat.bsky.convo.*`, `rpc:chat.bsky.group.*` and `rpc:chat.bsky.notification.*` scopes; message content is not stored by Balla or logged, and older sessions need to sign in again for chat. Saved and pinned custom feeds have
their own Home tabs and a Feeds management screen, and Following stays first and
chronological. Reply trees render nested branches
under their parents, with
indentation capped after three levels and every reply's comment button opening
that branch on its own. Quote posts and external link cards render in cards and threads; link cards
can be built from a web link in the composer. Lists can be reported, and a
successful report leaves a local-only receipt. Home has a visible feed switcher:
Following is always first and newest-first, with saved feeds one tap away.
Only a label set to Hide conceals an account; a Warn label keeps the identity
visible and shows a labelled warning. Icons are generated by `scripts/gen-icons.py` and the binary assets are
committed; CI enforces that they match the script on every push. The same app is
exported to the web at `https://balla.croft.click/app`; browser sign-in uses a
popup that returns to `/app` and hands the session to the tab that opened it.
On the web only, React Navigation linking gives every screen an address under
`/app` so posts, profiles and lists can be shared and browser history works.
Native navigation is unchanged.
The visual shell follows Facebook's current white chrome and card system: a
top bar, desktop shortcuts/context rails and a mobile bottom tab bar. The
mapping and the deliberate omissions (Stories, reactions, ranking) live in
`docs/facebook-ui.md`.

## Working rules

- Inspect the README, CI workflows and nearby code before editing.
- Preserve existing architecture, naming, formatting and error handling.
- Use project scripts for validation; keep changes scoped.
- Bump the app version in `package.json`, `app.json` and `ios/Balla/Info.plist`
  for each release, record it in `CHANGELOG.md`, and tag `main` as `vX.Y.Z`
  with a matching GitHub release after the merge.
- Use feature branches and pull requests; `main` is never pushed to directly.
- Always rebase merge pull requests into `main` with `gh pr merge --rebase`.
  Merge commits and squash merges are forbidden. Keep `main` linear and update
  local checkouts with `git pull --ff-only`.
- Treat generated files, credentials and release metadata as sensitive.

<!-- allowed-agents -->
## Allowed agents

Only **Claude** (Anthropic) and **Mistral** (Mistral AI) may be used as coding agents in this repository. This rule supersedes any earlier agent-attribution guidance in this file.

- Agent-assisted commits must credit only one of those agents:
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - `Co-Authored-By: Mistral Vibe <vibe@mistral.ai>`
- Allowed agent footers are `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `🤖 Generated with [Mistral Vibe](https://mistral.ai)`.
- Do not add `Co-Authored-By:` trailers, `Generated with` footers, author names, or committer identities for any other agent or AI tool.
- Do not credit another agent in commit metadata.
