# Handoff: Nocturne reskin and new chrome for the Orchestra desktop app

**For:** Claude Code, working in `TheSwearWords/orchestra` (the Electron app in `app/`).
**From:** the design session of Nov 10, 2026. The owner approved the Figma screens linked below.
**Base:** written against commit `688a14f` on `main`. If `main` has moved, read `AGENTS.md` again before starting and adjust file references.

This plan does two things:

1. It reskins the app from the light "v2 canvas" look (white, blue type, Bodoni) to the dark **Nocturne** look.
2. It changes some chrome and features:
   - Figma-style tabs replace the breadcrumb.
   - The area switch becomes a notch with mode icons.
   - The full-height page strips shrink to side notches.
   - A new session dock shows the agents at work, and Needs you moves into it.
   - The Orchestrator gets a live liquid face.
   - Create gets a few visual changes.

Work in phases, one pull request per phase. Each phase lists:

- what to build;
- where it goes;
- what "done" looks like;
- what to do when something isn't specified (section 6 holds the general rules).

---

## 0. Read first

- **Repo rules:** `AGENTS.md` (the ten rules, UI rules, branches, what never gets committed, checks). They still apply. Rules this reskin changes are listed in Phase 9; update `AGENTS.md` in the same PR as the change, as it asks.
- **Design system:** Figma frame `2265:46` (section 1). It is the single visual reference for tokens, components and rules.
- **Design notes:** the project doc `claude/alt-nocturne.md` in the claude.ai project "Orchestra". It records every decision and value behind the Figma file. If you can't reach the project, the values you need are copied into this plan.
- **Motion reference:** `claude/orchestrator-states.html` in the same project. This is a self-contained page holding three things:
  - the Orchestrator face shader (WebGL2 GLSL plus the state machine);
  - the landscape renderer;
  - the state timings.

  Copy it into the repo at `ideation/nocturne/orchestrator-states.html` so it travels with the code. Open it in a browser to see the target behaviour.
- **Checks (from `app/`):** `npm run typecheck`, `npm test`, and `npm run lint` (no new errors beyond the existing 10). Format only the files you touched, with `npx prettier --write <files>`.
- **Run against a copy of the vault**, never the real one: `ORCHESTRA_HOME` pointing at a temp folder with `library/` copied in, as `AGENTS.md` describes. Sending messages starts real paid `claude` sessions. You don't need to send any to build this.

## 1. Figma references

File key: `AqpBpdKicUBczcUwdiDEnk`. With the Figma MCP, call `get_design_context` or `get_screenshot` with this file key and the node ID. In a browser, go to `https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=<id with - instead of :>`.

### Pages

| Page | Node | Use |
| --- | --- | --- |
| Alt · Design system | `2224:3` | **Nocturne design system v2** (frame `2265:46`): every token, style, component and rule. The old v1 frame sits to its right, marked Archive |
| Alt · App reskin | `2231:2` | **The target screens.** Build from these |
| Alt · Mockups | `2224:4` | Earlier concept (N1–N3). Mood only; where it disagrees with the reskin page, the reskin page wins |

### Target screens (1440 × 900)

| Screen | Node | Link | What it shows |
| --- | --- | --- | --- |
| R1 · Studio | `2232:2` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2232-2) | Home: landscape background, Home lit, project tabs, covers, desk, Knowledge graph window |
| R2 · Book | `2232:124` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2232-124) | Workspace grey; notch on Book; **session dock expanded** |
| R3 · I Research | `2233:101` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2233-101) | Notch on Research; edge tabs (Book ←, → Create); dock collapsed with a hover label |
| R4 · II Create + Needs you | `2233:242` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2233-242) | Edge tabs (Research ←, → Refine); green Ready prerequisites; Lock in card; **dock in Needs you state**, panel open |
| R5 · Cover editor | `2234:200` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2234-200) | Home screen (landscape); new "Untitled" tab with a + icon |
| R6 · Setup | `2234:252` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2234-252) | Home screen (landscape); Home only, no tabs |

### Design system v2 sections (frame `2265:46`)

| Section | Node | Link |
| --- | --- | --- |
| Whole design system | `2265:46` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2265-46) |
| 01 Colour | `2265:55` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2265-55) |
| 02 Type | `2266:2` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2266-2) |
| 03 Shape and space | `2266:82` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2266-82) |
| 04 Surfaces and effects | `2267:2` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2267-2) |
| 05 Motion (timings and Orchestrator face states) | `2267:48` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2267-48) |
| 06 Backgrounds (landscapes and workspace) | `2268:2` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2268-2) |
| 07 Chrome (header, notch, edge tabs, dock, bar, Needs you panel) | `2268:18` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2268-18) |
| 08 Board pieces (windows, paper, seats, prerequisite rows, Lock in, Interpret box, status, buttons, covers) | `2269:68` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2269-68) |
| 09 Icons | `2269:284` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2269-284) |
| 10 Do and don't | `2269:297` | [open](https://www.figma.com/design/AqpBpdKicUBczcUwdiDEnk/Orchestra?node-id=2269-297) |

