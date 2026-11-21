# OAuth scope inventory

Last updated: **21 November 2026**.

Balla no longer requests `repo:*` or `rpc:*` for the AppView. The metadata
declares only the collections and RPC endpoints the client currently calls:
the scope currently has **48 tokens**.

## Repository writes

| Scope | Used by |
| --- | --- |
| `repo:app.bsky.feed.post?action=create&action=delete` | Composing and deleting posts |
| `repo:app.bsky.feed.like?action=create&action=delete` | Liking and undoing likes |
| `repo:app.bsky.feed.repost?action=create&action=delete` | Reposting and undoing reposts |
| `repo:app.bsky.graph.follow?action=create&action=delete` | Following and unfollowing |
| `repo:app.bsky.graph.block?action=create&action=delete` | Blocking and unblocking |
| `repo:app.bsky.actor.profile?action=create&action=update` | Editing the profile record (name, bio, pronouns, avatar, banner and link refs) |
| `repo:app.bsky.actor.link?action=create&action=update&action=delete` | Creating, reordering, editing and removing profile links |

Balla adds `update` only for the profile and link records it can edit. It does
not update posts or any other record type. There is no threadgate, list, feed
generator, starter-pack or chat scope.

## Blob uploads

| Scope | Used by |
| --- | --- |
| `blob:image/jpeg` | Profile and post image uploads after the client crops and compresses them to JPEG |

The PDS enforces a 1 MB limit for profile pictures and banners and a 2 MB limit
for post images. Balla checks the relevant size before uploading. A failed
profile image keeps the existing picture; a failed post upload keeps the draft
and resumes successfully uploaded photos on retry.

## AppView RPCs

All of these use:

`aud=did:web:api.bsky.app#bsky_appview`

| Method | Used by |
| --- | --- |
| `app.bsky.actor.getPreferences` | Label, adult-content and saved-feed preferences |
| `app.bsky.actor.getProfile` | Profile screens and the viewer chrome |
| `app.bsky.actor.putPreferences` | Labelers, label filters, adult content, muted words and saved-feed/pin order |
| `app.bsky.actor.searchActors` | People search |
| `app.bsky.bookmark.createBookmark` | Saving a post |
| `app.bsky.bookmark.deleteBookmark` | Removing a saved post |
| `app.bsky.bookmark.getBookmarks` | Saved screen |
| `app.bsky.feed.getAuthorFeed` | Profile posts |
| `app.bsky.feed.getFeed` | Custom feed posts, including pinned Home tabs |
| `app.bsky.feed.getFeedGenerator` | Custom feed metadata |
| `app.bsky.feed.getFeedGenerators` | Batched metadata for saved feeds |
| `app.bsky.feed.getLikes` | Liked-by list for a post |
| `app.bsky.feed.getPostThread` | Thread screen |
| `app.bsky.feed.getQuotes` | Quote-post list for a post |
| `app.bsky.feed.getRepostedBy` | Reposted-by list for a post |
| `app.bsky.feed.getTimeline` | Chronological Following feed |
| `app.bsky.feed.searchPostsV2` | Structured post search, Top and Latest |
| `app.bsky.graph.getFollowers` | Followers list |
| `app.bsky.graph.getFollows` | Following list and “People I follow” notification filter |
| `app.bsky.graph.getKnownFollowers` | “Followed by” list on a profile |
| `app.bsky.graph.getStarterPack` | Starter-pack landing page |
| `app.bsky.graph.muteActor` | Muting an account |
| `app.bsky.graph.searchStarterPacksV2` | Starter-pack search |
| `app.bsky.graph.unmuteActor` | Unmuting an account |
| `app.bsky.labeler.getServices` | Custom label definitions |
| `app.bsky.notification.getPreferences` | Per-category notification settings |
| `app.bsky.notification.listNotifications` | Notifications |
| `app.bsky.notification.putPreferencesV2` | Saving notification settings |
| `app.bsky.notification.updateSeen` | Mark all read |
| `app.bsky.unspecced.getPopularFeedGenerators` | Feed discovery in search and the Feeds screen |

## Labeler report audience

`rpc:com.atproto.moderation.createReport?aud=did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler`

Post and account reports use the labeler proxy header described in
`docs/report-handling.md`.

## Moderation inbox audience

The moderation inbox is served by the same Bluesky labeler and uses this
audience for every call:

`aud=did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler`

| Method | Used by |
| --- | --- |
| `tools.ozone.inbox.listReports` | Your reports list and filters |
| `tools.ozone.inbox.getReport` | Report detail and resolution |
| `tools.ozone.inbox.listActionedSubjects` | Account notices list and filters |
| `tools.ozone.inbox.getActionedSubject` | Notice detail, action history and appeal state |
| `tools.ozone.inbox.getUnreadCount` | Real inbox and Settings unread count |
| `tools.ozone.inbox.getAccountStatus` | Account standing and enforcement |
| `tools.ozone.inbox.updateSeen` | Mark reports, notices or standing as read |
| `tools.ozone.inbox.appealActionedSubject` | Submit an available appeal |

No moderation-inbox call is made against the AppView audience. Reports in the
inbox are read from the moderation service and are not copied into a Balla
database.

## Deliberately absent

- `blob:*/*` — only the JPEG MIME type is requested. Profile and post photos
  are converted to JPEG. Video and GIF uploads are not implemented.
- Account and app-password scopes — account lifecycle is a PDS operation and
  Balla links to the server controls instead.
- Feed-generator, list, starter-pack and threadgate repo scopes — Balla reads
  custom feeds and writes saved-feed preferences through the AppView; it does
  not create generators, lists, starter packs or threadgates.
- `chat.bsky.*` — DMs are not implemented. A chat audience must be added before
  shipping them.
- `transition:*` and broad wildcards.

## Re-authorisation

The client metadata has widened over time for profile editing, saved feeds and
the moderation inbox while staying granular. Sessions authorised before any of
those changes keep their old grant and must re-authorise before the new
profile/link/blob, saved-feed or inbox scopes are available. Signing out and back
in requests the current scope. The consent screen should show the collection and
RPC list above, not “access to nearly everything”.

## Caveat

The inventory is based on every `agent.*` call in `src/`. If a future feature
adds a collection or endpoint, add its scope in the same change and document the
re-authorisation step. Do not restore a wildcard to avoid updating this list.
