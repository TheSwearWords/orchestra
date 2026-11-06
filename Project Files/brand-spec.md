# Orchestra brand spec (v2, the canvas language)

The single reference for building Orchestra's look, in the app and on the site. It covers the tokens, type, surfaces, components, motion, imagery and voice, and how each one maps to code.

- **Figma:** file `AqpBpdKicUBczcUwdiDEnk`.
  - Foundations: colour, type, surfaces, grid and spacing, lines and corners, motion.
  - Components: "Canvas components" (chrome, board, covers and chat), plus the updated Buttons.
  - Brand: logo construction, logos, marks, the orb, the poster, covers, dither art, voice.
  - Earlier versions are on the Archive page.
- **Related docs:** `canvas-concept.md`, `canvas-spec.md`, `elastic-architecture.md`.
- **Status:** v2, Nov 6 2026. It replaces the Instrument Serif and Instrument Sans system from Oct 30.

---

## 1. The idea in one paragraph

Orchestra is laid out like a printed concert programme on a drafting board.
- **Colour:** one electric blue, lots of white and a little ink.
- **Type:** an italic high-contrast serif for every title, a plain grotesk for the interface, and a monospace for the small print.
- **Surfaces:** everything sits on a dot-grid artboard. Chrome floats above the board on sharp white chips. Content rests on the board as cards, linked by dashed wires.
- **Images:** old engravings, dithered to one bit.
- **Motion:** moving around is a camera move, and labels turn to the serif when you point at them.

---

## 2. Colour

### 2.1 Core
| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `color/brand/default` | `#0538FF` Orchestra Blue | `#0538FF` | Type, hairlines, primary buttons, active states, poster |
| `color/bg/default` | `#FFFFFF` | `#0B0B12` | Pages, cards, chips |
| `color/bg/inverse` | `#0B0B12` Ink | `#F7F7F9` | Primary-button hover, ink covers, Terminal mode |
| `color/needs-you/default` | `#FF5A1F` Signal | `#FF5A1F` | The NEEDS YOU tab, the score's playhead. Nothing else. |

**Proportion:** about 70% white, 25% blue, and ink and signal as accents.
- **Inner pages and boards** are white-dominant, with blue type.
- **The landing poster, blue cards and active states** flip to blue with white type.

### 2.2 Blue at reduced strength
All of these are Orchestra Blue at lower opacity, never a grey.

| Token | Value | Use |
| --- | --- | --- |
| `color/rule/default`, `color/card/border`, `color/chip/border`, `color/border/strong` | blue at 55% | Card and chip borders, rules |
| `color/border/default` | blue at 35% | Input borders, dividers |
| `color/rule/hair` | blue at 25% | Light dividers inside cards |
| `color/canvas/dot` | blue at 20% | Dot grid on white |
| `color/wire/default` | blue at 60% | Dashed wires |
| `color/card/selected` | blue at 6% | Selected or hover wash |

### 2.3 On blue
| Token | Value |
| --- | --- |
| `color/poster/bg` | `#0538FF` |
| `color/poster/rule` | white at 70% |
| `color/poster/text-dim` | white at 85% |
| `color/poster/dot` | white at 32% |

### 2.4 Status
Use status colours sparingly, on tags and pills only:
- **Success** `#1F9D55`, on its subtle wash `#DDF5E6`
- **Danger** `#D7193A`, on its subtle wash `#FCE1E6`

The older `color/agent/*` tokens are kept so existing frames still work, but don't use them in new work.

### 2.5 Text
| Token | Value |
| --- | --- |
| `color/text/primary` | `#0B0B12` |
| `color/text/link` | `#0538FF` |
| `color/text/dim` | ink at 68% |
| `color/text/placeholder` | ink at 45% |
| `color/text/on-brand` | `#FFFFFF` |

**Contrast:** blue on white is 7.0:1 (AAA for body text), and white on blue is the same. Never put dim text on the dot grid without a card behind it.

