# Orchestra: the canvas concept

Every part of Orchestra lives on one infinite artboard. The home screen is a shelf of projects. Each project is a book you open. Inside the book, Research, Create and Refine are three areas of the same canvas, and you move between them by panning and zooming instead of switching pages.

Status: concept, Nov 6 2026. Mockups are in Figma (file AqpBpdKicUBczcUwdiDEnk), on the Mockups page, in the section "Canvas concept · the book".

Some of this comes from the app-screen variations:

| From | What carries over |
| --- | --- |
| 1B · Interview | The text input: one large Bodoni question, an underlined answer field, and chips for earlier answers. It is used for New project and the Orchestrator input. |
| 1C · Live programme | A cover for each project, built from its name, client, concept and art. |
| 2B · Moodboard | Reference tiles with dithered art, a source label and your note, placed on the canvas instead of in a page grid. |
| 4B · Seating chart | Deliverables arranged as an orchestra around the Orchestrator. The layout changes with what you pick. |

---

## 1. The canvas

- **Dot grid everywhere.** Every level uses the site's 24 px dot grid, so moving from home into a book and through its areas feels like one continuous space.
- **Navigation.** Drag to pan and pinch or scroll to zoom. Double-clicking an object zooms to fit it. Esc zooms out one level.
- **Levels.** There are four, each a zoom depth:
  1. **Studio:** the shelf of projects.
  2. **Book:** one project, showing its three areas.
  3. **Area:** Research, Create or Refine.
  4. **Object:** a deliverable, a reference group or a document.
- **The breadcrumb.** Floating at top left, for example `Studio / Forma Editorial / II Create / Brand Kit`. Clicking a step zooms back out to that level. This replaces the old tab strip and the phase bar.
- **Movement shortcuts.** Three I / II / III buttons sit next to the breadcrumb. Each one flies the camera to that area. The current area is blue with a Bodoni label, as on the site.
- **Minimap.** At bottom right, a small map of the book showing the three areas and a box for your view. Click or drag inside it to move.
- **Tidy.** Moving sections around is encouraged. A "Tidy" button snaps the area back to its default layout. Positions are saved for each project, in a new `canvas.json` in the project folder.

## 2. Studio (home)

- **Projects as covers.** Each project shows as its cover (see section 3), placed freely on the canvas. You can drag covers into groups (by client or by year, for example). Their positions are saved.
- **Cover status.** A small ribbon on each cover shows the current movement and whether any agent is playing. When something needs your approval, an orange "Needs you" tab sticks out of the top of the cover.
- **Opening a project.** Click a cover to open the book (section 4). Right-click gives Open in a new window, Rename and Delete, the same as the current project menu.
- **New project.** A blank cover with a dashed outline sits at the end of the shelf.

## 3. Covers

- **Generated from the project.** Each cover combines the project's name (Bodoni Display), the client, a short form of the concept, a piece of dithered art, and the three movements across the foot, in the style of a programme.
- **Variants.** Covers come in blue, white and ink. The art is picked from the project's usable assets, or from the bundled ASCII and dither set when there are none.
- **Spine.** Each cover has a spine on the left showing the project's initials. It is what you see when a book is closed at an angle in the stack.

## 4. Opening the book

- **The animation.** It runs in three beats, 700 ms in total:
  1. The camera centres the cover and it grows to fill most of the view (about 200 ms).
  2. The cover swings open on its spine (about 300 ms).
  3. The camera pushes through the first page into the book's canvas (about 200 ms).
- **No visible cut.** The dot grid stays continuous through all three beats.
- **Reduced motion.** With reduced motion on, this becomes a 150 ms crossfade.
- **Leaving.** Leaving runs the same animation in reverse, and the book closes back into its place on the shelf.

## 5. New project

- **Filling the cover.** Clicking the blank cover zooms into it. You fill it in with the 1B interview, one question at a time:
  1. What's it called?
  2. Who is it for?
  3. What is this project trying to say?
- **Live cover.** Each answer is written onto the cover as you type (from 1C). Earlier answers show as chips above the current question.
- **Finishing.** "Create project" closes the cover and drops it onto the shelf. "Open" goes straight to the book-opening animation.

## 6. Research area

- **Sections are movable groups.** Each one is a titled frame on the canvas that you can drag, resize and collapse:
  - **Reference links:** a stack of link blocks. Each block shows a large initial, the domain, your note and a ↗. Clicking a block opens the link. Paste a URL anywhere in the area to create a new block.
  - **Inspiration:** 2B-style tiles with dithered art, a source label and your note.
  - **Usable assets:** the same tiles, for files. Drop files onto the canvas to add them.
