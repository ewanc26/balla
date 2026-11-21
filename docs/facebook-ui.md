# Facebook UI reference

Research date: **20 November 2026**.

Balla borrows Facebook's reading surface, not its data model. The point is the
familiar shape — white chrome, a grey canvas, a centred feed of cards, a composer
at the top and a blue action language — while the account, graph and content
stay on Bluesky and the AT Protocol.

These are visual references only, not a claim of affiliation, endorsement,
partnership or official status with Meta or Facebook. Balla ships no Facebook
logos, wordmarks or other brand assets. Bluesky references identify the network
Balla connects to; Balla is not an official Bluesky client.

Facebook rolls its interface out gradually, so different accounts see different
variants. The patterns below are the stable parts of the current web and mobile
product, not a claim that every account looks identical.

## What Facebook looks like now

- **White chrome.** Facebook retired its blue top navigation bar in the 2020
  desktop redesign. Blue is now reserved for the wordmark, the active navigation
  item and primary actions. Dark mode keeps the same hierarchy with `#18191A`
  page and `#242526` card surfaces.
- **Three columns on wide screens.** Shortcuts sit on the left, the feed is a
  centred column of roughly 500–680px, and contacts or contextual cards sit on
  the right. Narrower windows drop the right column, then the left.
- **Card system.** The canvas is `#F0F2F5`; cards are white with an 8px radius,
  a hairline `#E4E6EB` border and a very light 1px shadow. Feed cards are
  separated by 8px of canvas.
- **Typography.** Facebook Sans appears in brand moments; product text uses the
  platform system font. The useful sizes are 15px body, 13px metadata, 17–20px
  section titles and 24px profile names.
- **Top bar.** Blue wordmark on the left, search, centre icon tabs with a blue
  active underline, and account or messaging actions on the right.
- **Mobile navigation.** The 2025 redesign puts the main destinations in one
  bottom tab bar: Home, Reels, Friends, Marketplace, Notifications and Profile.
- **Feeds submenu.** Facebook puts Feeds in the desktop left menu (sometimes
  behind “See more”) and in the mobile Menu. Feeds is the chronological catch-up
  from followed sources, with sub-filters such as All, Favourites, Friends,
  Groups and Pages. Meta says it has no Suggested For You posts, though ads still
  appear there on Facebook. Sources: Meta's “Introducing Home and Feeds on
  Facebook” (21 July 2022) and the current Facebook Help pages for Feeds and
  Favourites, checked 21 November 2026.
- **Composer.** A 40px avatar beside a rounded grey “What's on your mind?” pill,
  a divider and a row of post actions.
- **Post anatomy.** A 40px avatar, 15px semibold name, 13px timestamp and
  audience icon, 15px/20px body copy, inset images with an 8px radius, a divider
  and a three-action bar — Like, Comment, Share — with 44px touch targets.
- **Profile.** A cover photo, a large overlapping avatar, a 24px name, counts
  with bold numbers, a blue Follow button and an underlined Posts tab.
- **Notifications.** The actor's avatar carries a small reason badge; rows are
  white and tappable.
- **Long posts** collapse behind “See more”.

## How Balla maps it

| Facebook pattern | Balla implementation |
| --- | --- |
| White top bar, Balla mark and wordmark, search and direct actions | `src/components/AppHeader.tsx` |
| Left shortcuts and right contextual rail | `src/components/AppRail.tsx` |
| Grey canvas, white 8px cards, hairline borders | `src/theme.ts`, `src/components/PostCard.tsx` |
| Composer card with avatar and rounded prompt | `src/screens/FeedScreen.tsx` |
| Visible photo, video/GIF and link controls with one media type per post | `src/screens/ComposeScreen.tsx`, `src/lib/videoModel.ts`, `src/lib/videoUpload.ts` |
| Inset video with author alt text in a feed card | `src/components/PostCard.tsx`, `src/lib/embedModel.ts` |
| Feeds in the left menu, with sub-filters for a chronological catch-up | `src/components/AppRail.tsx`, `src/screens/FeedsScreen.tsx` |
| Visible feed switcher on Home, Following first | `src/components/FeedSwitcherSheet.tsx`, `src/screens/FeedScreen.tsx`, `src/lib/feedSwitcher.ts` |
| Like/Comment/Share action bar | `PostCard.tsx`: Like, Repost, Comment and a 44pt Save control |
| Post overflow for sharing and safety | `src/components/PostMenu.tsx`: Copy, Share, Quote, Report, Mute, Block and Delete |
| Settings and privacy cards | `src/screens/SettingsScreen.tsx`: Account, privacy, moderation, notifications, content, feeds, appearance, language, help and legal |
| Cover, overlapping avatar, bold counts, Posts tab | `src/screens/ProfileScreen.tsx` |
| Underlined search tabs and result cards | `src/screens/SearchScreen.tsx` |
| Era-selectable chrome and canvas with nine accent colours | `src/screens/AppearanceScreen.tsx`, `src/lib/themeModel.ts` |
| Reason badges on notification avatars | `src/screens/NotificationsScreen.tsx` |
| Centred sign-in card | `src/screens/LoginScreen.tsx` |
| Three-column desktop, bottom tabs on mobile | `App.tsx`, `src/lib/layout.ts` |

