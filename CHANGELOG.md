# Changelog

What changed in Orchestra, newest first. Add to the top section with each push.

## 2026-11-11

### Changed

- The header tab, the area switch, the side tabs and the session dock are each drawn as one shape, and their outline now follows the curve where they meet the edge. The dock has its rounded corners back.
- Moving between areas slides the next board in from its side, and the pill in the area switch grows and shrinks as it moves.
- Opening a book: the cover lifts, grows and dissolves into the board in about half a second, in place of the swinging page.
- Covers are dark with soft light blooming through them, in place of the flat blue poster.
- "New asset" and "New project" are a small pill above the minimap, clear of the side tabs.
- The knowledge graph uses the soft Nocturne lights, with glass labels.
- Hover no longer swaps a label to the serif. Dialogs, menus and panels have rounded corners. The Orchestrator's conversation opens as one rounded panel with the bar.

### Added

- Ctrl+Tab and Ctrl+Shift+Tab walk the open tabs, Ctrl+1 to 9 jump to one, and a middle-click closes a tab.

## 2026-11-10

### Changed

- Nocturne look, matched to the Figma screens: labels are sentence case in Geist, small labels stay mono caps, and Instrument Serif Italic is kept for a few titles. Buttons are chalk or glass pills, windows and cards have rounded corners, files are chalk paper, agents and desk tools get soft gradient orbs, and every control eases the same way on hover and press.
- Create: prerequisite rows that are ready are green with a green outline, deliverables that are on are a soft blue card, and Lock in is a card like them. Research: the Interpret box is a muted indigo panel.
- The active header tab is drawn as one shape, so its corners line up.
- Nocturne, phase 1: the app is dark by default, with chalk type on near-black panels, set in Geist, Geist Mono and Instrument Serif Italic. The light look is still there: set `localStorage.theme = 'v2'` and reload.
- Nocturne, phase 2: the Studio, Setup and the cover editor sit on a soft blurred landscape. Inside a book the board is flat grey with dots. The header, Back, Needs you, the area switch, the Orchestrator bar and the minimap are frosted glass.
- Nocturne, phase 3: the breadcrumb is gone. The header has Home, a tab for each open project (its icon shows which area it is on) and + for a new project. Closing the tab you are on goes to the one on its left, or Home. Back shows only away from the Studio.
- Nocturne, phases 4 and 5: the area switch is a notch under the header with an icon for the whole book and each area; the one you are on is a chalk pill with its name. The full-height page strips are replaced by small edge tabs at the sides, so boards use the full width.
- Nocturne, phase 6: a session dock on the right edge shows the Orchestrator and a status dot for each deliverable agent (blue working, green done, amber waiting on you, red error, grey idle). Hover a dot for its name; click the dock for the full list. Needs you moved here: the Orchestrator's dot turns amber and a "Needs you" pill beside it opens the list.

## 2026-11-09

### Added

- Settings has a Providers section: see what each provider is really connected through, disconnect it, and reconnect with an account or API key, without going back through onboarding.

### Changed

- The Canvas build is now on `main`.
- Providers moved from the MCPs window to Settings. A provider counts as connected only when you're signed in or have a key, not just because its tool is installed.

## 2026-11-08

### Added

