# Changelog

What changed in Orchestra, newest first. Add to the top section with each push.

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
