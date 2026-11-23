# Report handling and retention

Last updated: **21 November 2026**.

## What a report is

A report is an AT Protocol request sent from Balla to Bluesky’s moderation
labeler through `com.atproto.moderation.createReport`. It contains the reported
post strongRef, account repoRef or profile-link view, a reason category and
optional free-text detail.

Balla does not operate its own moderation queue. The labeler receives the report
and decides what happens next.

## Routing

- Post report: `com.atproto.repo.strongRef` with the post URI and CID.
- Account report: `com.atproto.admin.defs#repoRef` with the account DID.
- Profile-link report: `app.bsky.actor.defs#profileLinkView` with the link's URI,
  CID and URL, available only when the record has a strong ref.
- Transport: `atproto-proxy: did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler`.
- OAuth: the client requests the report audience for that labeler. Sessions
  authorised before 21 November 2026 need one fresh sign-in.
- The surrounding OAuth grant is now granular rather than `repo:*` and
  `rpc:*`; see `docs/oauth-scopes.md`. Existing sessions should re-authorise to
  receive the narrow grant.

## What Balla stores

Balla does not store reports, report IDs, decisions, notices, account standing or
appeals locally. It does not create a shadow report in a Balla database. The
request goes to the labeler, and the in-app inbox reads the labeler’s own record
through `tools.ozone.inbox.*`. Report receipts, decisions and appeal state remain
the moderation service’s records, not Balla’s.

The app does hold the current OAuth session and the last signed-in DID on the
device, as described in the privacy note.

## Public contact and ownership

The monitored public route is the repository issue tracker:

<https://github.com/ewanc26/balla/issues>

For a security or privacy report that should not be public, use GitHub’s private
advisory form:

<https://github.com/ewanc26/balla/security/advisories/new>

The project owner is responsible for triaging those routes. Reports about
content should still go through the in-app report flow so the labeler receives
the protocol-level report.

## Response process

1. Triage the public or private project report.
2. Reproduce a client defect or identify the affected protocol surface.
3. Route content reports to the labeler through the in-app flow; do not promise
   a moderation outcome Balla cannot enforce.
4. Fix, document and deploy client changes through the normal review path.
5. Close the project report with a summary unless doing so would disclose a
   security issue.

## Retention

Balla retains no report records. GitHub retains issue and advisory records under
its own policies. The labeler retains reports under Bluesky’s policies. Signing
out clears the local OAuth session and the remembered DID; posts and account
records remain on the PDS.

## Limits

- The moderation inbox, report decisions, notices and appeal state depend on the
  labeler’s `tools.ozone.inbox.*` service. If it is unavailable, Balla shows an
  error rather than inventing a status.
- No device push delivery is registered for report outcomes yet (#36).
- Balla cannot delete another account’s records or force a PDS to remove content.
