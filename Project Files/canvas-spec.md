# Orchestra canvas: feature spec

This is the implementation spec for the canvas UI. Each screen says what it looks like, how it works and what it reads and writes.

- **Figma:** file `AqpBpdKicUBczcUwdiDEnk`, Mockups page, section "Canvas concept · the book". The frames are C1–C8.
- **Related docs:** `canvas-concept.md` (the idea), `elastic-architecture.md` (parts, the three bar modes, safety).
- **Status:** spec from the walkthrough of Nov 6, 2026.

Words used throughout:
- **Studio:** the home canvas, where all projects sit.
- **Book:** one project.
- **Area:** Research, Create or Refine inside a book.
- **Section:** a movable card group on an area's board, such as Reference links.
- **Seat:** a deliverable on the Create stage.

---

## 0. Shared across every screen

### 0.1 Canvas
- **Background:** an infinite board with the dot grid (24 px, blue at 20% on white).
- **Moving around:** drag empty space to pan; scroll or pinch to zoom. Double-clicking an object zooms to fit it, and Esc zooms out one level.
- **Snapping:** anything movable snaps to the 24 px grid when you let go.
- **Saving:** positions are saved for each canvas (see Data). Tidy resets the current canvas to its default layout, with a 450 ms ease.

### 0.2 Floating chrome
White chips with a blue hairline and a soft shadow, never a full-width bar.

| Where | What |
| --- | --- |
| Top left | **Breadcrumb**, for example `Studio / Forma Editorial / Research`. Each step zooms back out to that level. The last step is in Bodoni italic. |
| Next to the breadcrumb, inside a book | **Area switch:** I / II / III. The current one is blue with its Bodoni name. |
| Top right | **Tidy** (only when something has moved), then **zoom %** with − and +. |
| Bottom right | **Minimap** (see 0.3). |
| Bottom centre | **Orchestrator bar** (see 0.4). |

### 0.3 Minimap
- **What it shows:** the current canvas in miniature, with a box for your view. Clicking or dragging in it moves the view.
- **New: a page label.** A small strip on the top edge of the minimap names where you are: `STUDIO`, `BOOK`, `I · RESEARCH`, `II · CREATE`, `III · REFINE`, `ENSEMBLE` or `MEMORY`. Inside a book, the minimap shows the three areas side by side, and the current one is filled.

### 0.4 Orchestrator bar
- **Look:** the 1B input style. A small orb, an underlined field, a `/` key hint and a "To …" label on the right that names who the message goes to.
- **Who it talks to depends on where you are:**

| Where you are | "To" | What it can do |
| --- | --- | --- |
| Studio | Orchestrator · Studio | Start a project ("start a brand project for Kiln"), find or compare projects, open one |
| Book map | Orchestrator · project | Questions about the project as a whole (the old General chat) |
| Research | Orchestrator · Research | Add references, set up sections, run an interpretation |
| Create stage | Orchestrator · project | Choose deliverables, brief Musicians |
| Inside a deliverable | That deliverable's chat | The Brand Kit chat, for example |
| Ensemble | Orchestrator · library | Create or edit agents |

- **Modes:** the bar has the three modes from `elastic-architecture.md`: **Conduct** (white), **Arrange** (blue) and **Terminal** (ink, mono). Switch with the segmented control on the bar, or type `/conduct`, `/arrange` or `/terminal`.
- **The drawer (C7):** clicking the bar, or pressing `/`, slides the drawer in from the right. It holds the conversation, agent status and created files. While it's open the canvas behind dims to about 55%, except the object you're talking about.

---

## 1. Studio (C1)

**What it's for:** every project at a glance, arranged however you like.

**Look:**
- Each project is a **book cover** (see 2.3) floating on the canvas, with a slight random tilt of ±4° and a drop shadow.
- Free text labels can sit on the canvas to group covers ("CLIENT WORK", "MINE").
- A **blank cover with a dashed outline** sits at the end of the shelf: "+ New project".
- "Studio" is set in Bodoni Display at bottom left, with the project count.
- The Orchestrator bar is at bottom centre. **Add it to C1.**

