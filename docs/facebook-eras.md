# Facebook eras and accent colours

Last researched: **21 November 2026**.

Balla lets each person choose a Facebook-era chrome and canvas independently
from a nine-colour accent palette. The feature is a visual translation exercise.
Facebook-era references are visual references only, not a claim that Facebook or
Meta endorses, sponsors or is affiliated with Balla, and not a licence to use its
assets. Bluesky references identify the network Balla connects to and do not make
Balla an official client. Balla does not ship Facebook logos, wordmarks, icons or
photography.

## Research basis

- **Version Museum, “15 Years of Facebook Website Design History”** records the
  sequence of site designs, including the early blue-and-white columns, the
  2006 News Feed / Mini-Feed layout and the later Timeline-era desktop.
  <https://www.versionmuseum.com/history-of/facebook-website>
- **PCMag, “10 Years Later: Facebook’s Design Evolution”** documents the 2004
  launch, the 2005 name change, the 2006 Mini-Feed redesign, the 2008 cleaned-up
  design and the 2011 Timeline era.
  <https://www.pcmag.com/news/10-years-later-facebooks-design-evolution>
- **Engadget, “Why Facebook redesigned Facebook.com” (29 April 2020)** records
  the FB5 redesign: the blue top navigation bar was removed in favour of white
  chrome, the canvas stayed grey and the layout gained room for dark mode and
  larger iconography.
  <https://www.engadget.com/facebook-web-browser-redesign-interview-133006571.html>
- **Meta Brand Resource Center** is the current source for Facebook Blue and its
  white “f” treatment. Balla uses the colour relationship only, not the mark.
  <https://www.meta.com/brand/resources/facebook/logo/>
- Reported colour history identifies the long-running classic interface blue as
  approximately `#3B5998` and the later brighter product blue as `#1877F2`.
  The 2023 identity moved the logo blue further toward `#0866FF`; Balla’s
  default “Facebook blue” accent uses that higher-contrast modern value.

## Eras implemented

| Preset | Years | Visual cues translated into Balla |
| --- | --- | --- |
| **Thefacebook** | 2004–2005 | Pale blue canvas, muted navy chrome, white columns, square-cornered brand mark. |
| **News Feed** | 2006–2010 | The classic blue navigation bar over a cool grey canvas, with white feed cards and denser vertical rhythm. |
| **Timeline** | 2011–2019 | Deeper navy chrome, a large white content column on a quiet grey canvas and the desktop “Classic Facebook” feel. |
| **New Facebook** | 2020–present | White chrome, grey canvas, rounded cards and accent-led navigation, matching Balla’s original shell. |

These are **chrome and canvas presets**, not replicas. The feed, cards, controls
and typography remain Balla’s own. Following remains first and chronological in
every era; no era changes feed ranking or adds Discovery content.

## Accent palette

The nine solid accent colours are:

1. Facebook blue (`#0866FF` light / `#4599FF` dark)
2. Classic navy
3. Teal
4. Green
5. Purple
6. Magenta
7. Red
8. Orange
9. Slate

There are no gradients. The accent is independent of the era, so a chosen
colour applies to links, selected controls and primary buttons in every era. In
the New Facebook era it also colours the wordmark and mark; the retro eras use
period chrome for the header brand instead. Era chrome remains period-specific.

Each accent has a light and dark variant plus a matching soft background. The
hex values above are the published starting points. Where an accent, danger,
green, warning or secondary colour would read below 4.5:1 on a card or the page
behind it, the palette uses the nearest darker (light theme) or lighter (dark
theme) shade that passes; the default light blue is one such case. Labels on
solid accent, danger and green fills use whichever of white or dark ink reads
better. The automated suite checks these, body text and chrome contrast for all
**9 accents × 4 eras** in light and both dark themes. Accent, danger and green
text on the soft chip surface is not covered.

## Implementation

- `src/lib/themeModel.ts` — accents, era palettes, contrast helpers and theme
  fallback parsing.
- `src/theme.ts` — the shared external theme store and `usePalette()`.
- `src/lib/preferences.tsx` — device-local persistence alongside the post
  preference.
- `src/screens/AppearanceScreen.tsx` — accent grid, era previews and selection.
- `src/components/AppHeader.tsx`, `App.tsx` — chrome, tab bar and stack-header
  adaptation.

Choices are stored under `balla.preferences.v1` in AsyncStorage. They are local
display preferences and are never written to Bluesky preferences.
