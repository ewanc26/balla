# Changelog

Versions follow the app version in `package.json`, `app.json` and the native
Info.plist. Each release is tagged `vX.Y.Z` on `main`.

## 0.6.0

- Make the marketing site's mobile header a single compact row with a visible, keyboard-reachable menu button, 44pt menu targets and no horizontal overflow. The desktop navigation is unchanged.
- Cap the reading column at 680px at every width, so tablets and landscape phones keep the same line length as desktop.
- Give mobile a direct 44pt header action for Feeds and Lists instead of burying those destinations several taps deep. The five-tab bar still owns tab navigation, so nothing is duplicated.
- Shorten the Notifications tab label to “Alerts” on narrow phones so it is not clipped, and remove its fixed-height label box.
- Collapse deep thread reply indentation on phones so nested posts keep a readable text column, while the role label still states the real depth.
- Respect the bottom safe area in the reply composer, feed switcher, list report sheet and sign-in screen.

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