**What you can do:**

| Action | Result |
| --- | --- |
| Drag a cover | Moves it, snapping to the grid. Tidy appears. |
| **Hover a cover** (about 250 ms) | The cover swings open about 35° on its spine, showing the first page with **Enter project** (primary) and **Edit project** (secondary). Moving away closes it. On touch, the first tap opens it and a second tap chooses a button. |
| Enter project | Plays the opening (C3), then lands on the book map (C8). |
| Edit project | Zooms into the cover editor (C2) in edit mode. |
| Right-click a cover | Menu: Enter, Edit, Open in a new window, Duplicate, Archive, Delete. Delete asks for confirmation and moves the project to Trash. |
| Click the blank cover | Opens the cover editor (C2) in new mode. |
| Right-click empty canvas | Menu: New project, Add label, Tidy. |

**Cover states:**
- **A ribbon** shows the current movement ("II Create · playing") and whether an agent is working.
- **An orange "NEEDS YOU" tab** sticks out of the top edge when an approval is waiting.
- **Archived** projects are hidden. Archive is listed under Settings.

**Data:**
- Studio layout: `Orchestra/studio.json`, which holds `{ covers: { <projectId>: [x, y, rot] }, labels: [...] }`.
- Projects: the `projects/` folders, as now (`projects.ts`: id, name, client, concept).

---

## 2. Cover editor: new and edit project (C2)

**What it's for:** making or changing a project. It's the same screen for both, and the cover you see is the result.

**Look:**
- The cover sits large on the left, at about 500×680, and updates live as you type.
- The edit panel is on the right, in the 1B type hierarchy: a large Bodoni question or label, an underlined field, and chips for the answers already given.

### 2.1 New mode (the interview)
1. **Questions.** They come one at a time: *What's it called?*, then *Who is it for?* (optional), then *What is this project trying to say?* Earlier answers show as chips above the current question, and clicking a chip goes back to it.
2. **Cover.** After the last question, the Cover settings appear (see 2.3).
3. **Create project.** This writes the project folder, closes the cover and drops it onto the shelf. **Create and open** goes straight into the opening (C3).

### 2.2 Edit mode (all fields at once)
- **Layout:** the same panel, but every field shows at once as label and underlined value rows: Name, Client, Concept, then Cover.
- **Saving:** changes save as you type, with a small "Saved" note.
- **Leaving:** **Done** zooms back to the Studio. **Enter project** goes into the book.

### 2.3 The cover
The cover has these parts:
- the spine, with the project's initials
- "ORCHESTRA PRESENTS" and an issue number ("NO. 01")
- a dithered art plate
- the title in Bodoni Display, then the client in caps
- the start of the concept
- a hairline, then "I · RESEARCH  II · CREATE  III · REFINE"

**Colour and art come from inside the project.** Each has **Auto** (the default) and a manual override.

| Setting | Auto picks | Manual |
| --- | --- | --- |
| Colour | Once Brand Kit's tokens exist, the project's primary colour (with legible text worked out from contrast). Before then, Orchestra Blue. | Blue, White, Ink, or any token from the project's kit |
| Art | The first image in a Usable assets section, dithered. If there are none, an Inspiration image. If there are none, a bundled ASCII or dither piece. | Any image in the project, or drop a new one |

- **Dithering:** the dithered plate is generated once and cached at `projects/<id>/cover/art.png`.
- **Auto updates:** while the cover is on Auto, it refreshes when its source changes.

**Data:** `projects/<id>/project.json` holds:

```json
{ "name": "Forma Editorial", "client": "Forma Studio", "no": 1,
  "cover": { "color": "auto", "art": "auto", "artSource": null } }
```

`concept.md` stays as it is.

---

## 3. Opening the book (C3)

- **When it plays:** on Enter project.
- **The animation:** 700 ms in three beats:
  1. 0–200 ms: centre the cover and grow it.
  2. 200–500 ms: the cover rotates on the spine, rotateY 0 → −160°.
  3. 500–700 ms: the camera pushes into the page, scale 1 → about 3.2.
