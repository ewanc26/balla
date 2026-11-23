# Changelog

Versions follow the app version in `package.json`, `app.json` and the native
Info.plist. Each release is tagged `vX.Y.Z` on `main`.

## 0.54.0

- **Balla now names its author, in the app and on the site (#162).** A single `CreatorByline` renders "Balla by Ewan Croft" and `@ewancroft.uk` in About, the Settings footer, the desktop rail and every marketing page. The handle resolves live and opens the author's profile inside Balla; the web profile is the fallback when resolution fails, so nothing is pinned to a DID or a PDS host.
- **The Supporters card is the only place Balla asks for support (#163).** It sits in About, links to ewancroft.uk/support and stops there. There is no support ask in a feed, thread, notification or chat, no analytics and no second copy of the URL: the support link lives once in `serviceHosts.ts`. The site footers carry the same static block beside the AGPL-3.0 licence line.
- No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.53.0

- **Image and video fallbacks now honour the configured did:plc directory (#97, partial).** When a post image or video has to be read straight from its author's PDS, Balla first resolves the author's DID document. That read still called the agent's default Bluesky `resolveDid` endpoint, so a saved directory host was ignored on the media path even after v0.50.0–v0.52.0 fixed the other public reads.
- **What changed.** The media fallback now reuses the same strategy-aware resolver as profiles and labeler lookups: it consults the configured, persisted did:plc directory (or `did:web` and the PDS, in strategy order), validates the DID and keeps the existing on-device cache. Independent-PDS media resolves without asking Bluesky, and a directory change applies on the next unresolved read. The blob bytes are still fetched directly from the PDS, never through the AppView proxy.
- **Why this is still partial #97.** This is a token-free public read path, not provider failover or a grant change. AppView, chat, video and labeler remain grant-bound, the PDS stays DID-discovered, and a cached DID document still wins under the default `auto` strategy. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.52.0

- **The configured handle resolver now applies to the in-app public handle fallback (#97, partial).** The resolver override was already used for sign-in and account pre-flight, but `resolveHandleToDid` — the offline profile path taken when the AppView cannot serve `getProfile` — still called the agent's default Bluesky XRPC endpoint. A changed resolver was therefore ignored precisely where it mattered most.
- **What changed.** That fallback now uses the shared native-first resolver: it reads the handle's own `/.well-known/atproto-did` first and falls back to the configured, persisted resolver endpoint on each lookup. Independent-PDS handles can resolve offline without asking Bluesky, and no restart or new sign-in is needed. The returned DID is still validated before it is cached. The identity strategy label no longer names a hardcoded `plc.directory` host.
- **Why this is still partial #97.** This remains a token-free public read path; AppView, chat, video and labeler are grant-bound facts, the PDS is DID-discovered, and this is not a provider switch or failover. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.51.0

- **Corrected an effective-immediately overclaim in the PLC directory setting (#97, partial).** v0.50.0 said a directory change took effect on the next read, but the default `auto` identity strategy returns a fresh cached `did:plc` document before consulting the directory. Changing the host therefore did not refresh identities already seen on this device.
- **What changed.** Saving or resetting a different PLC directory now forgets cached `did:plc` documents so the next read uses the configured host. Handle mappings and `did:web` documents are kept, so offline browsing still works and unrelated identities are not disturbed. A no-op save does not clear anything. The pure rule and its wiring are covered by regression tests.
- **Why this is still partial #97.** This is a token-free public read host; AppView, chat, video and labeler remain grant-bound facts, the PDS remains DID-discovered, and a directory that cannot serve known `did:plc` identities still fails those lookups until the default is restored. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.50.0

- **The public did:plc directory is now genuinely configurable (#97, partial).** Advanced → Services has an editable **PLC directory** host with **Save directory**, **Use default** and **Test directory** actions. The saved host is persisted on this device, reversible with one tap, and takes effect on the next read without a restart or a new sign-in. It is a distinct setting from the handle resolver: one resolves DNS-only handles before sign-in, the other reads `did:plc` DID documents.
- **The override is honoured where it matters.** Both `resolveDidDocument` (identity resolution and public profiles) and account pre-flight (both the Advanced screen and the login check) read the saved directory. The public test reads one known DID document from that host and checks its structured `id` field; only an https origin is accepted and provider error prose is never read or shown. The effective host and whether it is still the default are included in the configuration export.
- **The honest limit stays visible.** This is a public, token-free read host, so it needs no new scope and does not alter an existing grant. AppView, chat, video and labeler remain grant-bound facts, the account PDS remains DID-discovered, and a directory that cannot serve known `did:plc` identities will make those lookups fail until the default is restored (`did:web` identities are unaffected). This is not a completed #97 or a provider switch. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.49.0

- **Corrected an overclaim in the previous release.** v0.48.0's public copy said "Failure messages name no provider," but the shared error helper was only one of many failure paths; search, chat, moderation, video, feeds, link previews and the text-cap validation still named Bluesky as the culprit. Those technical failures now use fixed service-neutral labels across 24 strings in twelve modules. Factual provider references that say where data is stored or who made a moderation decision stay, because those are true and useful.
- **Why this matters beyond wording.** A failure attributed to "Bluesky" is wrong when the failing host is one the user configured, which is exactly the direction of #97/#99/#100. Service-neutral labels stay true regardless of which host answered. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.48.0

- **Failure messages no longer promise a wait the client will not honour.** A `Retry-After: 30` used to show "Try again in about 30 seconds" while `readWithRetry` actually retried after the 8-second cap. Now, when a service advertises a wait longer than the automatic backoff cap, the read stops and surfaces the error instead of retrying early. A short advertised wait is still honoured exactly (<a href="https://github.com/ewanc26/balla/issues/34">issue #34</a>).
- **Failure copy is service-neutral.** The shared helper is used across identity directories, PLC, PDS-adjacent and third-party hosts, so "Bluesky is limiting requests" and "Could not reach Bluesky" became "The service is limiting requests" and "Could not reach the service". No provider prose is read, logged or stored.
- **Public roadmap copy now matches what shipped.** The stale claim that a hydration-source label was unimplemented was removed; the service-check row includes the shipped labeler endpoint; the home roadmap lists the shipped checks and no longer labels error-state polish as in progress. Regression tests lock these in so the contradiction cannot return. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.47.0

- **The feed now names its hydration source (#99, partial).** A tappable label in the Home feed header shows the full AppView DID that hydrates the timeline. It reads the same audited service model as Advanced → AppView, and tapping it opens that screen's grant facts and public health check. The copy says exactly what it is: a fact fixed by this sign-in's OAuth grant, not a live check, a failover status or a freshness claim.
- **No provider choice was invented.** The label does not imply a picker or switch: AppView, chat, video and labeler audiences stay grant-bound, the PDS stays DID-discovered, and there is still no mirror, failover or per-function routing. The AppView screen and health copy were updated so nothing claims the label is a switch. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.46.0

- **Advanced → Services can now test the labeler endpoint (#97, partial).** A visible **Test labeler** action reuses the existing public `labelerProbe.ts`: it resolves the default moderation labeler's DID document, then makes one unauthenticated `com.atproto.label.queryLabels` canary call. The result reports HTTP status, latency and the endpoint from that DID document; provider prose is never read or shown.
- **The check says what it is not.** An empty labels array is a valid answer and proves only that the advertised endpoint answers from this device. It does not change which labels Balla applies, subscribe a labeler or grant any scope; the subscribed labelers are still managed in Content filters. No probe logic was duplicated.
- This completes the per-slot public test action for every service shown in Advanced → Services, but it is not a completed #97: AppView, chat, video and labeler remain grant-bound facts, the PDS remains DID-discovered, and only the handle resolver is changeable on this device. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.45.0

- **Account pre-flight now checks real OAuth capabilities (#100, partial).** Both Advanced → Account pre-flight and the login screen's pre-sign-in check read the authorization server's published fields and classify them against the ten capabilities Balla's public OAuth client needs: `code` response, authorization-code and refresh grants, S256 PKCE, public-client token auth, the `atproto` scope, issuer responses, a pushed-authorization endpoint, ES256 DPoP and client metadata document support.
- **An honest new result.** When advertised fields are missing, the check now returns **OAuth capabilities not advertised** and names only the missing capabilities using fixed labels — never provider prose. A server advertising all ten reports "10 of 10 advertised" on both surfaces. The optional `require_pushed_authorization_requests` hint is deliberately not required: a server may allow PAR without setting it.
- This is still not a verified independent-PDS login: no credentials are available for an end-to-end sign-in on a non-Bluesky host, so #100 stays open. Passing these public checks grants no scope, creates no account and does not make the provider's approval page succeed. There is no new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.44.0

- **Advanced → Services can now test the video endpoint (#97, partial).** A visible **Test video endpoint** button makes one unauthenticated GET to the published `app.bsky.video.getUploadLimits` XRPC method. The result reports HTTP status, latency and whether the endpoint is reachable; a `401` is a real, useful answer that proves the endpoint exists and that quota needs this sign-in's token. The response body is never parsed, so provider prose cannot surface.
- **Grant-bound services stay facts.** AppView, chat, video and labeler remain written into this sign-in's OAuth scope; this adds a read-only reachability check, not a provider picker or a repointed audience. The existing public labeler probe in Content filters is reused rather than duplicated, and the shared video lexicon constant now has one source.
- This is not a completed #97: changing those services still needs a new authorisation. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.43.0

- **The login screen can now check an account before sign-in (#100, partial).** Enter any handle or DID and use the visible **Check this account** button. Balla runs the same real public reads as Advanced → Account pre-flight: it resolves the identity from its own well-known file or the saved resolver, reads the DID document, follows `#atproto_pds`, and checks public `describeServer`, protected-resource and authorization-server metadata. The result shows the state, identity source, DID, PDS and authorization server; provider error prose is never read or shown.
- **The check says what it is not.** It does not sign in, create an account, grant a scope or guarantee that the provider's approval page will succeed. Sign-in still uses the provider's own OAuth approval page, and Balla remains OAuth-only with no app-password flow. Both pre-flight surfaces now share one set of result labels, so they cannot drift apart.
- This is not a verified independent-PDS login: end-to-end sign-in on a non-Bluesky host still needs credentials, so #100 stays open. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.42.0

- **Advanced → Services can now export a real configuration record (#97, partial).** A visible **Download service configuration** action (clipboard copy on native) writes the effective handle resolver, whether it is still the compiled default, every default service DID/audience and this sign-in's non-secret session metadata. The web download and native clipboard use the same local-only exporter as preferences; nothing is uploaded or logged.
- **The export says what it is not.** It contains no access token, refresh token, password or provider message text, and its notes state that only the resolver can be changed on this device, that grant-bound audiences need a new authorisation, and that the record is not an import or a credential. Signed-out sessions export with empty session facts rather than invented values.
- **Default hosts now have one auditable source.** `serviceHosts.ts` owns every default AT Protocol host; the services model, chat, video probe, identity directory and pre-flight derive from it. This removes duplicate host literals without changing any endpoint, so existing sessions keep working exactly as before.
- This is not a second backend, a provider picker or a completed #97: AppView, chat, video and labeler endpoints remain grant-bound facts, and changing any of them still needs reauthorisation. No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.41.0

- **Advanced → Account pre-flight adds a real pre-login check (#100, partial).** Enter another account's handle or DID; Balla resolves a handle from its own `/.well-known/atproto-did` first, falls back to the configured public XRPC resolver, reads the DID document from `plc.directory` or the `did:web` well-known path, and follows its `#atproto_pds` endpoint. It then checks `describeServer`, the PDS's `oauth-protected-resource` metadata and its authorization server's published metadata. Each step is a public, unauthenticated read with structured fields only.
- **The result distinguishes real failure modes.** An unresolved identity, absent PDS, non-AT-Protocol server and missing OAuth metadata are reported separately; provider error prose is never read, logged or shown. The screen says plainly that passing these checks is **not a login, an account creation or a grant**: sign-up approval and the OAuth consent page belong to the host.
- The host-only check in Advanced → Hosting and the OpenPDS directory remain unchanged. An end-to-end login with an independent account still cannot be verified without credentials, so #100 stays open. App passwords remain out of scope for this OAuth-only client.
- No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.40.0

- **Advanced → AppView adds a read-only public health check** (#99, partial). The new screen shows the grant-bound AppView DID and OAuth audience as facts, reads its public `did:web` document to find the advertised `#bsky_appview` endpoint, and — when signed in — runs one public profile canary for this account. Results report HTTP status and elapsed time from this device; no provider prose is read, logged or shown.
- **The screen states its limits.** The public reads expose no sync lag or feed freshness, so neither is invented. This build offers **no failover, no mirror or primary picker, no hydration-source label and no per-function routing**: those need a different OAuth audience and a new authorisation. #99 stays open until its acceptance test can serve feeds, threads and notifications from an alternative AppView.
- The public site now lists starter packs under Here today rather than Planned, and describes the shipped network backend seam and AppView health check without claiming either is a completed migration or a provider switch.
- No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.39.0

- **Advanced → Backend exposes a partial seam** (#98, partial). A typed contract covers all nine verb groups named in the issue — session, timeline, thread, notifications, profile, compose, media, moderation and search — with one registered AT Protocol adapter, the only registered backend in this build. The adapter resolves the live Agent binding when called, so session changes, the AppView proxy and preview-mode patches behave exactly as before.
- **Five read groups are genuinely routed.** Home timeline, generator and list feeds, thread hydration, notification and follow reads, profile and tab-post reads, and all Search/Discovery result reads now call the seam. Retry, pagination, failure copy and state handling stay in their existing screens; this is a mechanical refactor, not a behaviour change.
- **The screen states what is not routed.** Sign-in, compose/reply, media upload and moderation remain direct screen call sites, and the inventory says so. It is not a completed migration, a second backend, a bridge or an identity-mapping tool; no provider switch is offered. #98 stays open until every screen consumes the contract.
- No new OAuth scope or dependency; the scope count remains 111. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.38.0

- **The Standard.site reader now shows real social signals from people you follow** (#101, partial). A visible **Check followed accounts** action reads the granted follows list, then checks each followed account's own public PDS for `site.standard.graph.subscription`, `site.standard.graph.recommend` and their published Leaflet equivalents. Counts are exact AT-URI matches, deduplicated by account; a missing collection means no records on that server.
- The check is bounded to the first 20 accounts and the first page of each collection, and says so in the app. Unreadable accounts or collections are counted separately and excluded from matches rather than reported as zero. Only DIDs, counts and honest status notes are shown; provider message text is never read, logged or stored.
- There are still no subscribe or recommend writes: no graph writes are performed. Those need new `site.standard.authSocial` permissions Balla does not request, so the reader says plainly that the signals are public records rather than a network-wide total. No OAuth scope or dependency changed; the scope count remains 111.

## 0.37.0

- **Advanced → Account now offers a read-only migration pre-flight** (#104, partial). **Move to another PDS** shows the current DID, PDS, authorization server and scope count, then lets the user filter the public OpenPDS host directory and run a real `com.atproto.server.describeServer` check on a listed or custom destination. Host details are third-party or server-published facts, not a promise of sign-up or a migration result.
- **Preferences export is real but local.** The screen reads `app.bsky.actor.getPreferences` through the existing AppView scope, reports only the number of entries and their type names, and exports the raw JSON on request: a browser download on web, clipboard copy on native. Inventory copy never reads or renders preference values, and Balla never uploads the export.
- The screen names the operations a full move requires — destination account creation, repo export/import, blob inventory, status checks, PLC identity changes and account activation — and explains that none are in this OAuth grant. There is deliberately **no move button**. Links open the authoritative AT Protocol guide, PDS safety notes, goat, PDS MOOVER and a first-person walkthrough; the operator's own approval page owns any actual migration.
- No new OAuth scope or dependency; the scope count remains 111. Full in-app migration, session re-binding and post-migration verification remain open in #104.

## 0.36.0

- **Advanced → Media now reads the video service quota live** (#102, partial). The new Video service section shows the DID and endpoint fixed in this sign-in's OAuth grant and offers **Check video quota**. That button mints a short-lived service token for `app.bsky.video.getUploadLimits`, then displays only the lexicon's `canUpload`, `remainingDailyVideos` and `remainingDailyBytes`. Nothing is claimed before the service answers; a failed or CORS-blocked read is reported as unreadable, never as zero.
- The composer upload path uses the same quota model. If the service refuses uploads, has no daily videos left, or publishes fewer remaining bytes than the chosen file, Balla stops before sending any video bytes. The local MP4/GIF, duration and caption checks stay separate; daily limits come from the service, not a hardcoded Bluesky figure.
- Provider prose is never read, logged or stored in this path: failures are classified from HTTP status and the structured response shape. The endpoint and audience remain grant-bound, so **no fake side-car field** is offered; changing them needs reauthorisation. The section links to AT Protocol's video-handling guide and Streamplace as an alternative host. Full endpoint switching, PDS-advertised side-cars and non-Bluesky playback remain open in #102.
- No new OAuth scope or dependency; the scope count remains 111.

## 0.35.0

- **Advanced → Moderation now measures third-party labelers directly** (#95). Each subscribed service still shows whether the AppView lists it, but that is labelled as exactly that; a separate line now performs a real public-endpoint check: it resolves the labeler DID, reads its `#atproto_labeler` endpoint and runs one unauthenticated `com.atproto.label.queryLabels` canary query. Results show HTTP status and latency, or say plainly that the endpoint could not be reached from this device.
- Adding a labeler no longer depends solely on the AppView's list. An arbitrary DID is accepted when the AppView lists it **or** its own DID document advertises a labeler that answers the public query; **Check labeler endpoints again** re-runs the check. A blocked CORS request on web is reported as unmeasured, never as proof that the service is down.
- The public label API does not expose queue lag or a service-side mute state, so Balla says so in the section rather than inventing either. Local filters, reports and subscribed-label preferences still write and render exactly as before.
- No new OAuth scope or dependency; the scope count remains 111. Provider error text is never read, logged or displayed; failures are classified from HTTP status and structured fields only.

## 0.34.0

- **Published articles now open in Balla as a read-only Standard.site reader** (#101). Bluesky's enhanced external card publishes a `source` publication, `associatedRefs` strong refs, `createdAt`/`updatedAt` and `readingTime`; the card shows the publication name, author, date and reading time, and opens a dedicated screen. Plain link cards keep their existing browser behaviour, so nothing is inferred from a URL.
- The reader reads `site.standard.document` and its `site.standard.publication` from the author's PDS with unauthenticated `com.atproto.repo.getRecord`; the AppView does not serve these records. DID documents decide the PDS, the canonical URL comes only from the publication URL plus the document path, and domain verification compares the published well-known AT-URI with the record. Failures are classified from HTTP status and XRPC error codes only; no provider message text is read or stored.
- Real structured blocks render with the app's palette and font scaling: headings, paragraphs with UTF-8 facet links, quotes, lists, rules, images by CID from the author's PDS, and embedded post links. Publication colours appear as labelled swatches only. Galleries, tables, videos, questions, polls and other rich blocks show an explicit **not rendered** label; long records are labelled as shortened rather than silently truncated. The reader says plainly that subscribe, recommend and comment writes need new permissions Balla does not request here, and comments live in the linked Bluesky post.
- No new OAuth scope or dependency; the scope count remains 111. A registered native screen and web path (`standard-site/:uri`) make the view shareable. Add deterministic model, loader and wiring tests for real record shapes, strong refs, canonical URLs, verification, honest fallbacks and no message text.

## 0.33.0

- **Advanced → Hosting → Browse PDS hosts** reads the public OpenPDS index in the app (#100). It lists hosts that advertise open registration with the index's own timestamps, user domains, country and sign-up fields, and says plainly that the list is third-party metadata rather than a health check or a promise of sign-up.
- Choose a listed host or enter a custom HTTPS host. Both paths run the existing read-only `com.atproto.server.describeServer` check and hand the chosen URL to the existing OAuth sign-in, where the host serves its own approval page. The index refresh is explicit; a failed refresh never replaces a good snapshot and a stale report is labelled.
- No new OAuth scope or dependency; the scope count remains 111. App-password sign-in is deliberately not added: Balla uses OAuth only and treats passwords as provider-owned.

## 0.32.0

- **Advanced → Services** centralises service defaults in one typed module and separates what Balla can honestly change from what its OAuth grant fixes. The pre-authorisation XRPC handle resolver is now a real, persisted choice: edit the host, **Save resolver**, **Use default** and **Test resolver** all take effect on the next sign-in without a restart and never touch an existing session. The native well-known resolver still runs first, so an independent handle does not need this fallback at all.
- Real read-only connection checks: **Test resolver** resolves a public handle through the configured host, **Test AppView** reads the AppView DID document and (when signed in) a public profile, and **Test chat service** checks the chat service DID document. Results show HTTP status and latency; no provider message text is read or stored.
- **Grant-bound** AppView, chat, video and labeler audiences are shown as facts, not inert switches: they are bound into this sign-in’s 111-token OAuth scope and changing them requires reauthorisation. The account PDS is shown as discovered from the DID document, and Hosting remains the place to inspect its real value.
- No new OAuth scope or dependency; the scope count remains 111.

## 0.31.0

- Sign-in now resolves a handle from that host’s own `/.well-known/atproto-did` file first, falling back to the configured XRPC resolver (#100). An account on an independent PDS no longer needs Bluesky’s resolver to sign in; DNS-published handles keep working through the fallback. The DID document still decides the account’s PDS, so a handle suffix never implies a Bluesky host.
- **Advanced → Hosting** shows this account’s real DID, handle, resource server (PDS), authorization server and granted token count, and runs a read-only `com.atproto.server.describeServer` check against any host or handle. The result reports the server DID, advertised user domains, invite and phone requirements. Only HTTP status and structured fields are classified; no provider message text is read or stored.
- The screen links out to the Open PDS directory and handle-resolution docs. It states honestly that AppView, chat and video audiences are part of the OAuth grant and need new authorisation to change, rather than offering inert endpoint overrides.
- No new OAuth scope or dependency; the scope count remains 111.

## 0.30.0

- Messages now degrade honestly on a host that does not run a chat service (#103). A failed chat read is classified from its XRPC error code and HTTP status only, so no message text or preview is ever read, logged or shown in a failure. Instead of a broken inbox with dead compose actions, Messages shows one readable explanation with **Check again** and a link-out explaining how chat services work.
- **Advanced → Chat** runs a real single-read proxy probe against this account's chat service and reports the result (reachable, unreachable, not advertised, not authorised, disabled, limited or unknown). It also shows the real proxy type, service DID, granted audience and whether the chat DID document advertises a service.
- No inert endpoint override: this session's chat permission is audience-bound to `did:web:api.bsky.chat#bsky_chat`, so pointing chat at another DID would need a new authorisation with different scopes. Balla says so in-app rather than faking a control.
- Every other screen stays independent of chat availability. No new OAuth scope or dependency; the scope count remains 111.

## 0.29.0

- Identity resolution now has a real on-device cache of DID documents and handle mappings, capped at 120 entries with a 24-hour freshness window (#96). Profiles seen before keep resolving when a directory is unreachable.
- **Advanced → Identity** offers four working strategies: Auto (DID's own method), Registry first, Web first and Local cache only. It shows the last lookup source, the saved-identity count, and a working Clear action. No new OAuth scope or dependency.
- When the AppView cannot load a profile, Balla resolves the identity from cache and reads `app.bsky.actor.profile` from the account's own PDS. The profile header states when identity came from the cache; avatars and banners use only CIDs from the raw record.
- Signing in again invalidates that account's cached DID document so a migrated PDS is resolved afresh. DID documents remain the source of truth for service endpoints; a handle suffix never implies a Bluesky host.
- The read-only teal.fm integration shares the same strategy-aware resolver as profile and post identity reads.

## 0.28.0

- Post images now fall back to the author's PDS when the AppView-hosted URL fails (#94). Raw-record blob refs supply the DID + CID; the DID document resolves the PDS and a public `com.atproto.sync.getBlob` read supplies the bytes. No new OAuth scope or dependency.
- **Advanced → Media** offers two real strategies: **Follow URL** (default, retry from PDS on failure) and **PDS origin first**. Both use the same honest fallback; no fabricated CID from a CDN URL, and no inert metered-network toggle.
- A bounded 8 MB in-memory image cache with a visible used/limit readout and a working **Clear image cache** action. Cache holds only decoded image bytes, never post text or credentials.
- Broken images now show an explicit **Image unavailable** tile instead of a blank rectangle. Link-card thumbnails and profile link icons remain third-party URLs with no PDS fallback, by design.
- The post-image upload path already capped images at 2 MB with a pre-upload error; no change was needed there.

## 0.27.1

- The message action sheet's visible label now reads **Copy message text**, matching the #111 acceptance wording and its accessibility label. No behaviour changed; message text is still never logged or stored by Balla.

## 0.27.0

- Settings gains a top-level **Advanced** submenu with a stable web path (`settings/advanced`), the home for infrastructure and provider choices that work today. It lists only controls that do something real; unfinished provider choices stay in their own tracked issues rather than appearing as inert rows.
- **Advanced → Moderation** opens Content filters at a new labeler services section. Each subscribed labeler now shows whether the AppView currently lists it, with a clear note that local rules and reports keep working when a service is unavailable. This states what the read actually measures rather than claiming a network health probe.
- The labeler section restates in-app that labels are advisory metadata from freely chosen services, that anyone can run one, and that local filters survive an outage. The existing add/remove flow subscribes only after checking the account really is a labeler.
- Add deterministic wiring tests for the Advanced screen, its navigation and web path, the labeler section deep-link and the honest per-service state. No dependency, OAuth scope or version-specific behaviour changed.

## 0.26.0

- Profiles with public teal.fm scrobbles now show a compact **Recently played** strip: a small horizontal row of track chips with the title, artist and real relative time. Tapping a chip opens a light detail sheet with the record's metadata and a link out to the profile on teal.fm; there is no player, no music tab and no listening stats.
- Both `fm.teal.feed.play` and the removed-but-still-present `fm.teal.alpha.feed.play` are read from the profile's own repository. The DID is resolved first so reads work against whichever PDS hosts that repository, and every read is bounded and retryable. Accounts with no plays see nothing new.
- Appearance gains one **Show recent plays** switch. It is on by default, stored on this device only, and hides the strip and skips the reads when off. Balla never writes to a teal collection and adds no OAuth scope or dependency.
- Add deterministic tests for both lexicon spellings, record normalisation, ordering, DID-document PDS extraction, the visibility toggle and the no-write/no-storage guard, plus a live read against a real PDS during development. No dependency or OAuth scope changed.

## 0.25.1

- Interaction settings now preserve existing `hiddenReplies` and `detachedEmbeddingUris` when saving reply or quote rules, so editing one gate can no longer silently undo a hidden reply or a detached quote.
- The inbox now asks the chat service for unread counts with `includeGroupChats: true`, so group conversations are included in the unread totals.
- Group join previews now read pending join requests from the preview's conversation rather than an invented shape, so the owner's count is real when the service supplies it and omitted otherwise.
- No dependency or OAuth scope changed.

## 0.25.0

- Appearance now offers a **Dark theme** choice with **Dim** and **Dark** when the resolved scheme is dark. Dim lifts the era dark surfaces and accent towards white while keeping the published text and accent-soft tokens, and the choice is stored on this device only. Light mode is unchanged.
- Message actions now offer visible **Copy text** and **Translate** controls for messages that contain text. Copy writes the exact message text to the clipboard with a visible notice; Translate uses the primary language and offers **Show original** / **Show translation**. Embed-only messages do not show the controls, and Balla still does not log or store message text.
- Fix delete-for-self using the conversation id from the route instead of a field on the message. No dependency or OAuth scope changed.

## 0.24.0

- The post overflow now has **Mute words & tags** immediately after Mute thread. It opens Content filters with the muted-words section in view.
- Other people's profile menus now offer **Share via…**, **Copy link to profile**, **Hide reposts in feeds** / **Show reposts in feeds**, and **Report a link** when the profile has reportable link records. Sharing uses the canonical public profile URL with the existing native and browser clipboard fallbacks; repost muting uses `onlyReposts` on the real actor-mute RPC; link reports use the published `app.bsky.actor.defs#profileLinkView` subject and leave the usual local-only receipt.
- Add deterministic tests for profile URLs, menu wiring, scoped repost muting and link-report subjects. No dependency or OAuth scope changed.

## 0.23.3

- The CI job named "dependency audit" now actually audits published advisories
  with `npm audit --audit-level=moderate`, in addition to checking Expo SDK
  drift. A newly disclosed moderate or high advisory fails the CI gate until it
  is fixed or deliberately overridden.
- Extend the deterministic workflow test and update the README and contributing
  guide so the documented check matches the enforced one. No dependency or
  OAuth scope changed.

## 0.23.2

- Clear both open lockfile advisories with pinned transitive overrides:
  minimatch 11.0.9 and zod 4.6.6. `npm audit` now reports zero vulnerabilities.
- Add deterministic tests that verify the patched versions in the committed
  lockfile and exercise the installed zod against real AT Protocol records, so
  an upstream regression cannot pass CI silently. No OAuth scope changed.

## 0.23.1

- CI now runs the deterministic test suite and the static-site build on every
  push and pull request, in addition to typechecking, Expo dependency drift and
  icon sync. All install steps use `npm ci` so a green check is tied to the
  committed lockfile.
- Add a deterministic workflow test and update the contributing guide and README
  so the documented checks match the enforced ones. No dependency or OAuth
  scope changed.

## 0.23.0

- Curation list feeds can now be pinned to Home through the published saved-feed
  preference (`type: 'list'`). Pinned list feeds appear in Switch feed with the
  real list name and creator, load through `app.bsky.feed.getListFeed`, and can
  be reordered or removed in the Feeds screen. Following remains first and
  chronological; this adds a separate destination, not ranking.
- The Feeds screen now manages generator feeds and list feeds together. List
  metadata comes from `app.bsky.graph.getList`; no OAuth scope changed.

## 0.22.1

- Both composers now enforce the published `app.bsky.feed.post` text caps: 300
  graphemes and 3,000 UTF-8 bytes. The main composer previously checked only
  graphemes; the reply composer checked neither. Both show a live grapheme
  counter, report the byte cap honestly, and disable Post/Reply before an
  invalid request is sent. Text is never truncated or rewritten.
- Add a shared text-measurement helper and deterministic tests for ASCII,
  grapheme and byte boundaries, including emoji-heavy text that fits the
  grapheme cap but not the byte cap. No OAuth scope or dependency changed.

## 0.22.0

- Thread replies now write real rich-text facets for links, hashtags and
  mentions, using the same detector and unresolved-mention filter as new posts.
  A reply's facets are generated from the trimmed reply text and sent with the
  `agent.post` call; an unresolvable mention stays plain text rather than being
  stored with an empty DID.
- The reply composer now offers the same inline mention suggestions as the main
  composer. Picker state lives in one shared hook used by both screens, so
  debouncing, stale-response protection and loading, empty and failure states
  cannot drift. No OAuth scope or dependency changed; the AppView scope remains
  111 tokens.
- Add deterministic tests for reply facets and shared picker wiring, and update
  the README, current-state, compliance note, reference inventory and site copy.

## 0.21.0

- The composer now suggests matching accounts while a mention is typed.
  Suggestions appear after `@` and two characters, wait 250 ms before searching,
  and use the already-authorised `app.bsky.actor.searchActors` AppView call.
  Choosing a result replaces the whole token with the canonical handle and
  preserves surrounding whitespace and punctuation. Email-like text and range
  selections do not trigger the picker.
- The picker shows explicit loading, empty and failure states, uses 48pt rows and
  labels every result for assistive technology. No OAuth scope, dependency or
  automatic mention insertion was added; the AppView scope remains 111 tokens.
- Add deterministic tests for token detection, replacement, result filtering and
  composer wiring, and update the README, current-state, OAuth inventory,
  compliance note, reference inventory and site copy.

## 0.20.0

- New posts now carry real rich-text facets (`app.bsky.richtext.facet`) for
  links, hashtags and mentions. Mention handles are resolved through the official SDK
  rich-text detector; an unresolved handle stays plain text instead of being
  written with an empty DID. No OAuth scope or dependency changed.
- Starter packs can now be deleted by their owner from the pack page, after an
  explicit confirmation. Deletion removes the `app.bsky.graph.starterpack`
  record and the private reference list it owns, including list membership; a
  pack owned by another account is refused at the data layer. The confirmation
  says that links will stop working and the action cannot be undone.
- Add `action=delete` to the existing narrow
  `repo:app.bsky.graph.starterpack` scope. Sessions authorised before 0.20.0
  need one re-authorisation before they can delete a pack. No broad repo, RPC or
  blob scope was added.
- Add deterministic facet and deletion tests, and update the OAuth scope
  inventory, compliance note, reference inventory, README, site and
  current-state docs to match. No new dependency was added.

## 0.19.0

- Add account-level moderation and preference parity. Settings now reaches a
  blocked/muted-account manager backed by the published graph endpoints,
  default reply/quote settings, verification badge display and interests
  editors backed by real account preferences, and working Media and About
  pages. Verification badges now honour the stored hide preference and new
  posts start from the saved interaction defaults.
- Composer reply rules can now target a real list, chosen from the account's
  own `app.bsky.graph.list` records; an invalid or invented URI is never
  written. Hidden replies use the published threadgate `hiddenReplies` field:
  the root post author can hide or unhide a reply, the existing allow rules are
  preserved, and hidden replies render in an expandable section. No local-only
  hide is used.
- Feed generators can now be reported from their detail screen through the
  published `com.atproto.moderation.createReport` strong-ref path, using the
  same categories and local receipt flow as list reports.
- The post menu now exposes pin/unpin (a real strong ref on the profile record),
  thread mute/unmute through the graph service, and quote detach/reattach through
  the postgate `detachedEmbeddingUris` field. Detach preserves existing quote
  rules and only appears when the viewer owns the quoted post. No action stores
  a local-only state.
- Profiles now support temporary live status through the published
  `app.bsky.actor.status` record at rkey `self`: go live, edit the link and
  duration, and end it, with an optimistic-concurrency `swapRecord` write. An
  active status appears as a LIVE badge and link card on the profile, and the
  narrow repo write scope is included in the OAuth grant.
- Activity privacy is now a real account control: choose who may opt in to
  notifications for your activity (followers, mutuals or no one), stored in the
  published `app.bsky.notification.declaration` record at rkey `self` with its
  narrow OAuth write scope. It is reachable from Privacy and Security.
- Per-account activity notifications now match the official client: a bell on
  each profile opens a dialog to opt in to its posts and optionally its replies
  (replies never without posts), backed by the real `putActivitySubscription`
  RPC. Notification Settings lists and manages subscriptions through
  `listActivitySubscriptions`, with narrow AppView RPC scopes.
- Trusted verifiers can now issue and remove verification records from another
  account's menu through the published `app.bsky.graph.verification` lexicon,
  writing to and deleting from their own repo. The actions only appear for a
  verifier viewing someone else and update the profile on success.
- The post menu now offers "Hide post for me" and "Hide reply for me", stored
  in device-local persistence and merged into moderation prefs so the hide is
  applied by `@atproto/api` on every feed, thread, profile and search surface,
  including quoted posts. No report or server write is sent.
- The post menu now offers "Show more/less like this" for custom feeds that
  accept interactions. Feedback is sent through the published
  `app.bsky.feed.sendInteractions` call, routed to the feed generator's
  `bsky_fg` proxy with the post's `feedContext` and `reqId` preserved. The
  chronological Following timeline never sends ranking feedback.
- Profiles now have real tabbed feeds matching the official client: Posts,
  Replies, Media, Videos and (on your own profile) Likes. Each tab uses a
  published author-feed filter or the `getActorLikes` RPC; tab visibility
  follows the official rules, an invalid deep-linked tab falls back to Posts,
  and pinned posts appear only on the Posts tab.
- Feed generators and labelers can now be liked and unliked through the same
  `app.bsky.feed.like` record used for posts, with a "Liked by N users" link
  into the real `getLikes` list. Labeler likes resolve the service view through
  `getServices`; invalid strong refs are never written.
- The post menu now offers "Send via direct message": pick a recent chat or a
  person and the post is sent as an `app.bsky.embed.record` strong ref through
  the real `getConvoForMembers` and `sendMessage` chat RPCs. New 1:1 chats are
  resolved before sending; no message text is logged.
- External links now share one opener: the first HTTP(S) link asks whether to
  use the in-app browser or the system browser, remembers the choice in Content
  and media, and always leaves mailto, tel and SMS links with the system handler.
- Composer drafts can now be saved to the account's private Bluesky draft stash,
  listed from the composer, reopened, updated and deleted through the real
  `app.bsky.draft.*` AppView RPCs. Text, warnings, languages, interaction rules
  and quote/link refs survive; photos and videos remain device-bound.
- Settings now offers the official Light/Dark app icon choice. The selected
  icon is read back from the OS, Android confirms the restart, and the web
  screen explains that icon changes need the native app instead of throwing.
  Generated Balla assets and an Expo config plugin bake the Dark variant; the
  internal Bluesky+ icon set stays excluded.
- Add deterministic model and wiring tests for the new preferences, gate
  writes, hidden replies, feed feedback, navigation, profile tabs, object likes,
  share-via-chat and app icons, and update the compliance and reference docs to
  match. The release adds only narrow permissions: repository scopes for
  threadgates, postgates, verification records, live status and the
  activity-privacy declaration, AppView RPCs for listing/writing activity
  subscriptions and `getActorLikes`, and
  `rpc:app.bsky.feed.sendInteractions?aud=*` for proxied generator feedback. The
  only new dependency is the Expo 58-compatible `expo-alternate-app-icons` native
  module; sessions authorised before 0.19.0 need one re-authorisation for the
  new scopes. Device push delivery remains blocked on the self-hosted gateway
  (#36).

## 0.18.0

- Tapping a notification now opens the destination it belongs to: replies, mentions, quotes, likes and reposts still open the post's thread, and a follow now opens the actor's public profile instead of leaving the row inert. The target is chosen from ids only, by a deterministic model shared with new tests; unmapped reasons stay inert rather than inventing a link.
- Add deterministic notification target and wiring tests and update the README and AGENTS state to match. No OAuth scope, dependency or message-content handling changed. Device push delivery remains blocked on the self-hosted gateway and its credentials (#36).

## 0.17.0

- Extend Messages to the full group, embed and moderation surface. Create groups with named members, add/remove members, manage invite links with real join rules, preview a group before asking to join, and review approve/reject join requests with honest counts.
- Add replies and reactions to messages, delete-for-self, and post embeds alongside text. Conversation settings expose group name editing, membership, lock/unlock where the service allows it, and leave/mute controls; owner checks use the full member list and moderation-locked groups hide the lock toggle.
- Report a conversation or message to Bluesky's labeler through the open end of the `createReport` subject union — ids only, never message text — and block the actor from the same labelled sheet. Chat notification preferences are read and written through the chat service, separate from AppView alerts.
- Add `chat.bsky.convo.*`, `chat.bsky.group.*` and `chat.bsky.notification.*` RPCs as narrow scopes on the chat-service audience (36 chat RPCs, 98 tokens total). No broad chat set, wildcard or new dependency was added; sessions authorised before 0.17.0 need to sign in again for chat groups and preferences. Message content is never stored by Balla or written to a log.
- Add deterministic group/model and wiring tests, preview fixtures for every new screen, explicit web paths, and update the compliance, scope, reference, README, site copy and AGENTS state to match.

## 0.16.0

- Add private messages through Bluesky's chat service. The inbox lists conversations, real unread counts and chat requests; a conversation pages through message history, sends text and post embeds, and offers labelled mark-read, mute/unmute, accept-request and leave controls.
- Handle blocked people, disabled chat, locked/request conversations and group join requests with honest, content-free copy. The chat settings screen reports the real proxy audience and the "who can message you" value Bluesky exposes, and links to the provider control rather than faking a write.
- Route chat through `withProxy('bsky_chat', 'did:web:api.bsky.chat')` and add twelve narrow `rpc:chat.bsky.convo.*` scopes against the chat-service audience. No broad chat permission set, wildcard or new dependency was added. Sessions authorised before 0.16.0 need to sign in again once for chat.
- Message content is never stored by Balla and never written to a log. Add deterministic model and wiring tests; update the compliance, scope, reference, README, site copy and AGENTS state to match.

## 0.15.0

- Add explicit discovery surfaces without touching Following. Hashtag, topic and video pages use the already-authorized `app.bsky.feed.searchPostsV2` call with `hashtags`, `query` and `hasVideo` filters, sorted newest first and paginated; no new OAuth scope or dependency was added.
- Add an opt-in Discover page, reachable only from Search, that uses the same call with `sort: 'top'`. It is clearly labelled “Suggested · Ranked”, states that it is not based on who you follow, and never inserts anything into the chronological Following feed.
- Hashtags in posts now open their own newest-first page instead of the ranked search tab. All four pages have explicit web paths, back navigation, refresh, pagination, hidden-post cleanup and honest empty/error states.
- Add deterministic model and wiring tests covering param building, ranking labels, scope usage and navigation. Update the compliance doc, README, site copy and AGENTS state to match.

## 0.14.0

- Add multi-account support. Each account keeps its own OAuth session and DPoP keys in the on-device store, keyed by DID; Balla's local registry holds only the DID and any handle it was given.
- Add an Accounts screen under Settings with a labelled switch, add and remove flow. Switching restores the chosen DID into a fresh Agent and rebuilds the whole authenticated tree, so no cached post, feed, preference or session state carries over.
- Removing an account revokes its grant and deletes its tokens, leaves the other accounts signed in, and moves to a neighbour if the removed account was active. A grant that cannot be restored is removed from the list with an honest message instead of silently reusing a stale session. Signing out clears every account.
- Add model and wiring tests for registry parsing, handle validation, display labels, removal selection and the account-keyed remount. No new OAuth scope or dependency was added.

## 0.13.0

- Add explicit feed-save and share actions to starter-pack landing pages. Recommended feeds keep their open action and gain a labelled “Add feed”/“Saved feed” button that writes Balla's existing saved-feed preferences. Share uses Bluesky's official `/start/{name}/{rkey}` link from the real pack URI and creator handle or DID, and is withheld for blocked creators with an honest note.
- Add starter-pack creation and editing from the signed-in profile and from a pack Balla can prove you own. The editor picks people from the accounts you follow and feeds from your saved feeds, writes `app.bsky.graph.list`, `app.bsky.graph.listitem` and `app.bsky.graph.starterpack` records through real lexicons, and preserves the original `createdAt` when editing. It never offers edit for another account's pack.
- Add exactly one narrow OAuth scope, `repo:app.bsky.graph.starterpack?action=create&action=update`. Sessions authorised before 0.13.0 need to sign in again before starter-pack writes are permitted. No account, chat or email scope was added.
- Add deterministic model and wiring tests for URI parsing, share links, validation, record bodies, member diffs, the new screen path and the exact scope count. Offline preview fixtures cover the new editor without enabling mocks in production.

## 0.12.0

- Add an Account and security screen with the identity Balla can read (handle, DID and PDS), a real birthday editor using `setPersonalDetails`, and an automation-label toggle using the existing profile self-label write. Email, password and handle changes stay on the provider and say so plainly.
- Add a Privacy and security screen with the logged-out visibility self-label, the real notification-preference editor, and honest provider links for 2FA, app passwords, activity privacy and algorithmic recommendations. Those controls are outside Balla's OAuth grant, so no fake toggles are shown.
- Add a Session security screen showing non-secret OAuth metadata: DID, authorization server, PDS, expiry and scope count. Access and refresh tokens are never displayed.
- Share one confirmed sign-out flow between Settings and Session security. Signing out clears the local session, asks the server to revoke the grant, and never claims to delete the account.
- Reuse the existing account lifecycle screen for export, deactivation and deletion guidance rather than duplicating provider-only copy.

## 0.11.0

- Add System/Light/Dark and post text size controls in Appearance. Both are device-only choices; the resolved scheme now drives the palette, navigation chrome and status bar, and one shared scale sizes post and composer text.
- Add an Accessibility screen for the existing alt-text requirement and a new larger-description-badge option. Described images and video now show a visible ALT badge. Balla emits no haptics, so no inert haptics toggle is offered.
- Add language settings: a primary language used as the first composer language and as the translation target, and up to three content languages that hide tagged posts in Following. The interface remains English only; no UI translation is claimed.
- Add Following filters for replies, reposts and quote posts, and thread reply ordering (oldest, newest or most liked), written through `app.bsky.actor.setFeedViewPrefs`/`setThreadViewPrefs` and applied locally. Following stays chronological; visible toggles roll back when a write fails.
- Document what is deliberately absent: tree-view and external-media toggles would do nothing because Balla always nests replies and embeds no third-party players.

## 0.10.1

- Remove the remaining template patterns from the marketing site: eyebrow labels above every heading, symmetric feature-card grids, decorative window dots in the hero preview and a static “live” footer badge. Features and roadmap now read as vertical lists, matching the wall rather than a SaaS landing page.
- Replace the overbroad “any AT Protocol service host” claim with “services that expose the relevant lexicons”, and drop the marketing word “researched” from the preset descriptions.
- Document the anti-slop design constraints in `AGENTS.md` so later work does not reintroduce the same defaults.

## 0.10.0

- Add MP4 video and animated GIF posts. Files are selected with visible controls, checked locally against Balla's stated 100 MB and 10-minute limits, and sent to Bluesky's video service; the post is only publishable once the job reports `JOB_STATE_COMPLETED` with a blob. Processing states, failures and cancellation are named plainly, and converting a GIF is left to Bluesky rather than claiming a local transcode.
- Add optional WebVTT caption files (up to 20 per video, 20 kB each) using the published `app.bsky.embed.video#caption` shape. Captions use the post's first language, show that language in the composer, and can be removed before posting.
- Render published video views, including Bluesky's GIF presentation as a muted loop, with native controls and the author's alt text; posts with videos and quotes use the real `recordWithMedia` embed.
- Add exact OAuth scopes for the video service and caption blobs. Sessions created before 0.10.0 need sign-in again before video uploads are permitted; the upload error says so instead of guessing.

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