- Create stage: deliverables in columns of five, prerequisites in a column feeding Lock in, research anchored beside it, the Orchestrator straight below, all in a "Select your deliverables" group.
- Lock in only ever adds: locked-in deliverables stay, and new ones arrive with "Add N".
- Prerequisite tags on the wire into each deliverable turn green as their files appear; the Orchestrator can only brief that deliverable on the next missing prerequisite until they are all green.
- Every agent shares one header, with a rank tab on the left. Double-click a prerequisite to open its markdown.
- Right-click a deliverable to edit it, including its connections; deliverable cards flag a missing connection.
- New windows open at the cursor, and a pulled wire snaps to the nearest socket.
- Onboarding rework: welcome modal, floating Open the studio panel, real connection steps for providers, MCP tools, GitHub and Graphify, a workspace folder picker, and dashed-to-solid wires you can drag.
- Research groups as blue frames of windows, single windows, text windows, and more than one Interpret box, wired by dragging from a group's dot.
- The reference library shows a picture of each site, adds new sites from links, and filters by tag.
- Studio groups for projects, shift-click selection, double-click to enter, and custom book covers with uploads.
- Drag a box to select windows and move them together.
- Create: a Layers panel with hide, show and Only; a bounding box per deliverable; a Prerequisites group; markdown files on the board; preview windows that link to the finished work; and a window for each open question.
- Windows show what they are (Orchestrator, Musician, Instrument, Markdown, Deliverable, Decision).
- A waveform and Working tag on windows agents are busy in.
- Knowledge graph on the Studio board: 3D or 2D, named clusters, Freeze, zoom buttons, expand, last-built date, and hovering a book lights up its part.
- Action box options can show typefaces and pictures.
- Agents can use Figma when it's connected, and record previews of what they make.
- Ctrl+Space opens the Orchestrator. The usage meter also counts Claude Code use.
- A New asset card on Research and Create.

- The Orchestrator bar shows a blue working label with a loading animation and the current step.
- A usage meter under the bar shows your 5-hour and weekly Claude limits.
- Full-height buttons on the left and right of the window move between Research, Create and Refine.
- Zoom shortcuts: `+` and `-`, Ctrl or Shift+0 for 100%, Shift+1 to fit everything, Shift+2 to fit the selected window.

### Changed

- The Orchestrator is a centred window the same width open or closed, with conversations inside it.
- The page indicator sits under the header, with small page icons. The breadcrumb has node connectors.
- Windows open beside what they connect to, with more room, and bounding boxes never overlap.
- Needs You is per project, with orange tags on the Studio's books.
- Create stays greyed out until a project has research.
- Clicking a deliverable turns it on or off, and asks first if work has started.

### Fixed

- Typing an answer in the Action box now closes the question, and older questions no longer show empty boxes.
- The mouse wheel scrolls inside windows that scroll.

- The artboard now follows Figma's controls: the wheel pans, Shift+wheel pans sideways, Ctrl+wheel or a pinch zooms, and the middle button or Space+drag pans.
- The Conversations panel lines up with the top of the open chat.
- The Back, Needs You, page switcher and minimap controls moved in to clear the new side buttons.

## 2026-11-07

### Added

- First-launch onboarding on an artboard: right-click to add a window for each field, then Connect wires it to "Open the studio".
- Click a window to select it, then right-click the board for actions on that window.
- Right-click menus on the board and on window headers, ending with Ask the Orchestrator.
- Instruments appear as their own windows under each deliverable in Create.
- Slide Deck deliverable in the Orchestra brand project.

## 2026-11-06

### Added

- The canvas app: Studio shelf, project covers, cover editor, and a book holding the three areas.
- Brand v2: Bodoni Moda, Archivo and Plex Mono, with new tokens from Figma.
- An Orchestrator bar on every screen, with back and forward navigation.
- Needs You, curved wires between windows, and windows the Orchestrator can open itself.
- An Action box that holds every question and approval.
- Slash commands in the bar, and agent files that open on the artboard.
- A reference library, a knowledge graph for agents, and a knowledge graph on the Studio desk.

### Changed

- Each area is one artboard, and clicking something opens a window on it instead of a sub-page.
- Windows on the artboard no longer scroll or overlap.
- One Orchestrator to talk to, with the conversation first and a resizable chat.
- Deliverables on the stage are chosen, then confirmed.

## 2026-11-02

### Added

- Create: decision cards and approvals for new agents.
- Agents screen: hierarchy tree, model picker, crew editing, file editor, providers, editable names and new Instruments.
- Product website.
- `/brand-sync` command.

### Changed

- New app icon.
- Tagline is now "Every part, in concert."

### Removed

- The Account page.

## 2026-11-01

### Added

- First version of the app: foundation, Research tab and agent library.
- Create: deliverable picker with live build order, one chat per deliverable plus General, agent channel, Stop, and model tiers.
- Musicians and Instruments really run, with the chain of command enforced.
- Context hand-over when an Orchestrator chat gets long.
- Multiple windows, tabs, split view and tab tear-off.
- Project right-click menu: rename, new window and delete.
