# Orchestra alt direction: Nocturne

An alternate, after-dark look for Orchestra, inspired by TwelveLabs (Pentagram's identity: dark ground, soft volumetric pastel gradients, geometric type) and One (getone.one: floating glass chrome, an agent dock, one inbox). It sits beside the v2 canvas language in `brand-spec.md`; nothing in v2 changed.

- **Figma:** file `AqpBpdKicUBczcUwdiDEnk`, pages **Alt · Design system**, **Alt · Mockups** and **Alt · App reskin** (after Mockups).
- **Status:** exploration, Nov 10 2026.

## Tokens (all prefixed so they don't mix with v2)
- **Variables:** collection `Orchestra/Alt · Nocturne` (one Dark mode, 30 variables).
  - Surfaces: `bg/sunken #060607`, `bg/base #0A0A0C`, `bg/raised #141418`, `bg/workspace #1C1C20` (the canvas inside a project).
  - Glass: `glass/frost` near-black `#08080A` at 86% (added Nov 10; every frosted panel sits on it), `glass/fill` white 6% and `glass/fill-strong` 10% (now only for chips and pills inside a panel), `glass/stroke` 12%, `glass/stroke-strong` 22%.
  - Error: `status/error #FF5A5F` (a variable since Nov 10; `Alt/Status dot` has an Error variant).
  - Text: `text/primary #F4F2EE` (chalk), `text/dim` 64%, `text/faint` 40%.
  - Accent: `accent/blue #0538FF` for fills, `accent/blue-bright #5B7CFF` on dark.
  - Status: `status/working #5B7CFF`, `status/needs-you #FFA24A`, `status/done #6FDC8C`.
  - Gradient light: chalk `#EDE8DF`, peach `#F6B89A`, pink `#F2A7C3`, green `#B9E4A3`, lilac `#B7B5FF`. These now also tint the landscapes.
  - Radius (lowered Nov 10): `radius/sm` 4, `radius/md` 6, `radius/lg` 10, `radius/pill` unchanged. Spacing 4–40.
- **Text styles `Alt/*`:** Geist Light for display (96, 64), Geist Regular and Medium for headings and body, Geist Mono for labels and logs, Instrument Serif Italic as one accent phrase per screen.
- **Effect styles:** `Alt/Glass` (background blur 28, soft low shadow, 1 px top highlight), `Alt/Float`, `Alt/Glow blue`, `Alt/Orb blur` (layer blur 90, now only used on project covers), `Alt/Landscape blur` (layer blur 28).
- **Paint styles:**
  - `Alt/Pattern/Canvas dots`, the artboard dot grid (white-dot 24 px tile from `Pattern/Poster` at 42%, about 14% white).
  - `Alt/Landscape/Sunset`, `/Alpine`, `/Desert`, `/Hills`, `/Coast`: the background plates (image fills, 320×200, scaled to fill, saturation −25).
  - `Alt/Landscape shade`: a vertical dark wash, 20% at the top to 70% at the bottom, so chrome and the bar stay legible.
- **Figma gotchas:**
  - A paint bound to a color variable loses its paint-level opacity, so translucent tints use raw colors with opacity.
  - Images created inside a plugin script only persist up to roughly 200 KB; the landscapes are rendered at 320×200 for that reason. Applying an image paint style with `setFillStyleIdAsync` left fills empty, so the image fill is set directly as well.

## Where the landscapes go (Nov 10, later)
- **Home screens only:** Studio (R1, N1), Setup (R6) and the Cover editor (R5) keep the blurred landscape.
- **Inside a project** (Book R2, Research R3/N3, Create R4/N2, and Refine when it's drawn) the canvas is flat dark grey: new variable `bg/workspace #1C1C20`, with the dot grid on top. The landscape and shade layers are still on those artboards, just hidden, so it's one toggle to compare.
- **Why:** work screens stay calm and focused, the near-black frost panels still read against the grey, and the shader-free canvas costs nothing to draw.

## Design system v2 (Nov 10, later)
- The page **Alt · Design system** now leads with **Nocturne · Design system v2** (frame `2265:46`), in ten sections:
  1. Colour (`2265:55`)
  2. Type (`2266:2`)
  3. Shape and space (`2266:82`)
  4. Surfaces and effects (`2267:2`)
  5. Motion, with stills of the eight Orchestrator face states (`2267:48`)
  6. Backgrounds (`2268:2`)
  7. Chrome (`2268:18`)
  8. Board pieces (`2269:68`)
  9. Icons (`2269:284`)
  10. Do and don't (`2269:297`)
- Every live component master was moved into it, with IDs unchanged.
- `status/error #FF5A5F` is now a variable, and `Alt/Status dot` has an Error variant.
- The v1 frame is kept to the right, renamed "Archive · Nocturne design system v1". The deprecated chrome (Crumb, Crumb link, Page strip, the old Needs you) is in "Archive · deprecated chrome".
- **No logo in the header:** the Mark was removed from the top bar on every screen. Home now sits 14 px from the left. The Mark is kept for the app icon and splash. A small-size redraw of the ∫ is an open idea.

## Edge tabs and the session dock (Nov 10, later)
- **Edge tabs** (`Alt/App/Edge tab`, Side left/right; props Mode and Label): the full-height page strips are now side notches, 36 wide and at least 140 tall, flush to the screen edge and centred vertically. Each holds a chevron, the neighbouring movement's icon and its name (Book, Research, Create, Refine; no numerals), set in the notch pill's type (Geist Medium 12.5) and rotated. Research: Book ← → Create. Create: Research ← → Refine. Book has none.
- **Taper:** like the top notch, every side notch has 10 px concave fillets where it meets the screen edge, top and bottom, so it reads as growing out of the edge. The active header tab flares the same way (8 px) where it meets the canvas.
- **Session dock** (`Alt/App/Session dock`; Needs you yes/no × Expanded yes/no): a separate side notch on the right edge, its top at y 104 (a little below the header), same taper. A 22 px Orchestrator dot on top and one 12 px status dot per deliverable agent (Brand Kit, Logo, Motion, Slide Deck) under it, no connecting line. Dot colours: blue working, green done, amber needs you, faint idle. Hovering a dot shows a small label (agent · what it's doing).
- **Needs you:** the Orchestrator dot turns amber and a "Needs you · 1" pill with a small 6 px amber dot floats beside it to the left. Clicking the pill opens the Where you're needed panel under it.
- **Expanded:** clicking the dock widens the notch to about 180 px and lists each agent's name and current task beside its dot, with the Orchestrator row on top ("Conducting · 3 playing"). It floats above the board with a soft shadow.
- **Per screen:** Book shows the dock expanded (Brand Kit done, Logo and Motion working, Slide Deck idle); Research shows it collapsed with a hover label on Brand Kit; Create shows the Needs you state with the panel open. Back and the minimap moved out to 14 px from the edges.

## Header: tabs instead of breadcrumbs (Nov 10, later)
- **Layout:** Home button (no logo), a hairline divider, then Figma-style document tabs, one per open project, then a + for a new tab. Zoom stays on the right. Everything centres on the tab labels (y 32).
- **Home** (`Alt/App/Home`, Active yes/no) replaces the Studio crumb and is lit on Studio and Setup.
- **Tab** (`Alt/App/Tab`, Active yes/no; props Label and Mode): mode icon + project name. The active tab is filled with `bg/workspace`, has a faint top and side outline and a close ×, and runs down into the canvas so the tab and the board read as one sheet. Inactive tabs are bare and dim.
- **Mode icons** (`Alt/Icon/*`, Remix Icon line set, the same family the app already uses): Book = layout grid, I Research = open book, II Create = quill pen, III Refine = medal, plus Home, New (+) and Close. A tab's icon shows which movement that project is open in, so several tabs read at a glance.
- **Notch:** the Area switch now holds the same four icons; the current area expands into the chalk pill with its icon and label (e.g. "II · Create"), the others are icon-only buttons.
- **Per screen:** Studio and Setup light Home (Setup has no tabs yet); Book, Research and Create show Orchestra active with the matching icon, next to Kiln Ceramics (Research) and Forma Editorial (Refine); the Cover editor opens a new "Untitled" tab with the + icon.
- These components now live in section 07 Chrome of the design system v2 frame.

## Create stage states (Nov 10, later)
- **Ready prerequisites:** green fill and stroke: `status/done #6FDC8C` at 16% over `glass/frost`, stroke at 75%. To-make rows stay frost with the faint white stroke; unavailable rows have no stroke.
- **Lock in** is a card, not an orb: 104 × 104, `radius/md`, the same blue tint (13%), blue stroke (50%) and soft glow as a selected deliverable seat.

## Area switch as a notch (Nov 10, later)
- The Area switch (`Alt/App/Area switch`, all four variants) now hangs from the top bar like the old MacBook notch: square top, 14 px bottom corners, the same `glass/frost` fill as the bar, a stroke on the sides and bottom only, and two 10 px concave fillet "ears" where it meets the bar.
- Instances on R2–R4 sit at y 51, centred, overlapping the bar's bottom hairline so the bar and notch read as one piece.

## Toned-down accents (Nov 10, later)
- `Alt/Glow blue` is now a soft halo: blue at 20% (was 55%), radius 32.
- Blue gradient UI (the Interpret box, Lock in, the N2 podium orb, the Setup welcome orb) uses a muted core and a deep indigo edge instead of near-white into saturated blue. The Interpret box stroke dropped to 32%.
- Selected deliverable seats: blue fill 13% (was 28%), stroke 50%.
- Decorative area orbs (Book previews, Setup backdrop, N3 section glows) sit at 55% opacity.
- Project covers keep their full gradients, and the Orchestrator orb stays bright: it's the one living thing on the screen.

## Landscape backgrounds (Nov 10)
The abstract orb gradients behind each artboard were replaced by blurred landscapes: you can tell it's a sunset or a mountain lake, but it reads as a gradient.
- **Five plates**, shown in the **Landscape plates** frame under the design system:
  - **Sunset:** violet sky into peach, layered indigo ridges with pink mist.
  - **Alpine:** blue-hour lake, lilac horizon, snow-lit peaks reflected, soft shoreline trees.
  - **Desert:** violet into amber, mesas.
  - **Hills:** slate into sage and gold twilight, rolling green hills.
  - **Coast:** foggy chalk sky, grey sea, headlands on the right.
- **Treatment:** layer blur 28 and image saturation −25 (both raised on Nov 10, from blur 6 → 18 → 28, for a softer, quieter read). The landscape layer bleeds 80 px past every edge so the blur never shows a hard border.
- **How they're made:** drawn in code (sky stops, sun glow, fractal ridges with haze, mist, vignette) inside the Figma plugin, because Figma AI image credits are used up until Nov 25 and outside image hosts are blocked from the workspace. Swap in real photos or paintings any time by replacing the image in the paint style.
- **Assignment:**

| Screen | Landscape |
|---|---|
| R1 Studio, R6 Setup, N1 Studio | Sunset |
| R2 Book | Hills |
| R3 Research, N3 Research | Desert |
| R4 Create, N2 Create | Alpine |
| R5 Cover editor | Coast |

## Rules
- Chrome floats as frosted near-black glass (`glass/frost` plus the `Alt/Glass` background blur), so every panel, card, bar and row stands off the bright landscape. White-tint glass is only for chips nested inside a panel.
- Home screens (Studio, Setup, Cover editor) sit on the blurred landscape; inside a project the canvas is `bg/workspace` grey. Both carry the 24 px dot grid.
- Layer order on every artboard: base fill, landscape (blurred, desaturated, bleeding 80 px, locked), shade (locked), dot grid (locked), then content. The dots sit above the light so they stay visible.
- Landscapes are always blurred, never sharp photos and never flat pastel fills, and only on home screens.
- Project covers keep their orb mix until Brand Kit sets their own colors.
- Status dots: blue working, amber needs you, green done, red error, faint idle.
- Interpretations and outputs are chalk "paper" cards with dark text, the one light surface on a board.
- The current area in the notch and the primary button are chalk pills; everything else is frost.

## Components (`Alt/*`)
Status dot (5 states), Key, Button (Primary chalk / Glass / Ghost), Inbox card (answer 1–3, Esc undoes for 2 s), Project cover (Title, Client props), plus the app chrome listed above. The v1 Agent dock and Orchestrator bar are archived.

## Mockups (concept, page Alt · Mockups)
- **N1 · Studio:** greeting, project covers as gradient cards, dock on the right edge, bar at the bottom.
- **N2 · Create stage + floating inbox:** seats around a glowing Deliverables orb, foundations row, and the inbox popover opened from the dock with a question card and a finished card with two suggested next steps.
- **N3 · Research board:** glass section cards, wires with theme pills, the chalk interpretation card.

## App reskin (page Alt · App reskin)
The real app, reskinned screen for screen. The reference was the repo itself (`TheSwearWords/orchestra` @ `688a14f`): the renderer was run in a browser with a mocked `window.api`, fed by the real agent library (11 Musicians, 23 Instruments) and the `orchestra-brand` project, then captured at 1440×900. Layouts, labels and positions follow those captures.

- **App chrome components (`Alt/App/*`):** Mark, Crumb (Current yes/no), Crumb link, Zoom, Back, Area switch (Book / Research / Create / Refine), Needs you, Minimap, Orchestrator bar (the real Work mode chip, the field and the usage meter), Page strip, New card.
- **Screens:**
  - **R1 · Studio:** covers on the shelf with Needs-you tabs, the desk (Agents, MCPs, Knowledge graph, Settings), the Knowledge graph window, New project, the Studio label.
  - **R2 · Book:** the whole-book spread with the three area previews.
  - **R3 · I Research:** the Orchestra research group (Reference links, Inspiration, Usable assets), the Art direction Interpret box and its wire, New asset, the II Create page strip.
  - **R4 · II Create + Needs you:** the deliverables grid (Brand Kit, Logo, Motion, Slide Deck on), prerequisites with Ready / To make, Lock in, the Brand spec output card, both page strips, and the Needs-you panel open on the Colours question.
  - **R5 · Cover editor:** the live cover and the first interview question.
  - **R6 · Setup:** the welcome window, the coach line and the Open the studio checklist.
- **Sample data:** Forma Editorial and Kiln Ceramics are placeholder projects; the Orchestra project, library and reference links are real.
- **Code differences to note:** the real bar's modes are Work / Customize / Code (Customize and Code not ready yet); the Studio label, page strips and Needs you panel come from the code, not from `canvas-spec.md`.

## Orchestrator states (motion study)
An interactive page, "Orchestrator States" (claude.ai artifact EfSfRjqxuea4XpPGstX8jC), shows the Orchestrator's face: the ∫ from the original mark inside the Nocturne glass orb, with a ring around it.
- **Liquid body (v2, Nov 10):** the orb is now a WebGL fragment shader: a metaball field for the shape (so it wobbles and droplets can bud off and merge), refraction that magnifies the ∫ like a glass bead, a domain-warped swirling interior, a fresnel rim and two speculars. An SVG layer on top keeps the ring and the badge. Each state only changes shader inputs (colours, flow speed, wobble, ink dissolve, droplets, flood), eased over about 1 s; one-shots add impulses (surface ripple, squash spring, shake, 180° spin). Falls back to the flat SVG orb without WebGL2.
- **Waiting:** breathes on a 6 s loop.
- **Listening:** the ∫ leans 8°, the ring wakes, each key sends a ripple (160 ms).
- **Sent:** squash, shockwave, and a 180° turn of the ∫ (it's symmetric, so it lands the same), about 1.8 s once.
- **Thinking:** the liquid swirls faster and the ∫ dissolves like ink in water, then re-forms.
- **Working:** a ring arc spins (4.5 s); one droplet per active Musician buds off, orbits and merges back, tinting the liquid with its gradient-light colour.
- **Needs you:** amber halo, a slow swell every 3 s, badge on the shell.
- **Done:** green floods up through the liquid, the ring draws closed (1.6 s), the ∫ pops, then back to Waiting after 2.4 s.
- **Error:** the liquid goes grey and still, the ring breaks into dashes, the bead sways once, slowly; the bar names what failed and offers Retry.
- **Calm pass (Nov 10):** everything slowed and softened on request. The face uses its own slow in-out curve `cubic-bezier(.45,.05,.25,1)`; state changes ease over about 1 s; liquid flow roughly halved; key ripples, the send squash and the done pop are soft springs that fade over 1–2 s; error is one slow sway, not a shake; ring spin 4.5 s, needs-you swell 3 s, waiting breath 6 s.
- **Build:** `<OrchestratorFace state size />`, a WebGL2 shader body with an SVG ring and badge layer, slow in-out easing, about 1 s colour transitions. Falls back to a flat SVG orb. Reduced motion keeps colour and stops all movement.
- **Source:** `claude/orchestrator-states.html` (this project) is the full working reference: shader, state machine, timings and the landscape renderer.

## Next
- Optionally swap the drawn plates for real blurred photos or paintings (Figma AI credits return Nov 25).
- Discuss the floating overlay as a real feature: the dock and inbox outside the app (above Figma, Blender and others), and on a phone for the render workstation.