Start each phase by reading the matching section. It is the visual spec, and this plan is the build spec.

### Components

All live component masters now sit inside the design system frame, with the same node IDs as before. Deprecated ones are in the archive frames to its right and must not be built: Crumb, Crumb link, Page strip, the old standalone Needs you, the v1 Agent dock and the v1 Orchestrator bar.


| Component | Node | Notes |
| --- | --- | --- |
| `Alt/App/Tab` (Active yes/no; Label, Mode) | `2256:55` | Header tab |
| `Alt/App/Home` (Active yes/no) | `2256:63` | |
| `Alt/App/New tab` | `2256:64` | |
| `Alt/App/Area switch` (Area = Book / Research / Create / Refine) | `2231:67` | The top notch |
| `Alt/App/Edge tab` (Side left/right; Mode, Label) | `2258:42` | Side notches |
| `Alt/App/Session dock` (Needs you yes/no × Expanded yes/no) | `2258:69` | Agent stack |
| `Alt/Status dot` (Working / Needs you / Done / Idle / Error) | `2227:20` | |
| `Alt/App/Orchestrator bar` | `2231:79` | |
| Landscape plates | `2238:311` | The five background images (inside section 06) |
| `Alt/Icon/*` (Home, Book, Research, Create, Refine, New, Close, Chevron left/right) | `2256:23`, `2256:26`, `2256:29`, `2256:32`, `2256:35`, `2256:38`, `2256:41`, `2258:27`, `2258:30` | 16 px (chevrons 14) |
| `Alt/App/Mark` | `2231:7` | App icon and splash only. **Not in the header** |

Variables live in the collection **`Orchestra/Alt · Nocturne`**, with one mode, Dark. `get_variable_defs` on any reskin node returns them. Text styles are named `Alt/*`, effect styles `Alt/*`.

## 2. Nocturne values (copied from Figma so you don't need it to start)

### Colour

| Variable | Value | Notes |
| --- | --- | --- |
| `bg/base` | `#0A0A0C` | Window background behind everything |
| `bg/workspace` | `#1C1C20` | **Canvas inside a project** (Book, Research, Create, Refine) |
| `bg/raised` | `#141418` | |
| `bg/sunken` | `#060607` | Terminal, wells |
| `glass/frost` | `#08080A` at 86% | **Every panel, card, bar, chip, notch.** Near-black so it stands off the background |
| `glass/fill` | white 6% | Chips and pills *inside* a panel |
| `glass/fill-strong` | white 10% | Active/hover inside a panel |
| `glass/stroke` | white 12% | Default 1 px border |
| `glass/stroke-strong` | white 22% | Emphasis border |
| `text/primary` | `#F4F2EE` (chalk) | |
| `text/dim` | chalk 64% | |
| `text/faint` | chalk 40% | |
| `text/on-light` | `#0A0A0C` | Text on chalk pills and paper cards |
| `accent/blue` | `#0538FF` | Fills |
| `accent/blue-bright` | `#5B7CFF` | Blue on dark: text, strokes, focus |
| `status/working` | `#5B7CFF` | |
| `status/needs-you` | `#FFA24A` | Amber replaces v2's orange `#FF5A1F`. It still means "needs you" and nothing else |
| `status/done` | `#6FDC8C` | |
| `status/error` | `#FF5A5F` | Failed. Always paired with a plain-words message and Retry |
| `gradient/chalk` | `#EDE8DF` | Chalk pills, paper cards |
| `gradient/peach` / `pink` / `green` / `lilac` | `#F6B89A` / `#F2A7C3` / `#B9E4A3` / `#B7B5FF` | Accent light, agent tints |

### Shape, space and effects

- **Radius:** `sm` 4, `md` 6, `lg` 10, `pill` 999. Notches use 14 (top notch bottom corners) and 16 (dock). This **replaces** the v2 rule that corners are sharp.
- **Space:** 4, 8, 16, 24, 40.
- **`Alt/Glass`:** background blur 28, drop shadow `0 18px 48px rgba(0,0,0,.45)`, inner top highlight `inset 0 1px 0 rgba(255,255,255,.08)`.
- **`Alt/Float`:** `0 24px 64px rgba(0,0,0,.55)`.
- **`Alt/Glow blue`:** `0 0 32px rgba(5,56,255,.20)` (toned down; keep it soft).
- **Dot grid:** 24 px spacing, white dots at about 14% opacity, drawn above the background and under content.

### Type

