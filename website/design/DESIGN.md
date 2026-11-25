# Spiral Node website: design system

The visual system for the Spiral Node website: direction, palette, type, motion and components.

## Direction: "the painted classical world"

The home page is a story told by scrolling: nine calm painted scenes (a countryside at sunset or night, a scholar's study, a library, an antique map, a star atlas, a town square), the way 18th- and 19th-century painters imagined antiquity. The theme is humanity, exploration and creativity. The device is a modern object in that world, and its screen is a real 1-bit Spiral OS frame that is never repainted. Ink, paper and parchment: the page body is warm paper with near-black ink, like the e-ink screen. Colour lives in the paintings, the device and a few accents. Not a generic SaaS look: no stock icons, no glassmorphism.

## Palette "Helix 16" (original, limited)

Colour roles: olive leads the site (header, links, large areas). Orange marks primary buttons. Brown marks secondary buttons (`.btn-secondary`) and highlights.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#1c1a14` | text, e-ink black, panel lines |
| `paper` | `#f1e7cc` | panels and page background, e-ink white |
| `cloud` | `#e9dcc6` | alternate section background, clouds |
| `olive` | `#6f7d3c` | panel and header-box frames, device body (default colourway); large accents only, never body text |
| `olive-deep` | `#47522a` | links, panel labels and small accent text on paper (6.8:1) |
| `gold` | `#e9a820` | focus rings (with an ink ring around them), highlights |
| `olive-bright` | `#b5c25a` | highlights, focus ring on dark |
| `brown` | `#7a5230` | secondary buttons (paper text 5.8:1), highlights, brown colourway, wood, borders |
| `brown-deep` | `#3e2a1a` | tree trunk, footer background |
| `orange` | `#f0762e` | the one primary button ("Try the demo"), ink text on it 6.0:1 |
| `amber` | `#f0a33a` | sunset art (horizon glow, low sun) |
| `copper` | `#c97b4a` | accent: badges, highlights, the device's accent ring (ink text on it 5.3:1) |
| `copper-deep` | `#8a4b23` | accent on paper; paper text on it 5.7:1 |
| `apple` | `#d23a2c` | the apple, small accents |
| `leaf` | `#4e8c3a` | tree leaves, near forest |
| `forest` | `#23402f` | far forest, dark sections |
| `night` | `#1a1d45` | night sky top |
| `dusk` | `#5a3d7a` | sky middle band |
| `rose` | `#d77a8f` | dawn/dusk sky band |
| `sky` | `#7fb2df` | pre-sunset upper sky |

Checked text pairs (WCAG): ink/paper 14.7, paper/night 13.7, paper/forest 9.7, ink/orange 8.3, paper/brown 5.8, ink/copper 5.3, paper/copper-deep 5.7, paper/olive-deep 7.8, paper/brown-deep 11.5, ink/cloud 12.8. All AA or better.

The device's black colourway uses `ink` with `#3a342c` highlights; brown uses `brown`/`brown-deep`; olive uses `olive`/`olive-deep`/`olive-bright`.

The night scene maps the land and sky to a small set of moonlit blues and teals (the `n_*` entries in `art/make_art.py`). They live only inside that scene's art, never in the UI.

## Type

- **Type:** VT323 (SIL Open Font License) from `@fontsource/vt323`, self-hosted at build with `next/font/local`, for everything: one weight (400), no faked bold or italic. Body 20 px at 1.3 line height, never under 20 px; labels 20 px uppercase, 0.12em. Tokens: `--text-s`, `--text`, `--text-l`, `--h3`, `--h2`, `--h1`, `--leading`.
- Rejected: classical serifs. Spiral Node is a modern device; the paintings carry the classical feel.
- No runtime font requests: no Google Fonts CDN.

## Spacing, shape, elevation

- 8 px grid: `--s1: 8px` … `--s8: 64px`. Section padding 64 px desktop, 40 px phone.
- Corners: softly rounded, 4 px (6 px on dialogs).
- Cards (`.pixel-box`; the class keeps its earlier name): parchment (`--parchment`), a thin brown rule (`--rule`) and one soft shadow (`--shadow`).
- Buttons: 4 px corners, a faint top light and a small soft shadow; pressed, they move down 1 px.
- Header and footer: olive-deep and brown-deep bands with a fine copper line on the inner edge.
- Small icons: round medallions, a copper ring on parchment with a letter or numeral, in the spirit of engraved emblems.

## Art

- The home world's scenes are pixel art drawn in code by `art/pixel/` (`python -m art.pixel.build`) into `public/world/<scene>/<wide|tall>/`: depth layers, one sprite atlas and a `manifest.json` each. The world canvas is `aria-hidden`; the words live in the page.
- Each scene keeps a quiet side where its paper panel docks; tags pinned to the art stay clear of that panel.
- Outside works the site uses (today only the VT323 font) are listed with source and licence on the credits page.
- The older pixel drawings (`website/art/make_art.py` into `public/art/`) remain only where they are still the source: the device geometry (`device.json`, `art/device-layout.json`), the simulator's device, the press kit and the mascot.
- Every image has alt text; decorative layers use `alt=""`/`aria-hidden`.

## Motion

- The home story follows native scroll position, with no scroll-jacking: painted layers move at different depths, the camera zooms and pans a little, scenes blend, and a canvas draws a few particles (fireflies, butterflies).
- Only `transform`, `opacity` and canvas animate.
- Cursor parallax: up to 6 px on paintings and 2 px on text, only with a fine pointer.
- `prefers-reduced-motion: reduce`: no parallax, zoom or particles; scenes simply crossfade. E-ink realism is off on `/try`.
- No flashing over 3 per second anywhere.

## Components

- `SiteHeader`: wordmark "Spiral Node" (VT323) + nav Product, Scripts, Today, Community, Devlog, Build log, ★ GitHub, and a "Try the demo" button (orange), on the olive-deep band with paper text. Each link has a preview card (a medallion and one line). On the home page the header steps aside during the story and returns at the last scene; a small spiral button opens it meanwhile.
- `SiteFooter`: an inline email sign-up (the same `SignupForm` as the popup), GitHub, Discussions, Press, Licences, Credits, Company.
- `Stage` (`components/story/`): the home story's sticky painted stage, with the nine scene sections in story order as real HTML.
- `Section`: heading + body, alternate parchment/`cloud` backgrounds.
- `Device` compound component for `/try`: `<Device>`, `<Device.Screen>`, `<Device.Wheel>`, `<Device.TopButtons>` with `colourway` prop.
- Focus: 3 px solid `ink` outline with 2 px `paper` offset; on dark backgrounds `olive-bright`.

## Breakpoints

360-599 phone (single column; on `/try` the wheel sits under the screen, under the thumb), 600-1023 tablet, 1024+ desktop (max content width 1120 px).

## Brand principles (2026-11-16)

- Helix Velocities makes tools for human thinking. Public copy talks about people and ideas, and never attacks anything.
- The feel: one plain purpose sentence in large type with the first sentence bold; warm paper, near-black text, muted secondary text; thin rules and soft cards; text links ending in "→"; calm motion with a pause control; imagery from humanity's history of thinking.
