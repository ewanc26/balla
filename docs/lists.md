# Lists

Last researched: **21 November 2026**. Implementation update: **23 November 2026**.

Balla implements Bluesky’s curation and moderation lists directly through the
AT Protocol. A list is an `app.bsky.graph.list` record on the creator’s PDS;
membership is an `app.bsky.graph.listitem` record pointing at a list and an
account. A list block is an `app.bsky.graph.listblock` record.

## Research basis

- Bluesky’s official client keeps lists in `src/view/screens/Lists.tsx`,
  `src/screens/ProfileList/` and `src/state/queries/list.ts`. Its list creation
  writes `app.bsky.graph.list`; membership writes `app.bsky.graph.listitem`;
  blocks write `app.bsky.graph.listblock`.
- `app.bsky.graph.getLists` returns the lists authored by one actor.
  `app.bsky.graph.getList` returns metadata plus paginated member items.
  `app.bsky.feed.getListFeed` returns posts from a curation list.
- Subscribing to a moderation list uses `app.bsky.graph.muteActorList`;
  unsubscribing uses `app.bsky.graph.unmuteActorList`. The viewer’s state is
  returned as `viewer.muted` and `viewer.blocked`.
- The official client reads subscribed lists with `getListMutes` and blocked
  lists with `getListBlocks`, then de-duplicates them against authored lists.

## Balla implementation

- **Lists screen:** authored lists, subscribed lists and blocked lists, with
  local filtering. A new list can be created from this screen.
- **List detail:** creator, purpose, description, member count, subscription and
  block state, moderation-label warning, and a Posts/People switch. Curation
  lists have their own paginated feed; every list has a paginated member list.
- **List management:** create/edit name, description and purpose (purpose is
  fixed after creation). Owners add and remove accounts from the People view.
- **Profile links:** authored lists appear on profiles, with a link to the full
  list index for that account.
- **Home shortcuts:** a curation list feed can be pinned to Home through the
  published `app.bsky.actor.defs#savedFeed` preference with `type: 'list'`.
  Pinned list feeds are ordered with generator feeds in Switch feed, loaded
  through `app.bsky.feed.getListFeed`, and labelled with metadata from
  `app.bsky.graph.getList`. Unpinning or removing the shortcut never changes
  list membership or Following.
- **Search and navigation:** Search has a direct Lists destination; the desktop
  rail and Settings have the same route.
- **Moderation states:** `!hide` lists show a generic hidden card to everyone
  except their owner. Non-owners cannot see the name, description, member
  count, members or feed. `viewer.muted` shows Subscribed, and `viewer.blocked`
  shows Blocked with an unblock action.
- **Blocking:** blocking a list requires confirmation because the list-block
  record is public and applies to every account currently on the list.
- **Indexing waits:** after creating, editing or deleting a list, Balla waits
  for the AppView to reflect the change before returning to the list surface.
- **Deletion:** deleting a list also removes its `listitem` records from the
  PDS before deleting the list record.
- **Reports:** list and feed-generator reports use the published
  `com.atproto.moderation.createReport` strong-ref path, with the same
  categories and local-only receipt as post and account reports.

## OAuth scopes

The feature adds only the collections and RPC methods it uses:

- `repo:app.bsky.graph.list?action=create&action=update&action=delete`
- `repo:app.bsky.graph.listitem?action=create&action=delete`
- `repo:app.bsky.graph.listblock?action=create&action=delete`
- `app.bsky.graph.getLists`
- `app.bsky.graph.getList`
- `app.bsky.graph.getListMutes`
- `app.bsky.graph.getListBlocks`
- `app.bsky.feed.getListFeed`
- `app.bsky.graph.muteActorList`
- `app.bsky.graph.unmuteActorList`

All AppView calls use the existing `did:web:api.eurosky.network#bsky_appview`
audience. Existing sessions must sign out and back in before the new scope is
available.

## Deliberate gaps

- The AppView exposes lists by actor, not a global full-text list search. Balla
  offers local filtering and profile lists rather than inventing an endpoint.
- List avatars are not uploaded yet.
- Reference lists are displayed if encountered, but only curation and moderation
  lists can be created.
