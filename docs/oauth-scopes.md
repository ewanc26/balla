# OAuth scope inventory

Last updated: **23 November 2026**.

Balla no longer requests `repo:*` or `rpc:*` for the AppView. The metadata
declares only the collections and RPC endpoints the client currently calls:
the scope currently has **112 tokens**. Chat is a separate service with its own
audience, documented below. The composer and reply mention pickers reuse the
existing `searchActors` grant, so they do not change the token count.

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
| `repo:app.bsky.graph.list?action=create&action=update&action=delete` | Creating, editing and deleting curation and moderation lists |
| `repo:app.bsky.graph.listitem?action=create&action=delete` | Adding and removing list members |
| `repo:app.bsky.graph.listblock?action=create&action=delete` | Blocking and unblocking a list |
| `repo:app.bsky.graph.starterpack?action=create&action=update&action=delete` | Creating, editing and deleting starter packs, using the official `app.bsky.graph.starterpack` record and a private reference list |
| `repo:app.bsky.feed.threadgate?action=create&action=update&action=delete` | Reply gates and hiding replies for everyone (`hiddenReplies`) |
| `repo:app.bsky.feed.postgate?action=create&action=update&action=delete` | Quote/embedding gates and quote detach/reattach |
| `repo:app.bsky.graph.verification?action=create&action=delete` | Trusted verifiers issuing and removing verification records |
| `repo:app.bsky.actor.status?action=create&action=update&action=delete` | Temporary live status at rkey `self` |
| `repo:app.bsky.notification.declaration?action=create&action=update` | Activity privacy (who may subscribe to your activity) at rkey `self` |
| `repo:community.lexicon.calendar.rsvp?action=create&action=update&action=delete` | Writing, changing and removing one public RSVP per community calendar event |

Balla requests a narrow `repo:` scope for every collection it writes, including
threadgates, postgates, statuses and the notification declaration: because granular grants are honoured, a
write to an unlisted collection is rejected by a real OAuth PDS even though the
local mock accepts it. `update` is requested only for records Balla can edit.
Starter packs and every other record are written through the same PDS record API
used by Bluesky's reference client; the installed generated lexicon declares
`app.bsky.graph.starterpack`.

## Blob uploads

| Scope | Used by |
| --- | --- |
| `blob:image/jpeg` | Profile and post image uploads after the client crops and compresses them to JPEG |
| `blob:text/vtt` | Optional WebVTT caption files for video posts |
| `rpc:com.atproto.repo.uploadBlob?aud=*` | Uploading processed images, captions and video blobs to the account's PDS |
| `rpc:app.bsky.video.getUploadLimits?aud=did:web:video.bsky.app` | Reading the video service's current upload limits before a post video is accepted |

The PDS enforces a 1 MB limit for profile pictures and banners and a 2 MB limit
for post images. Balla checks the relevant size before uploading. A failed
profile image keeps the existing picture; a failed post upload keeps the draft
and resumes successfully uploaded photos on retry. Video and GIF files are
checked against Balla's stated 100 MB and 10-minute limits, then uploaded to
Bluesky's video service; the post is only publishable once the job reports a
completed blob.

## AppView RPCs

All of these use:

`aud=did:web:api.bsky.app#bsky_appview`