- **Where you land:** the book map (C8).
- **No cut:** the dot grid stays continuous the whole way.
- **Reduced motion:** a 150 ms crossfade instead.
- **Leaving:** going back to Studio plays it in reverse, and the book closes into its place on the shelf.

---

## 4. Book map (C8)

**What it's for:** the project's front page. Its three areas sit side by side, so you can see how the project is set up.

**Look:**
- One open spread, with a blue spine on the left.
- Three columns, each a preview of its area at about 22% zoom:
  - **I · Research:** the sections and the interpretation document.
  - **II · Create:** the stage.
  - **III · Refine:** audit frames and the scorecard.
- Lines cross the spread in ink, each with a label:
  - "RESEARCH.MD BRIEFS THE ORCHESTRATOR"
  - "FINISHED WORK GOES TO REFINE"
  - "FIXES GO BACK TO THE SEAT" (dashed)
- The project name in the breadcrumb, and the Orchestrator bar addressed "To project".

**What you can do:**
- Click or double-click an area to fly into it.
- Press I, II or III to jump.
- Esc goes back to the Studio, closing the book.

**Live previews:** each column shows the area as it is right now, as a low-detail render of the real board.

---

## 5. Research area (C4 to C5)

**What it's for:** collecting what the project is reaching for, and turning it into a direction that agents can use. A project can have several research sets, each feeding its own interpretation.

### 5.1 Sections

**Each section is a card:**
- A header with a ⋮⋮ grip, its name (editable, Bodoni), a count and a collapse button.
- Drag the header to move it. Resize it from the corner.

**Four section types:**

| Type | What's in it | Card look |
| --- | --- | --- |
| **Reference links** | Links. Each block shows a large initial, the domain, your note and ↗. Clicking opens the link. | A stack of blocks, plus "Paste a link anywhere" |
| **Inspiration** | Images and files you want the feeling of | 2B-style tiles: dithered art, a source label, a note |
| **Usable assets** | Files that will be used as-is (logos, photos) | The same tiles |
| **Interpretation** | One markdown document, empty until interpreted | A paper card (see 5.3) |

**You can make as many of each as you like.** For example, "Type references" and "3D references", each with its own inspiration and assets.

**Creating sections:**
- Right-click empty canvas: **Add section** → Reference links / Inspiration / Usable assets / Interpretation.
- The new card appears where you clicked, titled "Untitled ⟨type⟩", with the name field focused.
- Right-click a section: Rename, Duplicate, Collapse, Delete (with confirmation; the files go to Trash).

**Adding content:**
- **Paste or drop.** Paste a URL, or drop files, onto a section to add them there. Dropped on empty canvas, they go into the nearest section of the right type, or a new one is created.
- **Move.** Drag an item between sections to move it. Inspiration and Usable assets stand in for the old tag.

### 5.2 Running an interpretation
1. In an Interpretation card, click **Choose sources**.
   - **Selection mode** turns on: every other section shows a checkbox, and the canvas dims slightly.
   - Click sections to include them, or shift-drag a box around several.
   - A dashed line runs from each chosen section to the interpretation card.
2. **Interpret** (primary, on the card).
   - The Orchestrator reads only the chosen sections: their items, notes, and images or links.
   - It writes the document, which streams into the card.
3. **When it's done,** small **theme pills** appear on the lines (from 2C), so you can see which section shaped which theme.
4. **Interpret again** rewrites the document. Earlier versions are kept in the card's history.

### 5.3 The interpretation card (C5)
- **Closed (on the board):** a paper card with:
  - **Direction** in Bodoni, with its two- or three-sentence summary ("Editorial and warm: …")
  - **Themes** as a short mono list
  - **Usable assets** listed by file name
  - a version stamp ("V1 · JUST NOW") and **Open** / **Interpret again**
- **Open:** the paper grows into a full reader in the centre of the screen, about 760 px wide. It has the whole markdown rendered and editable, a section outline at the side, and the version history. The board stays visible behind it, dimmed. Esc or ✕ closes it.
- **Who reads it:** any Musician can take an interpretation as its brief (`reads:` in its library file). The card shows which agents read it ("Read by: Brand Kit, Slide Deck").