Balla's own mark is the wall drawn in `site/mark.svg`, `scripts/gen-icons.py`
and `src/components/BrandMark.tsx` — not a Facebook asset. The same `#0866FF`
brand blue is used by the site, the icons, the app configuration and the
default accent. The other eight accents are user choices, not a second brand.

The desktop rails appear at 1000px and the right rail at 1300px. The centre
column is capped at 680px at every width so line length stays readable on
phones and tablets too. The bottom tab bar is hidden while the rails are
visible. The header does not repeat tab destinations: the left rail owns them
on desktop and the bottom tabs own them on mobile, so a screen never shows the
same navigation twice. On narrow screens the header adds direct 44pt actions
for Feeds, Lists and settings — destinations the five-tab bar cannot fit —
without duplicating a tab.

Balla follows the Feeds pattern but keeps every control visible: Home has a
44pt **Switch** button that opens a sheet with Following first, then pinned
feeds in the user's order, then other saved feeds. Feeds and Lists are one tap
from the mobile header and are also in the desktop rail. Thread replies use a
smaller indent on phones, capped at two visible levels, so deep branches keep a
readable text column; the role label still states the real depth. Bottom sheets
and the reply composer respect the device's bottom safe area. There is no
“See more” hiding it, no ranked Home feed, no suggested posts, no adverts and
no engagement bait. Custom feeds keep the generator's order and say so;
Following is always newest-first.

## Mock preview

The shell and feed can be inspected without a Bluesky account. The preview is
opt-in at build time and never runs in a normal build:

    EXPO_PUBLIC_BALLA_MOCK=1 npm run site:build
    python3 -m http.server 4173 --directory dist-site

Open `http://localhost:4173/app/` with `?tab=Home`, `?tab=Search`,
`?tab=Notifications`, `?tab=Saved` or `?tab=Profile` to choose a tab, and add
`?screen=Thread`, `?screen=Compose` or `?screen=UserProfile` to open a detail
screen. The mock agent returns local fixtures only; it does not contact
Bluesky. A yellow “Preview · mock data” strip is always visible so the data is
never mistaken for a real session.

## What Balla deliberately does not copy

- **Stories, Reels, Marketplace, Groups, Watch and Events.** Balla does not have
  those features, and drawing empty versions would be dishonest.
- **The reactions picker.** Balla supports Bluesky likes, reposts and replies;
  it does not pretend to have Love, Haha, Wow, Sad or Angry.
- **Ranking, suggested posts and “people you may know”.** The Following feed is
  chronological, and the app has no injection points.
- **The blue top bar as the default.** Facebook itself retired it; Balla's
  default New Facebook era uses white chrome. The three researched retro
  presets restore period blue chrome deliberately, as a visual reference only.
- **Facebook Sans.** It is proprietary. Balla uses the platform system font.
- **Invented counts or unread state.** Every number and badge comes from the
  Bluesky API. Notifications have no “seen” state, so they are not painted as
  unread.

## Sources

- Engadget, “Why Facebook redesigned Facebook.com” (white chrome, three-column
  desktop, dark mode): <https://www.engadget.com/facebook-web-browser-redesign-133006571.html>
- TechCrunch, “Facebook's redesign goes live with simplified navigation and dark
  mode”: <https://techcrunch.com/2020/05/08/facebooks-redesign-goes-live-with-simplified-navigation-and-dark-mode>
- Meta, “Redefining Facebook's brand identity” (2023 palette and accessibility):
  <https://www.meta.com/design-at-meta/blog/redefining-facebooks-brand-identity>
- Meta, “Making it Easier to Create, Discover, and Share Content on Facebook”
  (December 2025 feed, composer and tab-bar changes):
  <https://about.fb.com/news/2025/12/making-it-easier-to-create-discover-and-share-content-on-facebook/amp>
- Facebook colour references: <https://mobbin.com/colors/brand/facebook>
- Facebook post dimensions and image ratios:
  <https://postlinkapp.com/blog/facebook-post-size-and-dimensions>