### 2.6 Patterns (paint styles)
- `Pattern/Canvas`: white, with 1 px blue dots at 20%, every 24 px.
- `Pattern/Poster`: blue, with white dots at 32%, every 24 px.
- **In CSS:**
  - White: `radial-gradient(circle, rgba(5,56,255,.2) 1px, transparent 1.5px) 0 0 / 24px 24px`
  - Blue: `rgba(255,255,255,.32)` dots on `#0538FF`, same size.

---

## 3. Type

**Three families:**

| Family | Use | Loading |
| --- | --- | --- |
| **Bodoni Moda**, italic, weight 800 | Every heading, the wordmark, numbers, active or hover labels | Google Fonts `Bodoni+Moda:ital,opsz,wght@1,6..96,800` |
| **Archivo** (variable: `wdth` 62–125, `wght` 400–900) | Interface, body, caps labels | Google Fonts; app: `@fontsource-variable/archivo` |
| **IBM Plex Mono**, weights 400 and 500 | Captions, logs, card headers, the map label, file names | Google Fonts; app: `@fontsource/ibm-plex-mono` |

### 3.1 Styles (Figma text styles)
| Style | Spec | Use |
| --- | --- | --- |
| Display/Poster | Bodoni 800i · 240 / 86% · −3.5% | The landing wordmark. On the web: `clamp(84px, 21vw, 380px)` |
| Display/XL | Bodoni 800i · 72 / 92% · −3% | Call-to-action headlines |
| Display/L | Bodoni 800i · 56 / 94% · −3% | Page titles |
| Heading/XL | Bodoni 800i · 44 / 100% · −3% | Section titles, document headings |
| Heading/L | Bodoni 800i · 36 / 104% · −3% | Card titles, area names |
| Heading/M | Bodoni 800i · 28 / 110% · −3% | Seat names, active tab, current breadcrumb step |
| Heading/S | Archivo 800 caps · 22 / 30 · +0.5% | Interface headings |
| Heading/XS | Archivo 800 caps · 18 / 26 · +1% | Small interface headings |
| Lead | Archivo 500 · 26 / 125% | The intro sentence under a title |
| Body/L | Archivo 400 · 18 / 28 | |
| Body/M | Archivo 400 · 16 / 26 | |
| Body/M-Strong | Archivo 600 · 16 / 26 | |
| Body/S | Archivo 400 · 14 / 22 | |
| Label/L | Archivo 600 caps · 16 / 20 · +4% | Buttons, navigation |
| Label/M | Archivo 600 caps · 14 / 20 · +4% | Buttons, navigation |
| Label/S | Archivo 600 caps · 12 / 16 · +4% | Buttons, navigation |
| **Label/Serif L, M, S** | Bodoni 800i · 20, 17 or 15 / 100% · −2% | **What a label becomes on hover, focus or when active** |
| **Label/Mono** | Plex Mono 500 caps · 11 / 130% · +6% | Card headers ("02 / 06 · REFERENCE LINKS"), map label, eyebrows |
| Caption | Plex Mono 400 · 12 / 18 | Meta, notes, figure captions |
| Log/M | Plex Mono 400 · 14 / 22 | Agent channel, tool calls |
| Log/S | Plex Mono 400 · 12 / 20 | Agent channel, tool calls |
| Logo/Wordmark | Bodoni 800i · 28 / 36 · −2% | The wordmark in chrome |

### 3.2 Rules
- **Caps labels are wide.** On the web and in the app, caps labels use Archivo at `font-stretch: 115%`. Figma styles can't hold the width axis, so the styles are at 100%. Code wins.
- **Labels swap to the serif.** Navigation links, buttons, movement rows and tile titles switch to Bodoni italic on `:hover`, `:focus-visible` and `[aria-current]`, with no caps, letter-spacing −0.02em, and about 3 px larger. Keep a `min-height` on the element so nothing jumps.
- **Headings are never caps.** Bodoni is always italic 800 and sentence case.
- **Mono is for the small print only.** It is never used for headings.

---

## 4. Surfaces, grid and elevation