| Style | Font | Size / line | Tracking |
| --- | --- | --- | --- |
| Display XL / L | Geist Light | 96/96, 64/66 | −4%, −3.5% |
| Heading L / M / S | Geist Regular / Medium / Medium | 40/44, 24/30, 17/24 | −2.5%, −1.5%, −0.8% |
| Body L / M / S | Geist Regular | 17/26, 14/21, 12.5/18 | −0.4%, −0.2%, 0 |
| Label | Geist Mono Medium, caps | 11/14 | +4% |
| Mono | Geist Mono Regular | 12/18 | 0 |
| Accent | Instrument Serif Italic | 64/66 (also used at 17–28) | −1% |

- **Instrument Serif Italic** is the one expressive face. Use it for big titles ("Studio", "Interpreted", "Lock in", "New asset", "Where you're needed") and for the hover/current treatment that Bodoni had in v2.
- **Geist** is the interface face, and **Geist Mono** is for labels, logs and file paths.
- **Packages:** `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` and `@fontsource/instrument-serif` (400 italic). Add them through `npm install`. Remove the Bodoni, Archivo and Plex packages only in the last phase, once nothing references them.

### Motion

- **Easing:** chrome keeps the existing `--ease` (`cubic-bezier(.2,.7,.2,1)`). The Orchestrator face and status changes use a calmer curve, `--ease-calm: cubic-bezier(.45,.05,.25,1)`.
- **Duration:** state changes on the face blend over about 1 s.
- **Reduced motion:** keep colour changes; stop all movement.

## 3. Approach

1. **Theme as a CSS layer, not a rewrite.** Components already style through semantic Tailwind names (`bg-chip`, `text-link`, `border-line`, `bg-canvas` …) that `main.css` maps to `tokens.css` variables. Add `assets/themes/nocturne.css` that redefines those **same variables** under `.nocturne` on `<html>`. Most of the reskin then happens without touching components. `tokens.css` is generated and must not be edited.
2. **New features go in new files** (rule 3): `canvas/Tabs.tsx`, `canvas/EdgeTab.tsx`, `canvas/SessionDock.tsx`, `canvas/OrchestratorFace.tsx`, `canvas/liquid.ts`, `canvas/landscape.ts`. `App.tsx`, `Chrome.tsx`, `Book.tsx` and `Create.tsx` get small, surgical edits.
3. **Keep the old theme reachable** while the reskin lands. Default to Nocturne, but let `localStorage.theme === 'v2'` drop the class. This makes comparison and rollback trivial. Remove the switch in Phase 9 if the owner agrees.

## 4. Phases

### Phase 1 · Theme layer, fonts and the token mapping

**Build**

- `assets/themes/nocturne.css`, imported in `main.css` after `tokens.css`. Inside `.nocturne { … }`, set every semantic variable below. Add the new Nocturne variables too: `--color-frost`, `--color-workspace`, `--color-status-error`, the gradient lights, `--ease-calm`, and the radius scale.
- Fonts: inside `.nocturne`, point `--font-sans` at Geist, `--font-mono` at Geist Mono and `--font-display` at Instrument Serif. Add `font-synthesis-weight: none` on `.nocturne`. Without it, the generated `type-*` utilities that ask for weight 800 (Bodoni) would draw faux-bold Instrument Serif.
- Set the class on `<html>` in `main.tsx`, guarded by the `localStorage.theme` switch.

**Mapping v2 semantic → Nocturne** (set these under `.nocturne`):