**Data:**

```
projects/<id>/research/
  canvas.json                       section positions and sizes
  sections/<sectionId>/section.json {type, name, collapsed}
  sections/<sectionId>/items/*.md   one note per link or file, as now
  sections/<sectionId>/files/*      uploaded files
  interpretations/<interpId>.md     front matter: sources: [sectionIds], version, written
  interpretations/<interpId>/history/v1.md …
```

**Migration:** the current `references/` and `research.md` become:
- one Reference links section
- one Inspiration section and one Usable assets section, split by the old tag
- one Interpretation, called "Art direction", with `research.md` as its v1

---

## 6. Create area: the stage (C6 to C7, revised)

**What it's for:** choosing what to make, seeing what it depends on, and watching it get made.

### 6.1 Changes from C6
- **The centre is "Deliverables", not "General".** The podium is a large circle labelled **Deliverables**, with the orb inside. General moves to the Orchestrator bar (see 0.4).
- **Every possible deliverable sits around it.** All the Musicians in the library are seats on the arc:
  - Chosen seats are filled blue, with status and their last line.
  - The rest are white and quiet, and grouped by category (Brand, Web, Product, Motion, 3D, Code) along the arc.
- **A second, smaller circle for Prerequisites,** next to the main one (to the side or below, whichever the layout fits). Every foundation Instrument in the library sits around it.
  - **Lit:** a foundation that a chosen deliverable needs is lit and joined by a line to every seat that needs it.
  - **Unlit:** the others are greyed out.
  - **Status:** each lit foundation shows To make / Making / Ready.

### 6.2 What you can do

| Action | Result |
| --- | --- |
| Click a white seat | Chooses it. The seat fills, and its prerequisites light up and tick on in run order (`foundationOrder` in `plan.ts`). Lines draw from each foundation to the seat. Saved to `deliverables.md`. |
| Click a chosen seat | **Zooms into the deliverable** (6.3). |
| Seat menu (⋯ or right-click) | Unchoose (asks for confirmation if work exists), Open chat, Edit agent (goes to the Ensemble, 7). |
| Hover a foundation | Highlights every seat that needs it ("Shared ×3"). |
| **+ Add deliverable** (a dashed seat on the arc) | Opens a short form that writes a new Musician from the template. You can also ask the Orchestrator in Arrange mode. |
| **+ Add prerequisite** (a dashed spot on the small circle) | The same, for a foundation Instrument. |
| Drag seats | Reorders them along the arc. The arc lays itself out again to fit any number of seats. |

### 6.3 Inside a deliverable
- **Look:** zooming into a chosen seat opens its own board.
  - The breadcrumb reads `… / Create / Brand Kit`.
  - The seat card sits pinned at top left.
  - Its **Instruments** form a small tree under it.
  - **Assets** sit as cards on the board, grouped by Instrument (`outputs.ts` today):
    - files: md, json, svg, png
    - Figma frames (as thumbnails with a link to the file)
    - renders
  - **Interpretations it reads** appear as small paper cards with lines into the seat.
  - **Approvals** are orange "NEEDS YOU" cards, with Approve on the card (the C7 frame picker, for example).
- **The bar:** the Orchestrator bar is addressed to this deliverable's chat, and opens the C7 drawer.

**Data:**
- Stage layout: `projects/<id>/create/canvas.json`.
- Choices: `deliverables.md`, as now.
- Agent states: `agents:states`, as now.
- Assets: `listOutputs`, extended to also list Figma frames and renders, by Instrument.

---

## 7. Ensemble: agents (new screen)

**What it's for:** seeing and shaping the agents.
- **The hierarchy:** the Orchestrator leads Musicians, and Musicians lead Instruments.
- **What you can do:** create and edit agents, and see which model each one runs on.
- **Same style as C6,** laid out as a tree.