### 4.1 The board
- **Every screen is an artboard** with the dot grid, either `Pattern/Canvas` or `Pattern/Poster`.
- **One grid: 24 px.** The dots sit on it, dragged things snap to it, and spacing builds from 4 and 8.
- **Site boards:**
  - 12 columns, 24 px gutters, and 88 px between rows of cards (room for the wires).
  - Cards span 8 to 12 columns and are offset from each other, so the wires curve.
  - Under 900 px, everything is one column with a 56 px row gap.

### 4.2 Elevation (effect styles)
All shadows are ink, and all are negative-spread so they sit low.

| Style | Value (offset y, blur, spread, opacity) | Use |
| --- | --- | --- |
| Shadow/Float | 12, 28, −18, 45% | Chrome: breadcrumb, chips, minimap, Orchestrator bar |
| Shadow/Card | 22, 44, −30, 40% | Cards and seats resting on the board |
| Shadow/Lift | 34, 60, −26, 50% | A card being dragged. Add −0.6° rotation and a 2 px blue border. |
| Shadow/Book | 14, 28, −6, 18% | Covers on the shelf |

`Elevation/1` to `Elevation/4` are kept for older frames.

### 4.3 Lines and corners
- **Corners: radius 0 everywhere.** `radius/sm` is now 0. Round shapes are only for pills (instruments, foundations, status tags), avatars and the orb (`radius/full`).
- **Line weights:**
  - 1 px hairline: cards, rules, dividers.
  - 1.5 px: secondary buttons.
  - 2 px: focus rings, dragged cards and selected frames.
- **Dash meanings:**
  - Wire, 1.4 px with 5/5 dashes: something is linked.
  - Queued, 1 px with 4/4 dashes: something isn't made yet.
  - Placeholder, 1 px with 6/6 dashes: new project, add a seat, drop zones.

### 4.4 Sizes
| Thing | Value |
| --- | --- |
| Chrome chip height | 46 |
| Chrome inset from the window edge | 14 (plus the safe area) |
| Gap between chips | 10 |
| Card header | 40 |
| Card padding | `clamp(20px, 2.6vw, 40px)` |
| Minimap | about 120 wide, capped at about 140 high |
| Board card row gap | 88 |

---

## 5. Components

These are in Figma under Components → "Canvas components". The buttons are the existing set, updated.

### 5.1 Buttons (`Button` and `Icon Button`, restyled in place)
- **Shape:** sharp. Archivo caps label, Label/Serif on hover.
- **Primary:** blue with white text; ink on hover. On the blue poster it flips to white with ink text, and ink with white text on hover.
- **Secondary:** a 1.5 px blue outline with blue text; filled blue with white text on hover.
- **Tertiary:** blue text only; a 6% blue wash on hover.
- **Danger:** unchanged.
- **Focus:** a 2 px blue ring.

### 5.2 Chrome
| Component | Spec |
| --- | --- |
| `Chrome/Chip` | 46 high, white, 1 px border at blue 55%, Shadow/Float. The base for every floating control (Tidy, zoom, GitHub). |
| `Chrome/Breadcrumb` | Orb (32 px) + steps in Label/S dim, separated by `/` in mono at 35%. The current step is Heading/M blue. Clicking a step zooms out to it. On phones, show only the current step. |
| `Chrome/Area switch` | I / II / III. The current area is a blue cell with the white dot grid and its Bodoni name; the others show only their numeral. |
| `Chrome/Orchestrator bar` | Three modes: **Conduct** (white, blue underline), **Arrange** (blue poster, white orb), **Terminal** (ink, mono, shows the branch). Parts: orb, mode switch, underlined field, "To …" label on the right. Bottom centre, about 680 wide. |
| `Chrome/Minimap` | A page label on top in Label/Mono (STUDIO, I · RESEARCH and so on), area blocks, and a 1.5 px blue box for your view. Bottom right. Hidden under 900 px. |
| `Chrome/Needs you tab` | Signal fill, ink Label/S, sticking out of the top edge of a cover or seat. |