| v2 variable | Nocturne value |
| --- | --- |
| `--color-bg-default`, `--color-canvas-bg` | `#1C1C20` (workspace) |
| `--color-bg-subtle` | `#141418` |
| `--color-bg-muted` | `#1D1D22` (inferred: between raised and workspace) |
| `--color-bg-inverse` | `#F4F2EE` |
| `--color-surface-default`, `--color-chip-bg`, `--color-card-bg` | `rgba(8,8,10,.86)` (frost) |
| `--color-surface-raised` | `#141418` |
| `--color-surface-sunken`, `--color-terminal-bg` | `#060607` |
| `--color-text-primary`, `--color-logo-default` | `#F4F2EE` |
| `--color-text-secondary`, `--color-text-dim` | `rgba(244,242,238,.64)` |
| `--color-text-disabled`, `--color-text-placeholder` | `rgba(244,242,238,.40)` |
| `--color-text-inverse`, `--color-needs-you-on`, `--color-status-signal-on` | `#0A0A0C` |
| `--color-text-link` | `#F4F2EE` (see the note below) |
| `--color-border-default`, `--color-chip-border`, `--color-card-border`, `--color-rule-hair` | `rgba(255,255,255,.12)` |
| `--color-border-strong`, `--color-rule-default` | `rgba(255,255,255,.22)` |
| `--color-border-focus`, `--color-wire-live`, `--color-status-info-default` | `#5B7CFF` |
| `--color-brand-default`, `--color-bg-brand` | `#0538FF` |
| `--color-brand-hover` / `--color-brand-pressed` | `#2A4FFF` / `#0326B8` (inferred) |
| `--color-brand-subtle`, `--color-card-selected`, `--color-agent-subtle`, `--color-status-info-subtle` | `rgba(46,85,255,.13)` |
| `--color-agent-default` / `--color-agent-text`, `--color-status-info-text` | `#5B7CFF` / `#B9C7FF` |
| `--color-status-success-default` / `-subtle` / `-text` | `#6FDC8C` / `rgba(111,220,140,.16)` / `#A6EBB8` |
| `--color-status-signal-default`, `--color-needs-you-default` | `#FFA24A` |
| `--color-status-signal-hover` / `-subtle` / `-text` | `#FFB36B` / `rgba(255,162,74,.16)` / `#FFC48A` |
| `--color-status-danger-default` / `-hover` / `-pressed` / `-subtle` / `-text` | `#FF5A5F` / `#FF8A8D` / `#D9444A` / `rgba(255,90,95,.14)` / `#FF9A9D` |
| `--color-canvas-dot` | `rgba(255,255,255,.14)` |
| `--color-wire-default` | `rgba(244,242,238,.30)`, dashed (as drawn now) |
| `--color-poster-*` | **unchanged** (the blue poster and blue covers keep their identity) |
| `--effect-float` / `--effect-card` / `--effect-lift` / `--effect-book` | `0 24px 64px rgba(0,0,0,.55)` / `0 18px 48px rgba(0,0,0,.45)` / `0 34px 60px -20px rgba(0,0,0,.6)` / `0 14px 28px -6px rgba(0,0,0,.5)` |

> **Note on `text-link`:** in v2 most labels use `text-link` (blue type on white is the brand). In Nocturne, labels are chalk. Mapping `text-link` to chalk keeps the whole UI readable in one move. Real links (an `<a>` that opens a URL) should use `accent/blue-bright`. Give those a `text-accent` utility as you meet them; don't hunt for all of them in Phase 1.

**Radius:** v2 sets `--radius-sm: 0` in `main.css`. Under `.nocturne`, restore the scale (`sm` 4, `md` 6, `lg` 10, `full` 9999). Then grep `rounded` (26 uses today) and check each one still makes sense.

**Done when**

- With the class on, every screen is dark with chalk text and near-black panels, and nothing is unreadable.
- With `localStorage.theme = 'v2'`, the old look is unchanged.
- Typecheck, test and lint are clean.

### Phase 2 · Surfaces: frost, glass, workspace grey and landscapes on home screens

**Build**

- **Frost everywhere.** Chips, cards and windows already take `bg-chip`/`bg-card` and pick up frost from Phase 1. Add the `Alt/Glass` look as a `glass` utility in `main.css`: backdrop blur, shadow, inner highlight.
  - Apply it to **viewport chrome only**: header, notch, edge tabs, dock, Orchestrator bar, minimap, Back, Needs you panel, zoom.
  - **Do not** put `backdrop-filter` on artboard cards. There can be dozens, it is expensive, and on the grey workspace it is invisible anyway.
- **Workspace grey.** Inside a book (any area, and the whole Book), the canvas is `bg/workspace` with the dot grid (`Canvas.tsx` already draws dots from `--color-canvas-dot`).
- **Landscapes on home screens only:** Studio, Setup and the Cover editor.
  - Add `canvas/landscape.ts` with a `<Landscape name>` component: a fixed full-window layer behind the canvas. It draws a pre-rendered PNG with CSS `filter: blur(28px) saturate(.75)`, a scale of about 1.12 so the blurred edge never shows, and the shade gradient on top: `linear-gradient(180deg, rgba(10,10,12,.20), rgba(10,10,12,.32) 55%, rgba(10,10,12,.70))`.
  - Dots stay above the landscape.
  - Mapping: Studio = Sunset, Setup = Sunset, Cover editor = Coast. Keep Alpine, Desert and Hills available. They were drawn for Create, Research and Book before those went grey.
- **Images:** generate the five PNGs (Sunset, Alpine, Desert, Hills, Coast) at 1440 × 900 from the renderer in `orchestrator-states.html` (the `SCENES` object; it draws to a canvas). Save them to `assets/landscapes/*.png` and keep each under about 150 KB. Alternative: export the plates from Figma node `2238:311`.

**Done when**

- Studio, Setup and Cover editor match R1, R6 and R5: a soft landscape you can just recognise, with near-black panels that stand clearly off it.
- Every screen inside a book is flat grey with dots, as in R2–R4.
- Scrolling and zooming a board stays smooth (no backdrop blur on cards).