| Method | Used by |
| --- | --- |
| `app.bsky.actor.getPreferences` | Label, adult-content and saved-feed preferences |
| `app.bsky.actor.getProfile` | Profile screens and the viewer chrome |
| `app.bsky.actor.putPreferences` | Labelers, label filters, adult content, muted words and saved-feed/pin order |
| `app.bsky.actor.searchActors` | People search and composer/reply mention suggestions |
| `app.bsky.bookmark.createBookmark` | Saving a post |
| `app.bsky.bookmark.deleteBookmark` | Removing a saved post |
| `app.bsky.bookmark.getBookmarks` | Saved screen |
| `app.bsky.draft.createDraft` | Saving a new composer draft |
| `app.bsky.draft.deleteDraft` | Deleting a saved draft |
| `app.bsky.draft.getDrafts` | Listing saved drafts |
| `app.bsky.draft.updateDraft` | Updating a saved draft |
| `app.bsky.feed.getAuthorFeed` | Profile Posts, Replies, Media and Videos tabs |
| `app.bsky.feed.getActorLikes` | Likes tab on your own profile |
| `app.bsky.feed.getFeed` | Custom feed posts, including feeds chosen from Switch feed |
| `app.bsky.feed.getFeedGenerator` | Custom feed metadata and feed-generator like state |
| `app.bsky.feed.getFeedGenerators` | Batched metadata for saved feeds |
| `app.bsky.feed.getLikes` | Liked-by list for posts, feed generators and labelers |
| `app.bsky.feed.getListFeed` | Posts from a curation list’s members |
| `app.bsky.feed.getPostThread` | Thread screen |
| `app.bsky.feed.getQuotes` | Quote-post list for a post |
| `app.bsky.feed.getRepostedBy` | Reposted-by list for a post |
| `app.bsky.feed.getTimeline` | Chronological Following feed |
| `app.bsky.feed.searchPostsV2` | Structured post search, Top and Latest |
| `app.bsky.graph.getFollowers` | Followers list |
| `app.bsky.graph.getFollows` | Following list and “People I follow” notification filter |
| `app.bsky.graph.getKnownFollowers` | “Followed by” list on a profile |
| `app.bsky.graph.getList` | List metadata and member pages |
| `app.bsky.graph.getListBlocks` | Blocked lists |
| `app.bsky.graph.getListMutes` | Subscribed lists |
| `app.bsky.graph.getLists` | Authored lists on profiles and the Lists screen |
| `app.bsky.graph.getStarterPack` | Starter-pack landing page |
| `app.bsky.graph.muteActor` | Muting an account |
| `app.bsky.graph.muteActorList` | Subscribing to a list’s mute moderation |
| `app.bsky.graph.searchStarterPacksV2` | Starter-pack search |
| `app.bsky.graph.unmuteActor` | Unmuting an account |
| `app.bsky.graph.unmuteActorList` | Unsubscribing from a list |
| `app.bsky.labeler.getServices` | Custom label definitions and labeler like state |
| `app.bsky.notification.getPreferences` | Per-category notification settings |
| `app.bsky.notification.listActivitySubscriptions` | Listing accounts whose activity you follow |
| `app.bsky.notification.listNotifications` | Notifications |
| `app.bsky.notification.putActivitySubscription` | Subscribing to or unsubscribing from an account's posts/replies |
| `app.bsky.notification.putPreferencesV2` | Saving notification settings |
| `app.bsky.notification.updateSeen` | Mark all read |
| `app.bsky.unspecced.getPopularFeedGenerators` | Feed discovery in search and the Feeds screen |

Pinning a curation list feed adds no token: it writes the published saved-feed
preference through the existing `putPreferences` grant, reads the list through
`app.bsky.graph.getList`, and loads posts through `app.bsky.feed.getListFeed`.

## Feed-generator audience

`rpc:app.bsky.feed.sendInteractions?aud=*`

“Show more/less like this” is sent to the generator that produced the post
through the `bsky_fg` proxy service. The generator DID is not known at sign-in,
so this one method uses the published wildcard-audience form; the method itself
is exact, not `rpc:*`. The chronological Following timeline has no generator and
never sends feedback.

## Chat service audience

Chat is served by Bluesky's chat service, not the AppView. Every chat call uses:

`aud=did:web:api.bsky.chat#bsky_chat`

`src/lib/agent.ts` returns a cloned agent with `withProxy('bsky_chat',
'did:web:api.bsky.chat')`, which sends the documented `atproto-proxy` header.
The narrow RPCs below are the only chat methods Balla calls. No broad chat
permission set or wildcard is requested:

| Method | Used by |
| --- | --- |
| `chat.bsky.convo.listConvos` | Message inbox, with pagination |
| `chat.bsky.convo.listConvoRequests` | Request inbox, including group join requests |
| `chat.bsky.convo.getUnreadCounts` | Real unread conversation counts |
| `chat.bsky.convo.getConvo` | Conversation header and state |
| `chat.bsky.convo.getConvoForMembers` | Starting a conversation |
| `chat.bsky.convo.getMessages` | Message history, with pagination |
| `chat.bsky.convo.sendMessage` | Sending text and post embeds |
| `chat.bsky.convo.updateRead` | Marking a conversation read |
| `chat.bsky.convo.acceptConvo` | Accepting a chat request |
| `chat.bsky.convo.muteConvo` | Muting a conversation |
| `chat.bsky.convo.unmuteConvo` | Unmuting a conversation |
| `chat.bsky.convo.leaveConvo` | Leaving a conversation |
| `chat.bsky.convo.getConvoMembers` | Full member list for owner checks and member management |
| `chat.bsky.convo.lockConvo` | Locking a group owner controls |
| `chat.bsky.convo.unlockConvo` | Unlocking a group owner controls |
| `chat.bsky.convo.addReaction` | Adding a message reaction |
| `chat.bsky.convo.removeReaction` | Removing your own message reaction |
| `chat.bsky.convo.deleteMessageForSelf` | Deleting a message from your own view |
| `chat.bsky.convo.updateAllRead` | Marking all conversations and requests read |
| `chat.bsky.group.createGroup` | Creating a group conversation |
| `chat.bsky.group.addMembers` | Adding members to a group |
| `chat.bsky.group.removeMembers` | Removing members from a group |
| `chat.bsky.group.editGroup` | Editing a group name |
| `chat.bsky.group.createJoinLink` | Creating a group invite link |
| `chat.bsky.group.editJoinLink` | Editing invite-link rules |
| `chat.bsky.group.enableJoinLink` | Enabling a group invite link |
| `chat.bsky.group.disableJoinLink` | Disabling a group invite link |
| `chat.bsky.group.listJoinRequests` | Reviewing pending join requests |
| `chat.bsky.group.approveJoinRequest` | Approving a join request |
| `chat.bsky.group.rejectJoinRequest` | Rejecting a join request |
| `chat.bsky.group.updateJoinRequestsRead` | Marking join requests read |
| `chat.bsky.group.requestJoin` | Joining by invite code |
| `chat.bsky.group.withdrawJoinRequest` | Withdrawing a pending join request |
| `chat.bsky.group.getJoinLinkPreviews` | Previewing a group before asking to join |
| `chat.bsky.notification.getPreferences` | Reading chat notification preferences |
| `chat.bsky.notification.putPreferences` | Saving chat notification preferences |

Resolving a shared post's CID uses the already-authorised AppView
`app.bsky.feed.getPostThread` call; no extra scope is needed for post embeds.
Balla does not store message content and does not log it.

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

- `blob:*/*` — only `image/jpeg` and `text/vtt` are requested. Profile and post
  photos are converted to JPEG; captions are WebVTT files.
- Account, email, 2FA and app-password scopes — account lifecycle and security
  are PDS/provider operations. Balla links to the provider controls instead of
  showing inert toggles.
- Feed-generator creation and editing scopes — Balla reads custom feeds and
  writes saved-feed preferences through the AppView, and only sends feedback to
  an existing generator through `sendInteractions`; it does not create or edit
  generators. Threadgate, postgate, verification, live-status and
  activity-privacy writes use their own narrow repository scopes above.
- A broad `include:chat.bsky.authFullClient` permission set — chat uses only the
  thirty-six narrow RPCs above, never the full-client grant.
- `transition:*` and broad wildcards.

## Re-authorisation

The client metadata has widened over time for profile editing, saved feeds and
the moderation inbox while staying granular. Sessions authorised before any of
those changes keep their old grant and must re-authorise before the new
profile/link/blob, list, saved-feed, inbox, starter-pack or chat-group scopes are available.
Sessions authorised before Events need that re-authorisation before the first
`community.lexicon.calendar.rsvp` write; reading event records is public and
needs no permission.
Sessions authorised before 0.20.0 need that re-authorisation before starter-pack
deletion is accepted. Sessions authorised before 0.19.0 need it before threadgate,
postgate, verification, live-status, activity-privacy, activity-subscription,
generator-feedback or account-draft (`app.bsky.draft.*`) calls are accepted.
Signing out and back in requests the current scope. Sessions authorised before
0.13.0 need that re-authorisation before starter-pack creation or editing works;
the editor says so rather than hiding the failure. Sessions authorised before
chat was added need to re-authorise before messages work, because the chat
service is a different audience from the AppView. The consent screen should
show the collection and RPC list above, not “access to nearly everything”.

## Caveat

The inventory is based on every `agent.*` call in `src/`. If a future feature
adds a collection or endpoint, add its scope in the same change and document the
re-authorisation step. Do not restore a wildcard to avoid updating this list.
