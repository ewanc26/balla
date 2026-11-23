# Moderation model

Last updated: **22 November 2026**.

Balla renders moderation before content reaches the user. It does not strip
labels after the fact or rely on a local block list.

## Label sources

- The Agent sends Bluesky’s moderation labeler
  (`did:plc:ar7c4by46qjdydhdevvrndac`) in the `atproto-accept-labelers` header
  on AppView requests by default, marked `;redact` by `@atproto/api`.
- `ModerationProvider` reads `agent.getPreferences()` after sign-in. It adds any
  subscribed labelers from those preferences to the request header and loads
  their custom label definitions with `agent.getLabelDefinitions()`.
- The rendering decisions come from `@atproto/api`’s `moderatePost`,
  `moderateProfile` and `moderateNotification` helpers. Balla does not maintain
  a second interpretation of label values.
- The Bluesky labeler remains in the list even when the user has no custom
  labeler subscriptions.

## Rendering rules

- `!hide` removes the content from list surfaces and sets `noOverride` in
  content views. There is no “show anyway” control.
- `!warn` shows a warning over the post body. The content is only rendered after
  the user chooses **Show anyway**, unless the label is non-overridable.
- Adult and media labels blur images separately from the post text. The user can
  reveal media only when the label permits it.
- Only a label whose preference is **Hide** (`filter`) removes a post or an
  account. A **Warn** label (`blur` or `alert`) keeps the author's name, handle
  and avatar visible and adds a labelled warning card with a visible **Show**
  control when the label permits it. A hidden profile shows a short explanation
  instead of pretending the account has no identity.
- Identity warnings use account/profile labels only; a content label still
  warns over the post body, not over the author's name.
- A list's `viewer.hidden` state is the user's own list setting, not a
  moderation label, and the UI says so.
- Notifications run through `moderateNotification`; hidden notifications are
  omitted from the list.
- Settings → Content filters edits the same Bluesky preferences the official
  client uses: subscribed labelers, per-label Show/Warn/Hide, the adult-content
  setting (behind an 18+ confirmation) and muted words/hashtags. Writes go to
  the PDS through `app.bsky.actor.putPreferences`, then reload the moderation
  context.
- Warning cards name the labeler that supplied each label. The default Bluesky
  labeler is always subscribed and is not removable from Balla; additional
  labelers can be added by handle or DID and removed again.
- Custom feed pages and list feeds render post labels through the shared
  PostCard. Generator-level labels are not rendered yet.

## Reports and enforcement

- Post reports send a strongRef to the Bluesky labeler through
  `com.atproto.moderation.createReport` and `atproto-proxy`.
- Account reports send a `com.atproto.admin.defs#repoRef` instead. Profile links
  with both a URI and CID use `app.bsky.actor.defs#profileLinkView`, carrying the
  URL as well as the record strong ref.
- Block and mute are server-side AppView/PDS operations. Repost-only muting uses
  the scoped actor mute with `onlyReposts: true`. Balla then removes the
  affected author from the current timeline, search, saved posts, profile and
  notification lists. A refresh still relies on the AppView enforcing the
  server state.
- Blocking a profile disables Follow in Balla and writes the AppView block
  record. Chat reports use the same block record, and the chat service enforces
  it; conversation mute state is read from the service.
- The OAuth metadata requests the Bluesky labeler report audience. Sessions
  authorised before 21 November 2026 need one fresh sign-in before reporting.

## Moderation inbox and appeals

- Settings → Moderation inbox reads the same Bluesky moderation service that
  receives reports. "Your reports" shows report status, public resolution and
  the reported post or account. "Your account" shows account standing,
  enforcement, notices and action history.
- Report and notice details load their record from `tools.ozone.inbox.getReport`
  or `getActionedSubject` using the labeler service audience. No local shadow
  report or invented decision is created.
- Opening a report or notice calls `updateSeen`; Settings shows the labeler’s
  unread count and refreshes it when the screen regains focus.
- Available appeals use `appealActionedSubject` with the action or account
  takedown reference supplied by the notice. A pending, approved, denied,
  superseded or expired appeal is shown from the service state.
- Policy links returned with moderation actions open externally. Content and
  account links open the relevant thread or profile inside Balla where possible.

## Limits

- Reports are sent to Bluesky’s labeler only, regardless of which labelers the
  user subscribes to for filtering.
- Balla does not store moderation decisions or report responses locally; the
  inbox is read from the service on demand.
- Device push notifications for inbox activity are not registered yet (#36).