**Where it lives:**
- **On the Studio:** the Ensemble is a separate canvas, because the library is shared by every project. Open it from the Studio's Settings or with an "Ensemble" chip.
- **Inside a book:** "Edit agent" from a seat opens the same Ensemble, focused on that agent, with the project's live status shown on top.

**Look:**
- **The tree runs top to bottom:**
  - the Orchestrator (the orb) at the top
  - a row of Musicians below, grouped by category
  - each Musician's Instruments under it
  - shared foundation Instruments in their own row, joined to every Musician that needs them
- **Each agent node shows:**
  - its icon or dithered art and its name
  - its tier (Orchestrator, Musician or Instrument)
  - its model chip ("sonnet")
  - its source ("starter", "mine")
- **Clicking a node** opens two cards next to it, linked by a line:
  - **Instructions:** the agent's markdown prompt, rendered and editable, the same paper style as the interpretation card. This is the agent's library file (`musicians/<id>.md` or `instruments/<id>.md`).
  - **Setup:**
    - model, tools and permissions
    - `needs` / `prerequisites` / `instruments`
    - what it delivers and what it outputs
    - which interpretations it `reads:`
    - its provider (Claude for now; other providers later)
- **Inside a project,** each node also shows a status dot (working, waiting, done, error), and clicking it can open that agent's log from the agent channel.

**Creating and editing:**
- Right-click empty canvas: **New Musician** or **New Instrument**. The new node uses the template in `library/templates/`.
- Drag an Instrument onto a Musician to add it to that Musician's crew (it is written to `instruments:` in the Musician's file).
- Deleting a starter agent hides it. Deleting one of your own agents moves its file to Trash.
- Everything here is a file. The Orchestrator in Arrange mode can do any of these things on request.

**Data:**
- Agents: `Orchestra/library/musicians/*.md` and `instruments/*.md`, read and written through `library.ts`.
- Layout: `Orchestra/library/ensemble.json`.

---

## 8. Knowledge graph: Memory (new screen)

**What it's for:** seeing what Orchestra remembers across your work, and giving agents a cheap place to look things up. Its nodes include:
- fonts, palettes, grids and references you keep coming back to
- decisions you made, and why
- files the agents made

### 8.1 What Obsidian is, and what that means here
- **A vault is just a folder.** An Obsidian vault is a folder of plain markdown files that link to each other with `[[wikilinks]]`. Obsidian's graph view draws those links.
- **We can't embed Obsidian's graph.** Obsidian is a closed-source app of its own (also built on Electron), with no part we could put inside Orchestra. Everything else about it works for us, though.
- **Orchestra's folders are already the vault.** The projects folder is set up to be an Obsidian vault (see `orchestra-notes.md`), and Graphify writes its graph out as markdown notes in that vault.

**So the plan is:**

| Layer | What it is |
| --- | --- |
| **Source of truth** | The vault: markdown notes with `[[links]]`, written by the app, by the agents and by Graphify. The same files Obsidian opens. |
| **Graph data** | Graphify's `graph.json` (nodes, edges, communities), plus the wikilinks the app reads itself. Rebuilt with `graphify --update` after each phase. |
| **The view in Orchestra** | Our own graph, drawn on the canvas in Orchestra's style from that data. It uses a WebGL graph renderer (sigma.js with graphology, or d3-force on canvas for small graphs). No Obsidian needed. |
| **Open in Obsidian** | A button on any note, using Obsidian's URI scheme (`obsidian://open?vault=<name>&file=<path>`). It only shows when Obsidian is installed. Edits made there are picked up on the next update. |
| **Agents** | They query the graph through Graphify's MCP server (`--mcp`) instead of rereading files. |

Obsidian stays optional. The graph works without it, and anyone who uses Obsidian gets the same notes there.

### 8.2 Where it lives
- **Studio level, "Memory":** one combined graph across every project. Open it from a Studio chip, or with a fourth label on the minimap, `MEMORY`. This is where taste you keep returning to shows up.
- **Book level:** a "Memory" toggle on the book map (C8) filters the same graph to the current project, with the nodes it shares with other projects still shown.

