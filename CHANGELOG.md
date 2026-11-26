# Changelog

Versions follow the app version in `package.json`, `app.json` and the native
Info.plist. Each release is tagged `vX.Y.Z` on `main`.

## 0.97.4

- **The preview's `?screen=` links work again.** Since web addresses arrived in 0.5.0, the navigator rewrote the address before the mock preview read the query, so every `?screen=` link stayed on Home. The query is now read once at load, and the two starter pack screens are given a fixture to open. This affects preview builds only.
- The default moderation service ID is written in one place; the moderation and preview modules now read it from the service host facts.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. Every `?screen=` value was opened on a mock-data web export in Chrome.

## 0.97.3

- **Warning tints and sheet backdrops follow the theme.** The translucent fills behind error, danger, warning and success text used fixed light-theme colours in every theme; they are now derived from the palette. Sheets and dialogs dim the page with the palette's overlay, which is darker in dark themes (65% rather than 45 to 50%) and 45% in light ones.
- Controls drawn over photos and video keep their fixed dark scrim.
- **Expo packages follow the SDK's current versions:** `expo` 58.0.26 to 58.1.0, `expo-dev-client` 58.0.21 to 58.0.22 and `expo-file-system` 58.0.14 to 58.0.15, with their transitive updates. React and React Native are unchanged. A native build needs its pods installed again.
- No new scope, direct dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. Text contrast and one dark-theme dialog were checked on a mock-data web export in Chrome. iOS and Android were not run.

## 0.97.2

- **Status colours and links meet 4.5:1 contrast on cards and the page behind them.** In the default dim theme, Delete and Sign out text read at about 3.1:1 on cards, and the default light theme's green counts at 3.3:1. Accent, danger, green and secondary colours are published unchanged where they already pass, and otherwise shifted to the nearest shade that does.
- **Visible changes.** The largest is dark-theme danger in News Feed, Timeline and New Facebook, which goes from `#F02849` to `#F56D83` in dim (`#F3536D` in dark); solid red buttons there now carry dark ink. In light themes the New Facebook green goes from `#31A24C` to `#267E3B`, the default blue from `#0866FF` to `#0862F5`, and Thefacebook's darker canvas takes the default blue to `#0758DB`.
- **Labels on solid red buttons pick their own ink.** Several used the accent's label colour or a fixed white.
- **No faded message times,** and the decorative letter on a profile with no banner is hidden from screen readers.
- Not covered: accent, danger and green text on the deeper “soft” chip surface still falls below 4.5:1 in some theme pairs, as low as 4.1:1 in light themes and 3.3:1 in dark ones. The translucent red tints behind some warnings still use fixed values.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. Theme pairs are checked by test; text on screen was measured in the default theme, light and dim, on a mock-data web export in Chrome. iOS and Android were not run.

## 0.97.1

- **Switches look like switches.** The 44pt target had been applied to the track itself, so the switches drew as circles or near-circles. One shared switch now draws a 52 by 30 track inside a separate 44pt target. Settings, notification and chat notification screens use it (replacing the platform switch on the chat screen), as does “Require my approval” on a group invite link, which was a chip with a tick.
- **Correction:** 0.97.0 made the per-category notification switches worse. It raised the notification track from 52 by 32 to 52 by 44, which drew a near-circle, and its 64 by 44 shared settings track was still too round, so its line saying that switch now looks like one did not hold.
- The off state is a solid grey track with the knob at the left, readable in light and dark.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. Every switch was measured on a mock-data web export in Chrome in light and dark, using a temporary preview stub for the notification preferences screen. iOS and Android were not run.

## 0.97.0