### 5.3 Board
| Component | Spec |
| --- | --- |
| `Board/Section card` | **White:** blue 55% border, Shadow/Card. **Blue:** poster fill with the dot grid. **Dragging:** Shadow/Lift. Its 40 px header holds ⋮⋮, a Label/Mono title and a count. It is dragged by the header. |
| `Board/Link block` | A 46 px blue square with a white Bodoni initial, the domain in Body/M-Strong blue, the note in Body/S, and ↗. The whole block is the link. |
| `Board/Tile` | Kinds: Inspiration and Usable asset. A dithered image on blue, the source in Label/S blue, and the note in Body/S. |
| `Board/Seat` | **Chosen:** blue with the dot grid. **Available:** white. **Needs you:** adds the tab. Contents: a 64 px round art plate, the name in Heading/M, the role in Label/S, a status pill and the last line. |
| `Board/Pill` | Instrument active or queued (queued is dashed); foundation ready, lit or unlit. Full radius, Label/S. |
| `Board/Agent node` | Orchestrator (blue, orb), Musician (outline ring), Instrument (small). The meta line shows tier and model in Label/Mono. |
| `Board/Wire` | 1.4 px dashed at blue 60%, with open 12 px dots at both ends. A **live** wire uses solid blue with marching dashes. |
| `Board/Paper card` | A markdown document on the board: 2 px blue border, a Label/Mono file line, a Heading/XL title, a summary, themes and "Read by". Open grows it into the reader. |

### 5.4 Book and chat
| Component | Spec |
| --- | --- |
| `Book/Cover` | Variants: Blue, White and Ink, at 300×400. Contents: an 18 px spine; "ORCHESTRA PRESENTS" and "NO. 01"; a dithered art plate (top right); the title in Heading/L; the client in caps; a rule; the three movements. Shadow/Book. |
| `Chat/Message` | **Orchestrator:** 22 px orb, Label/S name, Caption time, Body/S. **You:** a blue bubble with white text, aligned right. **Note:** a centred Label/S between two rules. |

---

## 6. Motion

**Easing:** one curve for everything, `cubic-bezier(.2,.7,.2,1)`.

| Move | Duration | What happens |
| --- | --- | --- |
| Hover | 200 ms | Labels swap to the serif; backgrounds fill |
| Drawer | 240 ms | The chat slides in from the right; the canvas dims to 55% |
| Tidy | 450 ms | Cards and covers ease back to the default layout |
| Page or area change | 550 ms | The next view zooms in from scale 1.045 with a fade |
| Opening the book | 700 ms | 0–200 ms grow; 200–500 ms the cover rotates `rotateY 0 → −160°` on the spine; 500–700 ms push in, scale 1 → 3.2 |
| Card drop | instant | Snap to the 24 px grid |
| Orb | loop | **Rest:** follows the pointer. **Research:** a scan line. **Create:** five pieces restack from the bottom up. **Refine:** a star, and a pulse every 2 s. |
| Reduced motion | 150 ms | A crossfade only: no zoom, no swing, no orb movement |

---

## 7. Brand assets

### 7.1 The mark and the wordmark
- **The mark** is the integral ∫ inside a ring: one closed outline of 12 anchors with 180° rotational symmetry, drawn on a 25 u grid inside a 300 u ring. The construction sheet and clear-space rules are on the Brand page.
- **The wordmark** is "Orchestra" in Bodoni Moda italic 800. The lockup is the mark plus the wordmark.
- **Never:**
  - redraw the integral
  - stretch or outline the wordmark
  - set the wordmark in any other font
  - put the mark on a busy image without a blue field behind it

### 7.2 The orb
- **What it is:** the Orchestrator's face. It is the integral floating in a dithered lattice sphere, drawn live on a canvas with a 4×4 Bayer dither.
- **Colours:**
  - **On white:** a blue shell with an ink integral.
  - **On blue:** a white shell with an ink integral.
- **Size:** minimum 24 px. Below 48 px, use the flat Mark instead.
- **Dither:** keep it crisp, with `image-rendering: pixelated` and no smoothing.

### 7.3 The poster
The landing page is a blue poster:
- the giant wordmark at the foot (Display/Poster)
- the orb on the right inside a dashed ring
- one sentence and two buttons
- the three movements as a ruled row across the bottom