### 8.3 Look
- **Background:** the dot-grid canvas.
- **Nodes are drawn by kind:**

| Kind | Mark |
| --- | --- |
| Project | A tiny book cover in the project's colour |
| Note or document (an interpretation, a brief, a spec) | A small paper rectangle |
| A **shared** node (in two or more projects: a font, a palette, a grid) | A filled blue square. It's the same mark as the site's knowledge-graph drawing. |
| Reference or asset | A dithered thumbnail dot |
| Agent | A ring with the agent's initial |

- **Edges:** thin blue lines. Edges inferred by Graphify, rather than written as explicit links, are dashed.
- **Size:** node size follows how many links a node has, so the most-connected nodes stand out ("god nodes", in Graphify's report).
- **Labels:** they appear on hover and from about 60% zoom. Bodoni for projects, mono for everything else.
- **Report card:** a pinned paper card, Graphify's `GRAPH_REPORT.md`, summarising the most-connected ideas and surprising connections.

### 8.4 What you can do

| Action | Result |
| --- | --- |
| Search (the bar in Conduct mode, or `⌘K`) | Flies the camera to matching nodes, and dims the rest |
| Filter chips: Projects, Type, Colour, References, Decisions, Agents | Shows or hides each kind |
| Click a node | Opens its note card next to it, the same paper style as the Ensemble: the rendered markdown, **Used in** (the projects it appears in), its links, and Open / **Open in Obsidian** |
| Double-click a project node | Opens that book (the C3 animation) |
| Drag a node | Pins it there. Tidy unpins everything and runs the layout again. |
| Ask the Orchestrator ("what typefaces do I keep picking?") | It answers from the graph, and the nodes it used light up |

### 8.5 Data and updates
- **Vault:** the `Orchestra/` folder (the projects, the library and the notes). Graphify output goes to `Orchestra/graph/` (`graph.json`, `graph.html`, `GRAPH_REPORT.md` and the markdown notes).
- **Updates:**
  - `graphify --update` runs in the background when a movement finishes: after Interpret, when a deliverable is approved, and after an audit.
  - It can also watch for changes while the Memory view is open.
  - The view reloads `graph.json` when it changes.
- **Speed:** a few thousand nodes are fine in WebGL. Beyond that, show communities as clusters until you zoom in.
- **Status:** this is step 7 in the build plan, after Files.

---

## 9. Refine area

Not covered in this walkthrough. For now, use C8's preview together with the app-screen variations:
- **6A:** before and after
- **6B:** scorecard
- **6C:** audit pins

Spec to follow.

---

## 10. Frames to add or update in Figma

| Frame | Change |
| --- | --- |
| C1 | Add the Orchestrator bar. Add a cover hover state, open about 35°, with Enter project / Edit project. Add a right-click menu. |
| C2 | Add the edit-mode version (all fields at once, Done / Enter project). Add Auto to the colour and art settings. |
| C4 / C5 | Add the right-click "Add section" menu. Show a second set of sections (for example "3D references"). Show selection mode for Choose sources. Show the opened interpretation reader. |
| C6 | Change the centre to "Deliverables", add every possible seat, and add the Prerequisites circle with lit and unlit foundations. |
| C6b (new) | Inside a deliverable: the seat, the Instrument tree, the asset cards, the interpretations it reads, an approval card. |
| C9 (new) | The Ensemble: the agent tree, with the Instructions and Setup cards open on one agent. |
| C10 (new) | Memory: the combined graph, with a note card open and the report card pinned. |
| All | Add the page label on the minimap. |

## 11. Open questions

- **Hover to open covers:** opening on hover is quick but can fire by accident. Should there be a small delay, about 250 ms, or open on click instead?
- **Stage size:** should every possible deliverable sit on the stage, or only chosen ones plus an "Add" fan? With 11 or more Musicians, the arc gets crowded.
- **Where the Ensemble lives:** is it only a Studio-level canvas, or also a fourth "page" in each book for agents specific to that project?
- **Interpretations across projects:** can one project's interpretation feed another project (a shared studio style)?
