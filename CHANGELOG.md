# Changelog

Versions follow the app version in `package.json`, `app.json` and the native
Info.plist. Each release is tagged `vX.Y.Z` on `main`.

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
