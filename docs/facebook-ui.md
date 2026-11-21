# Facebook UI reference

Research date: **20 November 2026**.

Balla borrows Facebook's reading surface, not its data model. The point is the
familiar shape — white chrome, a grey canvas, a centred feed of cards, a composer
at the top and a blue action language — while the account, graph and content
stay on Bluesky and the AT Protocol.

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
| White top bar, blue wordmark, centre tabs | `src/components/AppHeader.tsx` |
| Left shortcuts and right contextual rail | `src/components/AppRail.tsx` |
| Grey canvas, white 8px cards, hairline borders | `src/theme.ts`, `src/components/PostCard.tsx` |
| Composer card with avatar and rounded prompt | `src/screens/FeedScreen.tsx` |
| Following tab with blue underline, plus opt-in pinned feed tabs | `src/screens/FeedScreen.tsx` |
| Like/Comment/Share action bar | `PostCard.tsx`: Like, Repost, Comment and a 44pt Save control |
| Post overflow for sharing and safety | `src/components/PostMenu.tsx`: Copy, Share, Quote, Report, Mute, Block and Delete |
| Settings and privacy cards | `src/screens/SettingsScreen.tsx`: Account, privacy, moderation, notifications, content, feeds, appearance, language, help and legal |
| Cover, overlapping avatar, bold counts, Posts tab | `src/screens/ProfileScreen.tsx` |
| Underlined search tabs and result cards | `src/screens/SearchScreen.tsx` |
| Reason badges on notification avatars | `src/screens/NotificationsScreen.tsx` |
| Centred sign-in card | `src/screens/LoginScreen.tsx` |
| Three-column desktop, bottom tabs on mobile | `App.tsx`, `src/lib/layout.ts` |

The desktop rails appear at 1000px and the right rail at 1300px. The centre
column is capped at 680px so line length stays readable. The bottom tab bar is
hidden while the rails are visible.

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
- **The blue top bar.** Facebook itself retired it; Balla follows the current
  white chrome.
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