- **Retagging.** Drag a tile between Inspiration and Usable assets to change its tag. The note file is updated to match.
- **Look further.** A strip along the edge of the area lists the source sites (Are.na, Visuelle, Design Reviewed, CARI, Public Work, Artvee and your own). Each one opens in the browser.
- **Interpret.** There is a primary button in the area. When you run it:
  1. Lines draw out from every reference to a new node as it appears: **research.md**.
  2. The node is a document card with Direction, Themes and Usable assets.
  3. Small theme pills (from 2C) sit on the lines between the references and the document, so you can see which reference shaped which theme.
- **Running it again.** "Interpret again" rewrites the document in place. Its earlier versions stay in the node's history.

## 7. Create area: the stage

- **The layout.** Deliverables are laid out as in 4B:
  - the Orchestrator at the podium (the orb) at the bottom centre
  - Musicians (deliverables) on an outer arc
  - their Instruments on an inner arc
  - the shared Foundations as a row in front of the podium
- **Dynamic.** The arc adjusts to the number of deliverables you choose. Adding one slides a new seat in and moves the others along. Seats can be reordered by dragging.
- **Seat status.** Each seat shows its dithered art, its name, a status tag and its last line. Playing seats are blue and the rest are white. A seat that needs you has an orange tab.
- **Links.** Dashed lines run from the podium to each Musician and from each Musician to its Instruments. A line animates (marching dashes) while a brief or report is passing along it.
- **Choosing deliverables.** "Add a seat" opens the library as a fan of cards (from 3A), with the foundations each card needs listed underneath.
- **Opening a deliverable.** Clicking a seat zooms into it. The breadcrumb then reads `… / II Create / Brand Kit`, and the seat expands into its work: frames, files and links into Figma.

## 8. The Orchestrator input and the chat drawer

- **The input.** A bar is pinned to the bottom centre of the Create area, in the 1B style: a small orb, an underlined field and "Give your agents a direction…". The deliverable you are looking at decides which chat it goes to. On the stage, that is General.
- **The drawer.** Clicking the input, or pressing `/`, slides a drawer in from the right (about 420 px). From top to bottom it holds:
  - **The chat:** messages for the current deliverable, with inline work cards (from 5C), such as spec swatches and a frame picker with Approve.
  - **Agent status:** the foundations / Musician / Instrument tree with status tags (from 5A). Clicking a row highlights that seat on the stage.
  - **Created files:** the newest first. Clicking one opens it, or reveals it on the canvas.
- **Behind the drawer.** The stage stays visible, dimmed to about 60%. The seat you are chatting with stays at full strength. Clicking outside the drawer closes it.
- **Agent channel.** A toggle in the drawer swaps the chat for the read-only channel, shown as swimlanes (5B), with "Stop all agents".

## 9. Refine area

- **Audit marks.** Finished deliverables appear here as frames, with numbered audit pins and dashed callouts (concept D).
- **Scorecard.** A scorecard card (6B) sits next to them.
- **Sending fixes.** "Send fixes to Create" draws a line back to the deliverable's seat on the stage.

## 10. What needs building

| Need | Notes |
| --- | --- |
| Canvas engine | Pan and zoom with a level of detail for each zoom depth. HTML nodes for content and a canvas layer for the dot grid and links. |
| `canvas.json` for each project | Positions of covers, sections and seats. Missing positions fall back to the default layout. |
| Cover generator | Combines name, client, concept and art into a cover. It is rendered in the app and can be exported as a PNG. |
| Book transition | Uses the CSS 3D transform `rotateY` on the cover, then scales the camera. Has a reduced-motion fallback. |
| Interpretation link-up | `interpret()` returns the themes and which references they came from, so the lines can be drawn. |
| Stage layout | Arc positions worked out from the number of Musicians and Instruments. Animated on change. |
| Drawer | Reuses Conversation, AgentChannel, the Agents and work tree and Files from `Create.tsx`. |

## Open questions

- Should the three areas sit side by side in one book (pan between them), or be separate spreads (page turns)? The mockups use side by side.
- Do covers use the project's own brand once Brand Kit is done, or always the Orchestra style?
- On small windows, does the drawer become a full-screen sheet?
- The product site may later take on the book style: project covers, the opening animation and the dot-grid canvas. This is on hold for now, and the site stays as it is.
