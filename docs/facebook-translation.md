# Facebook-era translation map

Research date: **20 November 2026**. Implementation status: **25 November 2026**.

Balla's design brief is "Facebook UX minus the dark patterns": a chronological
News Feed of cards, every action a visible button, no ranking, no ads and no
growth nudges. This document is the concept map between the AT Protocol /
Bluesky concepts Balla reads and writes and the Facebook-era surfaces it
presents. It is the repository copy of the map tracked in
[issue #149](https://github.com/ewanc26/balla/issues/149); each child issue holds
the detailed acceptance criteria. The map is a translation of *shape*, not a
claim of affiliation with Meta or Facebook.

## The map

| AT Protocol / Bluesky concept | Facebook-era surface | Where Balla stands |
| --- | --- | --- |
| `app.bsky.feed.getTimeline` (Following) | News Feed | Shipped: Home is newest-first cards with no ranking |
| `app.bsky.feed.post` | Wall posts | Shipped: the card is the Wall (it is the name) |
| Replies via `getPostThread` | Comments on the Wall | Shipped: Thread screen, wall-to-wall (#153) and inline first-reply previews (#155) |
| `app.bsky.feed.like` | Like and Reactions | Shipped: like counts, engagement lists (#24) and community-lexicon emoji reactions (#150) |
| `app.bsky.feed.repost` | Share to feed | Shipped: the repost action on cards |
| Post share sheet | Share | Shipped: share, copy link and translate (#39) |
| Saved posts | Saved | Shipped: the Saved tab; bookmarks stay private off-protocol |
| Conversations, with the #103 seam | Messenger | Shipped: chats, groups and message reactions (#26, #27) |
| Notifications | Alerts bell | Shipped: grouped alerts (#22); device push stays blocked (#36) |
| Profile record | Profile with cover photo | Shipped: banner, editing and pinned posts (#23) |
| Verification lexicon | Verified badge | Shipped: badges with honest copy (#25) |
| Lists | Friend lists, Group-shaped reading | Shipped: curated and moderation lists with feeds (#19, #85) |
| Starter packs | Suggested friends, user-initiated only | Shipped (#20, #76) |
| Labels and muted words | Content filters | Shipped (#38, #107) |
| Own-repository history | Memories: On this day | Shipped (#152) |
| Temporary muting | Snooze for 30 days | Shipped (#151) |
| Following activity | The Ticker, but quiet | Shipped (#154) |
| `community.lexicon.calendar.event` + `rsvp` | Events, one-tap RSVP | Shipped (#157) |
| Places via the eurosky-places service | Places, check-ins, photo locations | **Partial (#156):** configurable public typed search, a composer name picker, structured result details, validated-ID copy and browser link-outs; no granularity choice, check-in record, place chip or per-media binding. The `social.eurosky.place.pin` lexicon is still a draft, so Balla writes no place record and claims no ATGeo interoperability |
| Ranked feed generators (fu) | An opt-in, disclosed For You shelf | Shipped (#158): each entry names the operator and published algorithm; Following is never changed |
| Publisher account bundles | The News tab | Shipped (#159): an inspectable roster assembled into one ordinary curation list |
| Post versioning (community, unsettled) | Honest "edited", history visible | Decision record shipped (#160): one atomic edit at the same AT-URI inside five minutes, previous text retained and a two-entry history view |

## Filed outside the translation map

These are infrastructure or project identity rather than translations, so they
are tracked separately and do not add a row above:

- #161 — the Eurosky-operated AppView and service defaults (infrastructure).
- #162 — creator attribution across the app and site (project identity).
- #163 — a static Supporters block (project identity).

## The dark-pattern side of the brief (never)

Engagement ranking of feeds, threads, replies or reactions; "Top comments"
selection; "People You May Know" loops beyond user-initiated discovery;
Stories-style expiry pressure; growth nudges and engagement celebrations;
anything that hides a louder action behind a swipe. Each child restates what
stays out of its own scope. The one ranked surface, the opt-in For You shelf
(#158), names its operator and algorithm and never enters Following.

## What this map is not

It is not a list of provider switches. AppView, chat, video and label services
remain grant-bound; changing their audience needs a new OAuth authorisation.
The Advanced work in #93 and its children (#97, #99, #100) is the
infrastructure counterpart of this map and remains partial. No new OAuth scope
or dependency follows from this document; the published scope count stays 112.