### 7.4 Covers
- **Generated:** every project's cover is generated (see `canvas-spec.md` §2.3).
- **Colour:** Auto uses the brand kit's primary, otherwise Blue, White or Ink.
- **Art:** Auto uses the first usable asset, dithered.

### 7.5 Dither art
- **Source:** public-domain engravings and classical statues (Rijksmuseum, Met Open Access, Artvee).
- **Treatment:** dithered to one bit, white pixels on `#0538FF`, exported as PNG at 2×.
- **A modern object** (a phone, the Git mark) can be dropped into the scene.
- **Never:** a raw photo, a gradient, a glow or a 3D render.
- **Credits:** sources are recorded in `assets/credits.json`.

### 7.6 Voice
- **How it sounds:** plain, literal and warm. Say what the thing does, in short active sentences.
- **Tagline:** *Many hands. One score.*
- **One line:** *An open-source agent framework that's built for your design workflow and grows with you.*
- **Names:**
  - **Orchestrator:** the conductor, and the only agent that talks to you.
  - **Musicians:** one per deliverable.
  - **Instruments:** what Musicians play. Shared ones are built once.
  - **Movements:** I Research · II Create · III Refine, always with Roman numerals.
  - **The score:** the project itself.
  - Studio, Book, Ensemble, Memory.
- **Write:** "Interpret writes research.md from your references." / "Approve 3 Figma writes."
- **Don't write:** "Unleash your creative potential." / "AI-powered magic." / "slop" (or any variant of it).

---

## 8. Implementing it in the app

The app still runs the Oct 30 system (Instrument Serif and Instrument Sans). The migration has seven steps:

1. **Fonts.** In `src/renderer/src/assets/main.css`, set:
   - `--font-display: 'Bodoni Moda', 'Didot', 'Bodoni 72', Georgia, serif;`
   - `--font-sans: 'Archivo Variable', 'Arial Narrow', Arial, sans-serif;`
   - `--font-mono` stays IBM Plex Mono.

   Install `@fontsource/bodoni-moda` (800-italic) and `@fontsource-variable/archivo`. Remove the Instrument packages.
2. **Token export.** Re-export `tokens.json` from Figma (the semantic collection now includes canvas, chip, card, wire, poster, rule, needs-you and terminal), then update `scripts/tokens.mjs`:
   - Map the new families in `fontStack`: `'Bodoni Moda' → var(--font-display)`, `'Archivo' → var(--font-sans)`.
   - Extend `weight`: `ExtraBold: 800`, `'ExtraBold Italic': 800`, `Medium: 500`, and treat any style containing "Italic" as italic.
   - Add `text-transform: uppercase` when a style is caps, and `font-stretch: 115%` for `Label/*`.
   - Emit the effect styles as `--shadow-float`, `--shadow-card`, `--shadow-lift` and `--shadow-book`.
3. **Patterns.** Add utilities `.bg-canvas` and `.bg-poster`, using the radial-gradient dot grids in §2.6.
4. **Serif hover.** Add one shared utility, the same rule the site uses, for links, buttons, tabs and tile titles:

   ```css
   .serif-on:hover, .serif-on:focus-visible, .serif-on[aria-current] {
     font-family: var(--font-display); font-style: italic; font-weight: 800;
     font-stretch: 100%; text-transform: none; letter-spacing: -0.02em;
   }
   ```
5. **Corners.** Remove every `rounded-*` except on pills, avatars and the orb.
6. **Chrome and board components.** Build these as React components that map one-to-one to the Figma components: `Chip`, `Breadcrumb`, `AreaSwitch`, `OrchestratorBar` (with a `mode` prop), `Minimap`, `SectionCard`, `LinkBlock`, `Tile`, `Seat`, `Pill`, `AgentNode`, `Wire`, `PaperCard`, `Cover`, `ChatMessage`. Following `elastic-architecture.md`, they belong in the core UI kit that parts render with.
7. **Motion.** Add `--ease: cubic-bezier(.2,.7,.2,1)` and duration variables for each row of §6. Honour `prefers-reduced-motion`.

**The site:** the published site (artifact v7) already uses this language. The repo's `website/index.html` is the earlier version and should be synced to it. Where the site and this spec disagree, update the site.