- **Bottom tab labels are readable again.** In the phone-width web client every label under the bottom bar was clipped to part of its height. The height model left out React Navigation's own item padding and 28pt icon slot, so the bar now pads 4pt below instead of 10pt and grows from that measured budget at large font scales. The default height is still 64pt.
- **Correction:** the 0.60.5 line saying a scaled-up tab label stays whole (#190) did not hold, because its test checked the same incomplete arithmetic as the code.
- **Controls under 44pt are enlarged.** The web header's back control was a 30px square announced as “Tabs, back”; it is now a 44pt button labelled “Back”, and on iOS the back title can now name the tab it returns to rather than “Tabs” (not run on a device). Also enlarged: message actions, the composer's Drafts button, the feed report button, both “who liked this” links, pronoun suggestions, Add interest, the adult-content and notification switches, the narrow “All” filters in Notifications and the moderation inbox, and the search field.
- **The shared settings switch now looks like one.** It drew a 44pt circle with the knob barely moving; it is now a wider pill.
- **The signed-in profile's tab row wraps** instead of running off a 360px screen.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. Sizes were measured on a mock-data web export in Chrome, except the notification preference switches, which the preview does not render and which are a style change only. iOS and Android were not run.

## 0.96.0

- **Web addresses open the screen they name.** On the web, every shared, bookmarked or reloaded address under `/app` opened Home, the address bar dropped `/app`, and reloading after moving around left the web client altogether. React Navigation reads `location.pathname` there and ignores `prefixes`, so the linking config now declares the `/app` base itself. A deep-linked screen also sits on top of Home, so it has a back button.
- **Correction:** the 0.5.0 line saying threads, profiles, lists, feeds and settings had shareable URLs under `/app` did not hold. The earlier tests checked the config's shape and never ran React Navigation's parser; new tests drive its real parser and serialiser.
- Reading addresses back exposed three cases that are handled with it: a new list reloads as a new list rather than as a list called `undefined`; a quote is kept out of the address, so reloading the composer shows no broken quote card (the quote has to be chosen again); and an information page takes its header from its topic, not from the link. A link also cannot supply a list's name or a profile's handle as a label, and moderation report and notice links accept only the moderation service the sign-in grant names.
- Native navigation is unchanged. No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check. A mock-data web export was also driven in Chrome: every configured path kept its address, and reload and back/forward behaved. No signed-in production session was tested.

## 0.95.0

- **The PDS-directory read now matches the documented deadline claim (#97/#100, partial).** The compliance matrix already said the OpenPDS directory and migration pre-flight were bounded, but `pdsDirectory.ts` still used raw unbounded `fetch`. A directory host that accepted a connection but never finished its body could leave either screen loading forever.
- The read now uses the one `readBoundedPublic()` core, sharing its deadline, abort signal and body rule with the other token-free public reads. A timeout or transport/HTTP failure returns `unavailable`, a malformed or unusable body returns `invalid`, and a good response still replaces the in-memory snapshot. Provider prose is never read, logged or shown.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for a token-free public read, not a verified independent-PDS sign-in, provider failover or a grant change.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.94.0

- **The pre-auth public reads are now bounded (#100/#97, partial).** Advanced → Hosting and the login check read a handle's well-known file, the public resolver, the DID document, `describeServer`, the protected-resource metadata and the authorization-server metadata with raw, unbounded `fetch`. A host that accepted a connection but never finished a body could leave the check spinning indefinitely.
- All six reads now go through the one `readBoundedPublic()` core, so they share its deadline, abort signal and body rule. A timeout, transport failure, HTTP error or malformed body fails closed to the same structured state as before — unresolved, no PDS, incompatible or no OAuth — with the existing fixed copy. Provider prose is still never read, logged or shown.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free public reads, not a verified independent-PDS sign-in, provider failover or a grant change.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.93.0

- **The Advanced → Chat DID-document read is now bounded (#97/#99, partial).** The chat service screen fetched `did:web:api.bsky.chat`'s public DID document with a raw, unbounded `fetch`. A host that accepted the request but never answered could leave the availability line on "Checking…" indefinitely.
- The read now goes through the shared bounded identity reader, so it uses the same deadline, abort signal and DID Accept type as every other public DID document. A timeout, HTTP error or malformed body fails closed to no advertisement claim; the real chat proxy probe still decides the visible state. Provider prose is never read, logged or shown.
- No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for a token-free public read, not provider failover, a grant change or an alternative AppView.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.92.0

- **The remaining token-free public reads are now bounded (#96/#97/#100, partial).** The direct PDS blob fallback and the user-initiated translation read still used raw, unbounded `fetch`. A PDS that accepted a connection but never finished the image bytes, or a translation service that never answered, could leave an image placeholder or the post/message menu waiting indefinitely.
- One `readBoundedPublic()` core now owns the deadline, abort signal and body read for every token-free public service. `fetchPublicJsonObject()` delegates to it, so JSON objects, JSON arrays (translation) and image bytes (blob fallback) share exactly one timing rule. Each caller still makes its own fail-closed decision and keeps its own fixed copy; structured HTTP status and parser failures stay separate, and provider prose is never read, logged, stored or shown.
- A timed-out blob keeps its placeholder, a timed-out translation reports a fixed message, and the earlier JSON readers behave exactly as before. No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free reads, not provider failover, a grant change or a verified independent-PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.91.1

- **The last raw public PDS JSON reads are now bounded too (#96/#97/#100, partial).** `teal.ts` and `reactions.ts` still fetched play and reaction records with raw, unbounded `fetch` against the PDS in a DID document. A PDS that accepted a connection but never completed it could leave a profile's play strip or a post's reaction chips waiting indefinitely. Both now use `fetchPublicJsonObject()`, so one helper owns the deadline, abort signal and structured-object rule for every public PDS JSON object read.
- A missing collection still ends a teal walk or an reactions page cleanly, a timeout fails closed to an empty strip or chip set, and each reader keeps its previous retry classification: reactions still forwards structured HTTP status to `readWithRetry`, while teal keeps its fixed non-retryable error. Provider prose is never read, logged, stored or shown.
- **Correction:** the 0.91.0 line saying the helper owned "every token-free JSON object read" was too broad — these two readers were not covered then. This release completes that claim. No new scope, dependency, grant or endpoint; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free public reads, not provider failover, a grant change or a verified independent-PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.91.0

- **Public PDS repository reads can no longer hang forever (#96/#97/#100, partial).** Events, Memories and the offline profile fallback used raw, unbounded `fetch` against the PDS advertised in a DID document. A PDS that accepted a connection but never completed it could leave an Events strip, an event card, the On this day card or a profile strip waiting indefinitely.
- One `fetchPublicJsonObject()` helper now owns the Events, Memories, offline-profile and DID-document JSON reads: the deadline, the abort signal and the "keep only a structured object" rule live in one place, and DID documents use the same reader with their own Accept type. A timeout fails closed — no events, an empty memories walk, no offline profile — instead of becoming a retry loop. HTTP status still reaches `readWithRetry` unchanged, so retry classification is exactly as before; network and body failures keep their previous fixed, non-retryable errors. Provider prose is never read, logged, stored or shown, and an empty URL makes no request.
- No new scope, dependency, grant or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free public reads, not provider failover, a grant change or a verified independent-PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.90.0

- **Public handle resolution can no longer hang forever (#96/#97/#100, partial).** The in-app handle→DID fallback called the native-first resolver without a deadline. A handle's own well-known host or the configured XRPC resolver could accept a request and never complete it, leaving sign-in pre-flight, the offline profile fallback, the creator byline and any loading card waiting indefinitely.
- One `resolveHandleWithDeadline()` helper now provides bounded handle resolution with the same `withDeadline` clock as the other public reads and passes its abort signal through to both the well-known read and the XRPC fallback. A timeout is an unavailable source, so the existing cached-handle fallback still applies; a structured resolver error still reaches the shared retry classifier. Provider prose is never read, logged, stored or shown, and an empty handle makes no request.
- No new scope, dependency, grant or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free identity reads, not provider failover, a grant change or a verified independent-PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.89.0

- **Public DID-document reads can no longer hang forever (#96/#97/#100, partial).** `identityResolver.ts` fetched `did:plc` directory documents and `did:web` documents with a raw, unbounded `fetch`. A directory host that accepted a connection but never completed it could stall sign-in pre-flight, the identity directory check, public profile fallback, events, reactions and memories reads indefinitely.
- One `fetchIdentityDocument()` helper now owns both routes. It shares the bounded `withDeadline` clock used by the other public probes, passes its abort signal to `fetch`, and keeps only a structured JSON object or null. A timeout is an unavailable source, so the existing fail-closed behaviour still applies: a cached document or the next configured source wins. Provider prose is never read, logged, stored or shown, and empty URLs make no request.
- No new scope, dependency, grant or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free identity reads, not provider failover, a grant change or a verified independent-PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.88.0

- **The public host check can no longer hang forever (#97/#100, partial).** Advanced → Hosting, the PDS directory and migration pre-flight all share `probeHost`, which was the only public probe still using a raw unbounded `fetch`. A host that accepted a connection but never answered left the check spinner running indefinitely. It now uses the same bounded `withDeadline` clock as the resolver, directory, places and AppView checks, and passes the abort signal to `fetch` so a real request is cancelled instead of left running.
- A timed-out host reports fixed Balla copy naming the address and asking the person to try again; HTTP status, structured facts and fail-closed classification are unchanged. Provider prose is never read, logged, stored or shown, and invalid input still makes no request.
- No new scope, dependency, grant or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is reliability for token-free public reads, not provider failover, a grant change or a verified independent PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.87.0

- **Saved public read hosts now honour explicit HTTPS ports (#97/#100, partial).** Advanced → Services accepted an explicit port when saving the handle resolver, did:plc directory or places host, but the identity document builders and resolver checks silently rejected that same host. A saved port-bearing directory therefore changed the setting without changing identity resolution or account pre-flight. One shared `normaliseHttpsOrigin()` rule now owns host acceptance for settings, configuration import/export, identity document reads, pre-flight and the public checks, so a self-hosted service on a non-default port is used everywhere or rejected everywhere.
- The rule keeps a valid port, canonicalises away an explicit `:443`, and still rejects paths, queries, fragments, embedded credentials, insecure schemes and whitespace. Deterministic tests cover URL builders, config round-trips, resolver and directory probes, account pre-flight and a source audit that prevents a second origin validator from reappearing. Provider prose is never read, logged, stored or shown.
- No new scope, dependency, grant or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is a correctness fix for token-free public read hosts, not provider failover, a grant change or a verified independent PDS login.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.86.0

- **Place results are bounded before they reach app state (#156, partial).** Every provider-supplied display field — name, category, group, subtype, country and matched name — now passes through one bounded, single-line cleaner: hidden controls and line breaks are removed, and each field is capped at 100 characters. An ATGeo origin is capped at 512 characters and still fails closed on whitespace or hidden controls, so a hostile or broken provider cannot put a huge string or a spoofing control into a row, an accessibility label, a browser link or the composer. The words Balla sends in `q` use the same bound.
- Deterministic hostile-field tests and static audits cover the parser, the query body and the typed-name insertion path. Ordinary non-ASCII place names are preserved.
- No new scope, dependency, grant, provider claim or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is parser hardening, not a granularity chooser, check-in record, place chip or per-media binding.

## 0.85.0

- **The last provider-message failure checks are now structured-only (#97/#34, partial).** List and starter-pack actions renew-session copy from HTTP status and allowlisted error codes; chat failures map only published chat codes plus status/rate-limit/offline signals; live-status compare-and-swap retries and missing-record deletion use exact `InvalidSwap` / `RecordNotFound` codes. Provider free-text `message` no longer changes any copy, retry or control flow in these paths. The shared failure model now owns the exact code allowlists, so retry classification, sign-in, labeler, video, moderation and report failures use one rule set.
- Hostile-string tests cover list, starter-pack, chat and live-status copy and control flow, including strings that previously matched by substring. Static audits assert those modules no longer read a message field or stringify the error. A chat error carrying only a message text now uses the honest unknown fallback rather than being guessed from prose.
- No new scope, dependency, grant, provider claim or endpoint change; scope count stays 112 and `oauth-client-metadata.json` is byte-identical. This is failure-copy hardening, not provider failover or a new backend.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.83.0

- **Configuration restore now shows a preview before writing (#97, partial).** Advanced → Services still validates a pasted `balla.services.v1` record with the same strict parser, but Preview configuration now lists only the four changeable values that would change — handle resolver, did:plc directory, places host and places search — using each effective host already shown in this screen. Nothing is written until Apply previewed configuration is pressed. Editing the record clears the preview; a malformed record changes nothing behind fixed Balla copy. Session facts, grant-bound service values, notes and every other field stay out of the preview.
- Scope count stays 112 and OAuth client metadata is byte-identical. No new dependency, provider claim, grant change or verified independent host.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.82.0

- **An exported service configuration can now be restored (#97, partial).** Advanced → Services keeps the existing local export and adds a visible paste field with an Import configuration button. The importer accepts only a valid `balla.services.v1` record, applies the three changeable public hosts and the places switch in one write, and ignores session facts, grant-bound service facts and every other field. A malformed record changes nothing and reports one fixed Balla message; no provider prose is shown, logged or stored. Changing the did:plc directory also clears its cached DID documents, matching the Save and Use default paths.
- This is not a provider picker or a grant change: AppView, chat, video and labeler remain grant-bound, the PDS remains DID-discovered, and no independent host was verified. No new dependency or OAuth scope; scope count stays 112 and OAuth client metadata is byte-identical.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.81.0

- **Every public service check now has a bounded deadline (#97/#99, partial).** The shared, injectable deadline first added for places now covers the handle resolver, did:plc directory, AppView check, video endpoint, chat DID document and Advanced → AppView health. A provider that accepts a request but never answers is aborted and reported in fixed Balla copy — "The service did not answer in time." — with measured latency instead of leaving Advanced busy or the health line stuck on Checking. Provider prose is never read, logged or displayed; tests inject the clock and signal so no real waiting is needed. No request shape, grant, provider switch, dependency or OAuth scope changes; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.80.0

- **A hung places provider now fails closed instead of spinning forever (#156, partial).** Both the composer's typed search and Advanced → Services' places check use one bounded, injectable deadline. On timeout the request is aborted, the picker shows fixed Balla copy saying the provider did not answer in time (while the typed name can still be used), and the Services check reports the same detail with a measured latency. No provider prose is read, logged or shown. No request shape, device position, place-pin record, dependency or OAuth scope changes; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.79.0

- **A failed place map link-out now says so on the results view (#156, partial).** The inline map button and the detail view share one browser-open handler, so a browser-open failure uses the same fixed copy in Balla's words instead of being swallowed. The error appears beside the results as an alert, is cleared on a new search or dismissal, and the name can still be added as plain text. No request, position, place-pin record, dependency or OAuth scope changes; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.78.0

- **Every place-details dismissal path steps back before closing the picker (#156, partial).** The backdrop and the header close control step back from the detail view to the search results before the picker can close. Escape, the visible Back to results control and Android hardware back already did so; all five now call one shared handler, so no path skips the results. Focus, copy, links and the validated-ID clipboard action are unchanged. No request, position, write, place-pin record, dependency or OAuth scope; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.77.0

- **The Facebook-era concept map is now a shipped document (#149).** `docs/facebook-translation.md` records the current state of every AT Protocol / Bluesky → Facebook-era surface: the children that have landed are marked shipped with their issue numbers, and Places stays explicitly **partial (#156)** because the pin lexicon is still a draft. The map keeps the dark-pattern prohibitions, the reasons the mu "spare ideas" were not taken, and the note that Advanced infrastructure remains partial. The public features page and the compliance matrix link the same canonical map. No new request, write, provider switch, dependency or OAuth scope; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.76.0

- **Android hardware back steps back from place details before closing the picker (#156, partial).** The modal's `onRequestClose` now uses the same step-back handler as web Escape and the visible Back to results control. On Android and Apple TV, one back press returns from the detail view to the results; a second closes the picker. Focus behaviour, copy and every other surface are unchanged. No request, position, place-pin write, dependency or OAuth scope; scope count stays 112.
- Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.75.0

- **The validated place ID is now copyable (#156, partial).** The detail view's visible 44pt Copy place ID control writes only the already-validated ATGeo URN to the device clipboard. A result with no valid ID gets no button; success and clipboard-failure copy are fixed and in Balla's words. No provider prose is read or displayed.
- No new request, position, place-pin write, dependency or OAuth scope; the clipboard package was already present. Scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.74.0

- **Place details respect keyboard and back navigation (#156, partial).** Escape now steps back from a result's detail view to the search results before it closes the picker. The visible Back to results control does the same, and focus returns to the picker's close control rather than being lost. The shared dialog hook already keeps the latest handler, so no remount or extra focus jump was added.
- This is an accessibility correction to the v0.73.0 detail view only. No request, provider prose, position, check-in record, place chip, new dependency or new OAuth scope; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.73.0

- **Place results now have an inspectable detail view (#156, partial).** The info button on each result opens a detail view inside the same sheet, with only the structured fields the provider actually published: type, category, group, subtype, provider class, country, matched name, match kind and the validated ATGeo place ID. Absent fields are omitted; coordinates, check-in counts, rank, popularity and provider prose never reach it.
- The detail view reuses the two verified link-outs: a public `org.atgeo.getPlace` record on the configured host and an OpenStreetMap name search that says it is not an exact match and sends no position. Both are visible 44pt buttons, a browser-open failure uses fixed Balla copy, and the typed name can still be added as plain text. No check-in record, place chip, granularity chooser, new request, new dependency or new OAuth scope; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.72.0

- **Provider-owned links now fail closed (#97, partial).** Account settings, privacy/security and account lifecycle read the signed-in session's real `resourceServer`. A `bsky.social` account keeps the existing canonical `bsky.app` controls; any other PDS leaves that link closed and shows a fixed message saying Balla cannot infer the provider's control-panel address. A failed browser open also uses the same session check, so no non-Bluesky account is told to visit `bsky.app`.
- The lifecycle confirmation now describes the account control generically instead of claiming Bluesky's panel for every provider. No URL, request, setting, grant or OAuth scope changes; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.71.0

- **A result's real place identity is inspectable (#156, partial).** A second 44pt button on each result opens the public `org.atgeo.getPlace` gazetteer record for that result's validated `origin` URN in the browser, on the configured places host. The URL is built in one fail-closed function from the same validated host and URN the search uses; Balla makes no request itself, reads no provider prose and sends no device position. A result without a valid URN, or a saved host that is not an https origin, gets no button.
- The ATGeo origin check is now shared by result parsing and the link builder, so both accept exactly the same URNs. No check-in record, place chip, new request, new dependency or new OAuth scope; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.70.0

- **Place results now carry honest provider detail (#156, partial).** The typed-search parser keeps the published `match` and `matched` fields alongside the existing structured fields, and one shared `placeResultDetail()` renders them as fixed Balla labels. An area marked `cityState` by the provider is labelled City rather than by its raw Overture subtype; a result found through another name says which name matched; an approximate match says so. No rank, rating, distance or check-in count is shown, and no provider prose is read or displayed.
- Same-named results now get distinct row keys, so two places with the same name no longer collapse into one rendered row. Still no check-in record, place chip, granularity choice, new request, new scope or dependency; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.69.0

- **One fail-closed places-host label (#156, partial).** The composer sheet and Advanced → Services now derive the displayed host from the same helper. A valid https origin appears with the same wording on both surfaces; an invalid saved value is described as invalid and never echoed, and an off state says the host is configured but unused. The sheet refreshes the label when it opens, after Search and when a configuration read fails.
- No request, provider prose, position, check-in record, chip, new scope or dependency is involved; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.68.0

- **The place picker now names its configured host (#156, partial).** When the sheet opens, it reads the saved places endpoint and shows only the validated https origin, for example `https://places.eurosky.tech`, with a visible pointer to Advanced → Services. An invalid saved host is named as invalid, never rendered as raw text; when Places is off, the label says the host is configured but unused. The same sanitised label refreshes when Search runs.
- No request, provider prose, position, check-in record, chip, new scope or dependency is involved; scope count stays 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.67.0

- **DID documents now have one did:web document URL builder (#97, partial).** `didWebDocumentUrl` lives with the service host facts and derives both published AppView and chat document URLs from those hosts. Account pre-flight, the Services checks, the AppView health check and identity resolution all use that one builder instead of assembling `/.well-known/did.json` locally. A path-bearing `did:web` identifier now resolves to its own `/path/did.json`, as the identity module already did; no request, grant or setting changes.
- A source scan prevents a second document-path literal from reappearing in app code, and the identity module re-exports the shared builder so existing callers keep one rule.
- This remains partial #97: read-only public checks, not provider failover, a picker or a grant change. No new OAuth scope or dependency; scope count stays 112, and no provider prose is read, logged or stored. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.66.0

- **Place results now have an honest map link-out (#156, partial).** Every result in the typed place-name picker has a visible 44pt map button that opens an OpenStreetMap name search in the browser. The button says it searches by name, is not an exact place match and sends no device position. One shared `openStreetMapSearchUrl` builder now serves both the picker and Events, so the link shape has one home.
- **Switching Places off now clears stale results in the open sheet.** The off state removes results already on screen as well as blocking new requests, so an off sheet cannot imply a search it did not make. No check-in record, chip, granularity choice, in-app map, new scope or dependency is involved; the scope count remains 112.
- No provider prose is read, logged or stored. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.65.0

- **Official Bluesky web links now have one home (#97, partial).** The `bsky.app` and `bsky.social` origins, control-panel paths and canonical profile/post/feed/list/starter-pack/invite shapes live in `src/lib/serviceHosts.ts` beside the protocol hosts. Every link-out derives from those builders, so no screen or model carries a second copy of a canonical URL. A deterministic source scan enforces that only `serviceHosts.ts` holds those literals; the single placeholder in the search filter remains an example, not a link.
- **The places provider default derives from the same host table.** `DEFAULT_PLACES_ENDPOINT` now comes from `SERVICE_HOSTS.places` instead of repeating the literal. This changes no URL, request, setting or OAuth grant: the scope count remains 112 and full #97 (grant-bound service changes) is still outstanding.
- No new OAuth scope or dependency; no provider prose is logged or stored. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.64.0

- **Places search can be switched off (#156, partial).** Advanced → Services has a visible, reversible Places search switch. Off stops every typed place request, including the Services check and the composer, keeps the configured host, and says plainly in the composer that search is off. The typed name still works as plain text. On restores the saved provider without a restart.
- The off state is persisted with the service configuration and recorded in the configuration export. No device position, check-in record, place chip or new OAuth scope is involved; the scope count remains 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.63.0

- **Group conversations now show every participant (#193).** The conversation header has a visible Participants button for groups. It opens a light sheet listing the complete roster from `chat.bsky.convo.getConvoMembers`, not the "important members" subset on `ConvoView`. Each name comes only from real member fields: display name, then `@handle`, then DID; the viewer is "You", an owner is labelled Owner. No membership is invented from a DID prefix, and no presence or ranking state is shown. A failed roster read falls back to the subset already on the conversation and the sheet says plainly when the list is unavailable, without blocking reading or sending.
- No new OAuth scope or dependency; the scope count remains 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.62.0

- **Group messages now name the sender (#193).** A message view carries only a sender DID, so Balla resolves it against the loaded conversation members and the `relatedProfiles` already returned by `getMessages`; incoming bubbles and the reply banner show that real name or `@handle`, and own messages stay "You". Chat-list group rows use the group name initial, and join-request rows use the group owner, instead of showing an arbitrary `members[0]`. An unresolvable sender stays unnamed rather than being given an invented identity. The full membership roster remains in conversation settings; no new chat scope was added.
- **The composer now has a typed place-name picker (#156, partial).** A visible "Add place name" control opens a light sheet where the person types a name and presses Search. The configured public places provider is queried with only `q` and `limit`: no device position, no nearby lookup. A result inserts its name as plain text at the cursor; the typed name can also be used directly as text.
- **Still no check-in record or place chip.** The `social.eurosky.place.pin` NSID is an unsettled draft, so Balla writes no repository record, stores no coordinate and renders no chip. Failure copy is fixed in Balla's words, and an unreachable or invalid provider leaves the typed name usable. No granularity chooser, per-media binding or map dependency.
- No new OAuth scope or dependency; the scope count remains 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.61.0

- **A configurable places provider is available for typed search (#156, partial).** Advanced → Services now has a places host, defaulting to `places.eurosky.tech`, that is persisted, reversible and covered by the configuration export. A visible test runs one public typed search and reports status, latency and the count of structured results from this device.
- **No position is transmitted.** Only a typed query is sent in the POST body: there is no nearby lookup, no `lat`/`lng` in the request, and response coordinates and check-in counts are discarded during parsing. The check-in record is still a draft whose NSID can change, so Balla writes no place records and renders no place chips yet. A provider that cannot be reached fails closed with a stated reason.
- **Why this is still partial #156.** There is no composer picker, granularity choice, sidecar write, chip rendering or per-media location yet. This is a token-free public read host, not a grant change or a second backend. No new OAuth scope or dependency; the scope count remains 112. Full gate: deterministic tests, typecheck, Expo deps, icons, audit, site build and diff check.

## 0.60.5

- **Tab labels are no longer clipped at large system text sizes (#190).** The bottom bar's height now follows the system font scale instead of a fixed 64pt: the 10pt tab label scales with the OS font, and the bar grows by exactly the scaled label's deficit plus a 2pt cushion, so every label is fully visible at every text size — the issue's "not clipped" option, with nothing hidden and no label opting out of OS font scaling. The bar keeps its unchanged 64pt height at and below normal scales, screen-reader labels still carry each tab's full name, and the height rule lives in `src/lib/layout.ts` with deterministic tests in `tests/navigationLayout.test.mjs`.
- CI's full gate passed: deterministic tests (764), typecheck, Expo dependency drift, advisory audit, icon sync and site build.

## 0.60.4

- **Reaction chips now read public community-lexicon records.** Post cards show a compact emoji and count row from `community.lexicon.interaction.reaction` records in the subject's repository, rendered beside the existing like count and absent when there are none. A visible 44pt reaction palette opens and closes with buttons and states plainly that reaction records are public. Moderation parity follows the card's existing gate; no new OAuth scope or dependency is added and the scope count remains 112. Writes remain deferred until the lexicon settles.
- CI's full gate passed: deterministic tests (761), typecheck, Expo dependency drift, advisory audit, icon sync and site build.

## 0.60.3

- **Default infrastructure now follows Eurosky where Eurosky operates the role.** Fresh installs use `api.eurosky.network` as the AppView and `eurosky.social` as the fallback/signup PDS, while handle resolution, chat, video, the labeler and `plc.directory` keep their existing defaults. Existing grants are honoured by reading the AppView audience from the session's token scope. Advanced → Services and AppView name Eurosky-operated versus Bluesky-fallback roles and state that an AppView outage is reported as unavailable rather than marking the whole app offline. Scope count remains 112; no new dependency.
- CI's full gate passed: deterministic tests (761), typecheck, Expo dependency drift, advisory audit, icon sync and site build.

## 0.60.2

- **Reply context now appears on every feed card.** Profile author and likes feeds and list feeds keep `feedViewPost.reply.parent` while mapping posts, so their cards name the parent instead of falling back to a generic line. Custom feeds preserve it too, while search results, bookmarks and quote lists use **“Replying to an earlier post”** from `record.reply.parent`. Threads keep their existing Reply and ancestor labels and opt out. No new reads, writes, OAuth scopes or dependencies; the scope count remains 112.
- CI's full gate passed: deterministic tests (761), typecheck, Expo dependency drift, advisory audit, icon sync and site build. The shared card's existing 320–1440px render checks cover the new line; no surface-specific layout was added.

## 0.60.1

- **The desktop right rail keeps its width.** It was stretching to 740px at 1440 and squeezing the reading column to 440px; it now stays at 300px and the feed returns to 680px. The 1300px layout gets the same fix; the 1000px layout is unchanged.
- **Home no longer shows a hydration-source banner.** Advanced → AppView now lists the grant-bound hydration source with its DID and says the timeline no longer repeats it. No new read, write or OAuth scope; the scope count remains 112.
- **Replies are labelled on Home.** Each reply card starts with "Replying to @handle", read from the parent post already in the feed response. A self-reply says "their earlier post"; a missing parent author says "an earlier post" rather than inventing a handle.
- CI's full gate passed: deterministic tests (759), typecheck, Expo dependency drift, advisory audit, icon sync and site build. Browser renders covered 320, 390, 820, 1000, 1300 and 1440 pixels, dark and light at 390, and 640, 844 and 1000 pixels of height; every capture had zero horizontal overflow and zero sub-44pt buttons. The rail measured 300px and the feed 680px at 1300 and 1440.

## 0.60.0

- **Discover now carries News bundles (#159).** Pick one of five topics — Politics, Climate, Culture, Technology or Sport — and a region (Global, UK, US or Europe), then review the exact publisher roster before anything is written. Confirming adds one ordinary Balla curation list with a public `app.bsky.graph.list` record and one `app.bsky.graph.listitem` per publisher in a single atomic `applyWrites`, so a failed write cannot leave a half-filled bundle. Every handle and DID in the compiled pack was resolved against the public AppView on 23 November 2026; the pack is validated at load and fails closed to an honest empty state.
- **The bundle is a list, not a follow.** No follow, like, repost, block, mute or feed preference is written, and Following and Home are unchanged. The picker says so beside the roster, and the roster names every account before the **Create bundle** button. An existing bundle is recognised by name and offered as **Open list** or **Remove bundle**; creation stays disabled until the list check succeeds, so Balla never writes a second copy. The list feed is newest-first like every other list; there is no ranking input, no new OAuth scope (112 tokens remain) and no new dependency.
- CI's full gate passed: deterministic tests (753), typecheck, Expo dependency drift, advisory audit, icon sync and site build. Mock browser checks covered the News picker, the Global-to-UK switch, the roster and the create success state at 320, 390, 820, 1000, 1300 and 1440 pixels, in dark and light at 390, and at 640, 844 and 1000 pixels of height. Every capture had zero horizontal overflow and zero sub-44pt buttons.

## 0.59.0

- **Feed discovery now has an opt-in For you shelf (#158).** fu is first, at `at://did:plc:ooensn4mr5mhznzypvxelfa3/app.bsky.feed.generator/fu` on `did:web:feed1.eurosky.network`, followed by any future curated entry. Each row names the operator, its published algorithm and a source link; **Subscribe** saves the feed and **Unsubscribe** removes it in one tap. The shelf says plainly that a third party selects and ranks those posts, that Balla ranks nothing, and that Following and Home stay chronological. It adds no ranking code, no feed injection, no notification and no OAuth scope.
- **Posts can now be edited once, honestly (#160).** This adopts option (c) from the issue: mu's shipped pattern rather than a new versioning lexicon. An edit is available only on your own post, only inside five minutes of `createdAt`, only once (a record with `updatedAt` never gets a second edit), and only for accounts at least seven days old. Those are client guardrails, not protocol rules, and the copy says so. The replacement is one atomic `com.atproto.repo.applyWrites` with a delete and a create at the same rkey, so the AT-URI, quote anchors and reply parents do not move. `updatedAt` and `originalText` sit outside the lexicon shape; the record remains a valid `app.bsky.feed.post` and other clients ignore the extra fields.
- **The cost is disclosed before the write.** The confirm step shows the original and edited text and states that editing recreates the post and resets likes, reposts and replies to zero. The **Edited** badge is a 44pt control beside the timestamp and opens both versions with their timestamps. Balla never quietly rewrites a post, and there is no unlimited or hidden edit. The write uses the already-granted `repo:app.bsky.feed.post?action=create&action=delete`; no scope count changes, no new dependency is added, and the screen reads through the existing thread seam.
- CI's full gate passed: deterministic tests (735), typecheck, Expo dependency drift, advisory audit, icon sync and site build. Mock browser checks covered Home, Feeds (shelf scrolled into view), Edit post and the Thread edit-history dialog at 320, 390, 820, 1000, 1300 and 1440 pixels, in dark and light at 390, and at 640 and 844 pixels of height. Every capture had zero horizontal overflow and zero sub-44pt buttons, and the shelf copy, editor guard, and history dialog were present at every size.

## 0.58.0

- **Public calendar events now appear on profiles and in posts (#157).** A profile Events strip appears only when the account has published `community.lexicon.calendar.event` records; a post shows an event when its raw record embeds an event strong reference. Both open a detail sheet with the published name, description, local-time window, mode, status, locations and links. Events come straight from the author's PDS with unauthenticated reads: no AppView view type, ranked feed or recommendation path is involved.
- **RSVP is one visible tap with change and remove controls.** Going, Interested and Not going write a public `community.lexicon.calendar.rsvp` record. Changing the choice updates the same record rather than adding another, using an existing rkey when present and a lexicon-valid TID for a new record. Remove deletes every matching RSVP. There are no reminders, notifications, tickets or follower actions, and every control is at least 44pt with a visible label.
- **One narrow permission is added.** The metadata gains `repo:community.lexicon.calendar.rsvp?action=create&action=update&action=delete` and now has **112 tokens**. Reading public events needs no permission; sessions authorised before 0.58.0 must sign out and back in once before writing an RSVP. The only added dependency is the official `@atproto/common-web` TID helper, already present transitively through `@atproto/api`.
- CI's full gate passed: deterministic tests (710), typecheck, Expo dependency drift, advisory audit, icon sync and site build. Browser checks covered Home, the profile Events strip and the event sheet at 320, 390, 820, 1000, 1300 and 1440, including 44pt RSVP controls, no horizontal overflow, change and remove, and an empty profile with no Events section.

## 0.57.0

- **Home can now show an opt-in On this day card (#152).** Following preferences gains a per-account, device-local toggle, off by default. When on, Balla reads the viewer's own `app.bsky.feed.post` records from their configured PDS with one bounded `listRecords` walk per launch day, cached per account. The card shows up to three compact posts from this local calendar date in earlier years, newest first, with the exact date and years in the copy; **See all** opens a Memories screen with the whole set, and every row opens Thread. Dismissal is remembered for the rest of the day.
- No AppView, engagement data, notifications, badges, writes or new OAuth scope are involved. Deleted records are excluded by the repository read, reposts are excluded by collection, and any read error, empty day or off toggle leaves Home exactly as it was. The bounded walk caps at 2,000 records and the Memories screen says when older posts are outside it. No new dependency; the scope count remains 111.
- CI's full gate passed: deterministic tests (697), typecheck, Expo dependency drift, advisory audit, icon sync and site build. Browser checks covered Home, Following preferences and Memories at 320, 390, 820, 1000, 1300 and 1440; the off state, dismiss persistence, See all and a memory tap into Thread were exercised.

## 0.56.0

- **Feed cards now preview the first direct reply (#155).** A compact row under the actions shows one reply's author, up to two lines of text, and **View all replies**. It is fetched only when FlashList reports the card viewable, with one depth-1 `getPostThread` read, at most two reads in flight, cancellation when the card leaves the viewport, and a 40-post session cache. The configured thread order chooses the reply; engagement ranking is never consulted. Label, mute, block, list-block and warning gates suppress the preview, the author opens their profile, and the Thread destination is the same as the comment button. A failed or offline read leaves the honest count-only row exactly as before.
- No new OAuth scope or dependency; the scope count remains 111. CI's full gate passed: deterministic tests, typecheck, Expo dependency drift, advisory audit, icon sync and site build. Browser checks covered the feed at 320, 390, 820, 1000, 1300 and 1440 pixels, and Thread at 390, 820 and 1440.

## 0.55.0

- **The desktop right rail now shows Recent activity (#154).** A fixed twelve-row card lists the newest replies and reposts from accounts you follow, built from the Following page already in memory. It adds no request, reads no likes and sends no notifications. Label, mute, block and snooze gates apply, and each row opens its thread. **Hide this card** writes only a device-local preference, reversible in Appearance, and the rail scrolls instead of pushing its other cards off screen.
- **Threads gain a wall-to-wall lens (#153).** The Thread menu lists the other visible authors only when you also appear in the thread; choosing one filters the already-fetched tree to exactly your posts and theirs, in rendered thread order. Third-party replies are excluded by author, not ranking, and the hidden-reply and moderation gates stay in place. The header says **Showing only you and @them**, announces the same statement to screen readers and keeps a visible **View full thread** exit. The lens adds no request, writes nothing, and leaves the composer and full conversation unchanged.
- No new OAuth scope or dependency; the scope count remains 111. CI's full gate passed: deterministic tests, typecheck, Expo dependency drift, advisory audit, icon sync and site build.

## 0.54.0

- **The Supporters card is the app's one support ask (#163), and creator attribution now covers every site footer (#162).** About shows a static card with one sentence, a 44pt **Support Balla** button and the shared `CreatorByline`. `SUPPORT_URL` lives once beside the service hosts and `CREATOR` derives the author's name, handle and links from it; no other source file repeats the URL. Settings no longer carries a second support row, and no feed, thread, profile, notification or chat surface links the page. Every site footer now carries the same byline and supporters block beside an AGPL-3.0 licence line.
- **Home gains a device-local 30-day snooze (#151).** The post menu and profile menu offer **Snooze for 30 days** beside mute and block; an active snooze becomes **End snooze** with an honest countdown (`Snoozed, 23 days left`). The record is keyed by DID and stored only in AsyncStorage: no PDS write, no XRPC call and no follow to another device. Following feed assembly skips the author's posts and reposts they performed, leaves order untouched and changes no other surface. Following preferences lists every active snooze with its remaining days and ends any of them in one tap.
- No new OAuth scope or dependency; the scope count remains 111. CI's full gate passed: deterministic tests, typecheck, Expo dependency drift, advisory audit, icon sync and site build.

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