### Phase 3 · Header: Home and Figma-style tabs (replaces the breadcrumb)

**What it is** (R1–R5, components `2256:55`, `2256:63`):

- **Layout:** **no logo**. **Home** comes first (32 px, 14 px from the left, lit on Studio and Setup), a 1 px divider, then one **tab per open project**, then **+** (new project). Zoom stays on the right, vertically centred in the 52 px header.
- **Tab content:** a 16 px mode icon showing where that project is open, then the project name, then × on the active tab.
  - The icon is Book (grid) for the whole book, Research (open book), Create (quill pen) or Refine (medal).
  - The cover editor's tab is "Untitled" with a + icon.
- **Active tab:**
  - 40 px tall, from y 12 to 52, top corners 8, filled with `bg/workspace`.
  - Faint top and side outline (white 10%).
  - An 8 px concave flare at each bottom corner, so it runs down into the canvas like a browser tab.
- **Inactive tabs** are bare, with dim text and icon.

**Build**

- `canvas/Tabs.tsx` holds the tab strip and a `useTabs()` hook. State is an ordered list of open project ids, remembered with the same `rememberedJson`/`localStorage` pattern `App.tsx` uses for `areas`. Each tab's icon comes from the remembered `areas[id]` (null = Book).
- **Behaviour:**
  - Opening a book adds its tab, or focuses it if it's already open.
  - Clicking a tab shows that book at its remembered area.
  - × closes the tab. If it was active, go to the tab on its left, or Home if none remain.
  - Home shows the Studio and leaves the tabs as they are.
  - + opens the cover editor as a temporary "Untitled" tab. It becomes a real tab once the project is created and disappears if cancelled.
- In `Chrome.tsx`, `Shell` stops drawing `Breadcrumb`. Keep the `crumbs` prop accepted (and ignored) for one phase so call sites don't all change at once, then remove it. App renders the tab strip once, in the header, like it already renders the bar and Back.
- **Optional, only if it is cheap:** main and preload already have tear-off tab plumbing (`dragStart`, `onDropState`, `onAdoptTab`, `dragEnd`) that the renderer doesn't use yet. Wire drag-out and drag-in to the new strip if it fits. Otherwise leave a `// shortcut:` comment.

**Done when**

- The header matches R4 at 1440 px.
- Opening, switching and closing tabs work with back/forward. History entries are views, as today.
- The breadcrumb is gone everywhere.

### Phase 4 · The top notch: area switch with mode icons

**What it is** (`2231:67`, all four variants):

- **Shape:**
  - The switch hangs from the header's bottom edge: a flat top joined to the header, 14 px bottom corners, the frost fill, and a 1 px stroke on the sides and bottom only.
  - Two 10 px concave "ears" sit where it meets the header (the MacBook-notch taper).
- **Contents:** four slots in order: Book (grid), Research, Create, Refine.
  - The current one is a chalk pill with its icon and label: "The whole book", "I · Research", "II · Create", "III · Refine".
  - The others are 30 px icon-only buttons in `text/dim`.

**Build**

- Rewrite `AreaSwitch` in `Chrome.tsx` (keep its props). Draw the ears as two absolutely positioned 10 × 10 SVGs: the fill is a quarter-square minus a quarter-circle, plus the stroke along the curve. A small `Taper` component (`canvas/Taper.tsx`) can serve the top notch, the edge tabs, the dock and the active tab.
- **Icons:** copy these Remix SVGs into `assets/icons/` and add them to `IconName`: `home-5-line`, `book-open-line`, `medal-line`, `arrow-left-s-line` and `arrow-right-s-line`. `quill-pen-line` and `layout-grid-line` are already there. Remix Icon is Apache-2.0 and already the app's set.

**Done when** the notch matches R2, R3 and R4, and clicking any icon goes to that area (Book = the whole book).

### Phase 5 · Edge tabs (replaces the full-height page strips)

**What it is** (`2258:42`):

- **Size and place:** 36 px wide, at least 140 px tall, flush to the screen edge and centred vertically, with frost fill and 14 px corners on the inner side.
- **Taper:** a 10 px concave fillet at the top and bottom where it meets the edge.
- **Contents**, stacked:
  - the chevron;
  - the neighbouring area's icon;
  - its name, rotated, with **no numerals** ("Book", "Research", "Create", "Refine"), set in the notch pill's type (Geist Medium 12.5) in `text/dim`.
- **Neighbours:** Research has Book ← and → Create. Create has Research ← and → Refine. Refine has Create ← only. The whole Book has none.

**Build**

- `canvas/EdgeTab.tsx` replaces `PageTurn` in `Book.tsx`.
- `SIDE` becomes 0, or is removed. The corners no longer move in, so Back and the minimap sit 14 px from the window edges.

**Done when** the edge tabs match R3 and R4, and the freed width is used (the board's fit and the corners are no longer inset by 56 px).

### Phase 6 · Session dock and Needs you

**What it is** (`2258:69`; R2 expanded, R3 collapsed with hover, R4 Needs you):

- **Place and shape:** a side notch on the right edge, with its top at y 104. It has frost fill, 16 px inner corners and the same taper as the edge tabs.
- **Collapsed:**
  - A 22 px Orchestrator dot on top. Under it, one 12 px status dot per agent in the session, 14 px apart. **No connecting line.**
  - **Colours:** working `#5B7CFF`, done `#6FDC8C`, needs you `#FFA24A`, idle `text/faint` grey, error `#FF5A5F`.
  - **Hover** on a dot shows a small frost label to its left: name in Geist Medium, task in dim ("Brand Kit  working · drafting palettes").
- **Expanded** (click the dock):
  - The notch widens to about 180 px, with a float shadow, over the board.
  - Each row shows the dot, the agent's name and a one-line status ("Palette locked", "Lockups", "Waiting on Logo").
  - The Orchestrator row is on top ("Conducting · 3 playing"), separated by a hairline.
  - Click outside or press Esc to collapse.
- **Needs you lives here now:**
  - When anything needs the user, the Orchestrator dot turns amber, with an amber radial gradient and a soft amber glow.
  - A **"Needs you · N" pill** with a 6 px amber dot floats beside the dot, to its left.
  - Clicking the pill opens the existing Needs you panel ("Where you're needed") under it.
  - The old standalone Needs you button goes.

**Build**

- `canvas/SessionDock.tsx`.
- **Data:** `window.api.agentStates(project)` (keys are `musician` or `musician--instrument`), refreshed on `onChatEvent` events of kind `'agents'`. `useNeeds(projects)` comes from `NeedsYou.tsx`.
- **Which agents:** one dot per **Musician** (deliverable agent) that is selected in the project (`loadCreate(project).selected`) or has a state. Roll each Musician's Instruments into its dot. The most urgent status wins: needs you (`waiting`) > error > working > done > idle (`stopped`/none).
- **Names:** the Musician's display name from the library if the API exposes it. Otherwise title-case the id.
- Reuse `NeedsYou`'s panel; only its trigger and anchor move.

**Done when** the dock matches R2, R3 and R4, statuses change live while agents run, and Needs you behaves exactly as before, apart from where it is.

### Phase 7 · Create and Research details

All of these are in R3 and R4:

- **Prerequisite rows** (`Create.tsx`, around the `state === 'Ready'` rendering):
  - *Ready* rows get a green fill (`status/done` at 16% over frost) **and** a green stroke (75%).
  - *To make* rows stay frost with the faint stroke; unavailable rows have no stroke.
- **Lock in** (`Create.tsx`, `lockIn` button): no longer an orb.
  - A 104 × 104 card styled exactly like a selected deliverable seat: `radius/md` 6, blue tint `rgba(46,85,255,.13)`, blue stroke `rgba(124,149,255,.5)`, soft blue glow.
  - "Lock in" sits inside in Instrument Serif Italic, with "4 ON" in mono under it.
  - Wires still meet its left edge.
- **Selected deliverable seats:** blue tint 13% (was stronger), stroke 50%, soft glow. Unselected seats are frost.
- **Interpret box** (`Research.tsx`): a muted deep-indigo panel. Use a radial gradient from `#24306F` to `#12142B` with a 32% lilac stroke, not the bright blue glow. The chalk "Interpret again" pill stays.
- **Gradients:** keep every gradient soft. Project covers keep their full gradients; nothing else glows strongly.

### Phase 8 · The Orchestrator face (liquid glass)

**What it is:** the ∫ from the original mark (`assets/icons/logo-mark.svg` path) suspended in a bead of liquid glass, rendered live. The full shader and state machine are in `orchestrator-states.html`. Port them; don't redesign.

- **Body:** a WebGL2 fragment shader.
  - A metaball field for the shape, so it can wobble and droplets can bud off.
  - Refraction that magnifies the ∫.
  - A domain-warped swirling interior, a fresnel rim and two speculars.
- **SVG layer on top:** the thin ring and the needs-you badge.
- **States:**

| State | Trigger in the app | What changes |
| --- | --- | --- |
| Waiting | Nothing running | Slow drift, 6 s breath |
| Listening | Bar input focused with text, or typing | ∫ leans 8°, ring visible, soft ripple per key |
| Sent | On send | Gentle squash spring, ripple, ∫ turns 180°, about 1.6 s; then Thinking |
| Thinking | `busy` true, no `live` text yet | Faster swirl; ∫ dissolves like ink and re-forms |
| Working | Any Musician `working` | Ring arc spins (4.5 s); one droplet per working Musician orbits and merges back |
| Needs you | `useNeeds` non-empty | Amber halo swelling every 3 s, badge |
| Done | A Musician goes to `done` (hold 3 s) | Green rises through the liquid; ring draws closed |
| Error | `error` chat event | Grey and still; ring dashed; one slow sway. The bar names the failure and offers Retry |

**Build**

- `canvas/liquid.ts` holds the GL setup, shader strings and one shared rAF loop.
- `canvas/OrchestratorFace.tsx` takes `state` and `size` props and falls back to the flat SVG orb if WebGL2 is missing.
- Use it in the Orchestrator bar (replacing the `logo-mark` circle) and in the session dock's Orchestrator dot.
- **Performance guards** (required):
  - At most one or two live GL faces.
  - Pause when the window is hidden or blurred (`visibilitychange`, `blur`).
  - Run 30 fps in Waiting, 60 fps only during one-shots.
  - Render the 36 px bar face at device pixel ratio 1.
  - Freeze to a still frame under `prefers-reduced-motion` or when on battery saver.

**Done when**

- The face in the bar walks through the states as the app is used, with no visible jank.
- With the window in the background, GPU use drops to about zero.
- Reduced motion shows colour changes only.

### Phase 9 · Clean-up and docs

- **`AGENTS.md` UI rules:**
  - Corners now follow the radius scale, not "sharp everywhere".
  - The current/hover face is Instrument Serif Italic.
  - Needs you is amber.
  - The breadcrumb is replaced by tabs, and the page strips by edge tabs.
  - The two kinds of UI now include the notch, edge tabs and dock as viewport chrome.
  - Also bump the "last checked" line.
- **`ideation/brand-spec.md`:** add a short "Nocturne" section pointing at `claude/alt-nocturne.md`, or ask the owner whether Nocturne replaces v2 there.
- **Remove dead code:** `Breadcrumb`, `PageTurn`, the `crumbs` prop, the logo in the header, and the old fonts once unused.
- **Theme switch:** decide with the owner whether to keep the v2 switch.
- **`CHANGELOG.md`:** one entry per phase.

## 5. Order, branches and size

- Phases 1–2 first; everything later depends on them. Phases 3, 4 and 5 can run in parallel in separate worktrees; they touch different parts of `Chrome.tsx`, so merge 3 → 4 → 5. Phase 6 needs Phase 3's header slot. Phase 7 is independent. Phase 8 is last, because it is the riskiest.
- Branch names: `nocturne/1-theme`, `nocturne/2-surfaces`, `nocturne/3-tabs`, … . Merge commits, no squash, no force-push (per `AGENTS.md`).
- Stage files by name. Never `git add -A`; running the app writes vault files.

## 6. Contingency plan: what to do when something isn't specified

Use the rules in this order. Write down every inference in the PR description under **"Inferred"**, with the rule number, so the owner can review them in one place.

1. **The reskin screens beat everything else.** If the Figma reskin page (R1–R6) shows it, match it. If only the Mockups page shows it, use it for mood but keep the reskin's components and values.
2. **Not drawn at all? Apply the system, don't invent a style.** These screens exist in code but have no Nocturne frame:
   - the Agents screen and Ensemble;
   - the MCPs and Settings / provider windows;
   - the opened Orchestrator conversation and its agents side panel;
   - deliverable windows and card `kinds`;
   - Graph3D;
   - Doc and Preview windows;
   - Layers;
   - the Deliverable editor;
   - the Opening animation;
   - Refine (still a placeholder).

   For each, build the same layout as today and dress it only with the Phase 1 tokens:
   - **Panels:** frost with a 12% stroke, radius `lg` for windows and `md` for controls.
   - **Text:** chalk; secondary text dim; labels in Geist Mono caps.
   - **One serif accent:** at most one Instrument Serif Italic phrase per window, usually its title.
   - **Paper cards:** files and outputs stay chalk "paper" with dark text, the one light surface.
   - **Colour:** blue only for active, selected or working.
3. **Colours: never introduce a new hex.** Use a token. If none fits, derive one from an existing token by opacity (e.g. white 6/10/12/22%, chalk 64/40%) and add it to `nocturne.css` with a comment saying where it's used. Raw hex in `.tsx` stays forbidden.
4. **Kinds and their colours** (`canvas/kinds.tsx`): keep the meanings and swap the palette.
   - Agents: a blue header becomes the 13% blue tint with a blue-bright rank tab.
   - Files: paper becomes chalk paper.
   - Finished work: ink becomes `bg/raised` with a chalk border.
   - Decisions: the diamond keeps its shape, in amber if it is waiting on the user.
5. **Hover and current state:** the v2 Bodoni-italic swap (`serif-on`, `type-current-*`, `serifHold.ts`) carries over with Instrument Serif Italic. Keep `serifHold`, because Instrument Serif is narrower than Bodoni and the width hold still prevents jumps. If a label looks wrong in the serif (too small, below 13 px), use a colour change to chalk instead and note it.
6. **Covers and dither art keep their identity.** Blue covers, dithered engravings and the poster stay as they are. They are content, not chrome. Only the frame around them changes.
7. **Status mapping:**
   - `waiting` → needs you (amber);
   - `working` → blue;
   - `done` → green;
   - `stopped` and no state → idle (faint);
   - `error` → red.
   - Anything new defaults to idle and gets a `// shortcut:` comment.
8. **Data you need but the API doesn't give.** Prefer what `window.api` already returns. If you truly need a new IPC call (e.g. Musician display names), add it beside its feature group in `main/index.ts` and `preload/index.ts`, validate inputs in main (rules 4 and 5), and keep it read-only. If it would write anything, **stop and ask**.
9. **Layout collisions.** If a new piece overlaps existing chrome at 1440 × 900 or at the 1280 × 800 minimum:
   - move the newer piece first: dock first, then edge tabs, then Needs you panel;
   - never the bar or the tabs;
   - keep 12 px between floating pieces and 14 px from window edges.
   - Below 1280 px wide, the expanded dock and Needs you panel may overlap the board, but never each other.
10. **Tabs edge cases:**
    - A deleted project closes its tab silently.
    - A window opened with `#project=` starts with that one tab.
    - With more tabs than fit, tabs shrink to a 120 px minimum with the name truncated, then the strip scrolls horizontally.
    - The tab order persists per window.
11. **Motion:**
    - Use `--ease` for chrome and `--ease-calm` for the face and status changes.
    - If a value is missing, choose the slower, smaller option; the owner asked for calm and ethereal.
    - Nothing shakes, and nothing moves faster than about 250 ms except a hover colour change.
12. **WebGL problems:**
    - If WebGL2 is unavailable or the context is lost, fall back to the flat SVG orb, with a radial gradient in the state's colour.
    - If frame time stays above 4 ms on the dev machine, drop the face to device pixel ratio 1 and 30 fps everywhere before simplifying the shader.
13. **Fonts:** if a package won't install or a glyph is missing, fall back in this order: Geist → `system-ui`, Geist Mono → `ui-monospace`, Instrument Serif → `Georgia` italic. Note it in the PR.
14. **Figma unreachable:** everything needed to build is in sections 2 and 4. Work from those plus `alt-nocturne.md` and `orchestrator-states.html`.
15. **Specs that disagree with each other:** this plan is newer than `brand-spec.md`, `canvas-spec.md` and the v2 rules in `AGENTS.md`, and wins over them. The Figma reskin page wins over this plan if they differ on a visual detail.
16. **When to stop and ask instead of inferring:**
    - anything that deletes or rewrites user data, or changes the vault's file formats;
    - removing a feature (beyond the breadcrumb and page strips replaced here);
    - adding a dependency other than the three font packages;
    - splitting `Create.tsx`, `index.ts` or `conductor.ts` (coordinate first, per `AGENTS.md`).

## 7. How to check each phase

- **Side-by-side screenshot:** use the Figma frame from `get_screenshot` and the app at 1440 × 900, on the same screen with the same sample project. A Playwright `_electron` launch works, or the renderer in a browser with a mocked `window.api` (that's how the reskin reference was captured). List the remaining differences in the PR.
- **Checks:** typecheck, tests and lint are clean (no new lint errors), with Prettier run on the changed files only.
- **Reduced motion:** turn it on in the OS. Nothing moves; colours still change.
- **No raw hex in any `.tsx` file:** `grep -rnE "#[0-9a-fA-F]{3,8}\b" app/src/renderer/src --include=*.tsx` returns nothing new.
- **`git status`:** shows no vault files staged.

## 8. Open questions for the owner (don't block on these; use the default)

| Question | Default if no answer |
| --- | --- |
| Does Nocturne replace v2 entirely, or stay as a theme? | Nocturne by default, v2 behind `localStorage.theme` until Phase 9 |
| Should Book keep the workspace grey or get a landscape? | Grey |
| Needs you pill: this project's count or all projects'? | All projects, as Needs you works today |
| Should the session dock appear on the Studio? | Yes, with the Studio Orchestrator dot and the pill only; no agent dots |
| Should the Back button stay now that tabs and Home exist? | Keep it inside books; hide it on Studio and Setup |
| Should tabs tear off into new windows (main already supports it)? | Not in this pass |
| The ∫ logo: keep it as is, or redraw it for small sizes? It is gone from the header either way | Keep `logo-mark.svg` for the app icon, the face and the splash until a redrawn mark lands in Figma |
