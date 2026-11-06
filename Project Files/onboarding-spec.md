# Orchestra onboarding: the setup board

The first launch is a board, not a wizard. You set Orchestra up by doing the things you'll do every day: you right-click to add a card, fill it in, and drag a wire to the finish node. By the time you've finished setting up, you've learned the canvas.

- **Figma:** file `AqpBpdKicUBczcUwdiDEnk` → Mockups → "Onboarding · the setup board", frames O1 to O6.
- **Related docs:** `canvas-spec.md` (the canvas, chrome and Orchestrator bar), `brand-spec.md` (styles and components), and §3 of `future-ideas.md` (the original onboarding steps).
- **Status:** spec, Nov 6, 2026. Your own onboarding notes still need to be merged in. They're on your computer, which this session couldn't reach.

---

## 1. What it has to do

1. Find out who you are (your name).
2. Connect at least one AI provider: Claude, ChatGPT, local models, or more than one.
3. Find out which tools you design in, and set up their MCP servers.
4. Choose the workspace folder (projects, library and memory), which doubles as the Obsidian vault.
5. Check the prerequisites, and offer to install whatever is missing.
6. Optionally, connect GitHub (for updates, and for Terminal mode's branches).
7. **Teach the canvas:** right-click, cards, wires, dragging, collapsing, Tidy, the minimap and the Orchestrator bar.

## 2. The idea: a node graph you complete

- **The finish node.** It sits on the right of the board: **Open the studio**. It has six input ports:

| Port | Required | Fed by |
| --- | --- | --- |
| Name | yes | the You card |
| Provider | yes, at least one | any number of Provider cards |
| Workspace folder | yes | the Workspace card |
| Tools | no | MCP setup cards (or the Tools card if you skip setup) |
| Memory | no | the Memory card |
| GitHub | no | the GitHub card |

- **The button.** Open the studio stays disabled until all three required ports are connected, with a count underneath ("2 required ports left").
- **Port feedback:** a port fills in blue when a wire lands, and gets a ✓ once the card behind it is valid.
- **Optional ports** can be left empty. Everything can be added later from Settings, which reopens this same board (see §6).

## 3. The lessons

The board teaches one action at a time, through a coach chip: an ink pill with an orange step number. A chip in the header tracks progress ("LESSON 2 / 5"). **Skip the tour** hides the coach chips and the lesson chip, but the board stays, because the cards are the setup.

### Lesson 1: Right-click (O1, O2)
- **O1, Welcome.**
  - **What's on the board:** the orb, "Welcome to Orchestra.", one paragraph, and the finish node, empty.
  - **The prompt:** a cursor with a dashed ripple, and the coach chip *Right-click anywhere on the board.*
  - **The bar:** the Orchestrator bar is a dashed, dimmed placeholder: "The Orchestrator wakes up once a provider is connected."
- **O2, the menu.**
  - **The menu:** right-clicking opens **Add a card**, with Your name, Provider, Tools you use, Workspace folder, Memory · Obsidian, GitHub, and *Ask the Orchestrator…* (disabled until a provider is connected).
  - **Shortcuts:** each item has a number key, 1 to 6.
  - **Where cards land:** at the click point, so a dashed ghost shows where it will appear.

### Lesson 2: Fill it in and wire it (O3)
- **The You card:** the 1B input style, "What should we call you?" with an underlined field.
- **The coach:** *Drag from ● to the Name port on Open the studio.* The target port gets a dashed orange ring.
- **While dragging:** the wire is drawn live, solid blue. On release it becomes a resting wire, dashed.

### Lesson 3: More than one (O4)
- **Provider cards**, one per provider:
  - **Claude:** Claude Code CLI found, signed in, set as the Orchestrator's default.
  - **ChatGPT:** Codex CLI found; **Sign in in your browser**.
  - **Local models:** an Ollama endpoint, plus the models it found, shown as tags.
  - **+ Add a provider:** a dashed ghost card for Gemini, OpenRouter or any OpenAI-compatible endpoint.
- **Wiring:** every provider card wires into the single Provider port. One live provider is enough.
- **The coach:** *Right-click a card to duplicate it, or add another provider.*
- **The bar wakes up:** as soon as one provider works, the Orchestrator bar comes alive (Conduct mode, "Ask me anything about setup…"). From then on you can type what you want instead of filling in cards. For example, "I use Figma and Blender" creates those cards.

### Lesson 4: Cards make cards (O5)
- **Collapsing:** finished cards fold down to their headers, with ✓ and a name ("You · John", "Providers · 3"). That teaches collapsing.
- **The Tools you use card:** a grid of app tiles (Figma, Blender, Fusion, ElevenLabs, Illustrator, Photoshop, After Effects, Notion, Google Drive, Rhino, Spline, + Other).
  - Each tile says whether it has an MCP server.
  - Picked tiles turn blue, with their labels in the serif.
- **Setup cards:** picking an app with an MCP server spawns its **setup card**, wired from the Tools card. A setup card has numbered steps that tick off, and a **Test** button. Example:
  - Figma: open the desktop app → turn on the MCP server → test → connected.
  - Blender: install the add-on → start the server → test.
- **Wiring:** setup cards wire into the Tools port.
- **The coach:** *Pick your tools. Their setup cards appear on the board.* Underneath: "Optional: skip any of these and add them later from Settings."

### Lesson 5: Tidy and finish (O6)
- **Workspace folder:** "Where should everything live?", defaulting to `~/Documents/Orchestra`, with a note that it is also the Obsidian vault.
- **Memory · Obsidian:**
  - shows whether Obsidian is installed (or offers to install it)
  - Vault = the workspace folder
  - Graphify installed or not
- **GitHub (optional):**
  - Account, the user's own sign-in (Orchestra never asks for a password).
  - Fork: the user's own copy of `orchestra`.
  - Why: for updates, and so Terminal mode can work on your own branch.
- **Prerequisites:** a checklist (Node 22, Git, Claude Code, Python 3.10 or later, Graphify), each with Install or a ✓.
  - Installs run one at a time and show a log line.
  - Nothing installs without a click.
- **Tidy:** the Tidy chip appears once something has moved.
- **When everything is wired:** the finish node turns blue (with the poster dot grid), and the coach reads *Everything's connected. Open the studio.*

## 4. Card reference

| Card | Contents | Valid when | Writes |
| --- | --- | --- | --- |
| You | name field | not empty | `settings.json` → `user.name` |
| Provider | provider type, CLI detection, sign-in state, default role | the CLI is found and signed in, or an endpoint answers | `settings.json` → `providers[]` |
| Local models | endpoint, models found | the endpoint answers | `providers[]` (`kind: local`) |
| Tools you use | app tiles | always (zero tiles is fine) | `settings.json` → `tools[]` |
| MCP setup (one per app) | steps, Test | the test call succeeds | the MCP config that agents get (see `orchestra-mcp.ts`), plus `tools[].mcp` |
| Workspace folder | path, Choose… | the folder exists or can be created | `settings.json` → `home`; creates `projects/`, `library/` and `graph/` |
| Memory | Obsidian, vault, Graphify | always (optional) | `settings.json` → `memory` |
| GitHub | account, fork | signed in (optional) | `settings.json` → `github` |
| Prerequisites | the checklist | every required item is ✓ | nothing; it installs on request |

**Credentials:**
- **Sign-ins** happen in the provider's own browser flow or CLI (`claude login` and so on).
- **Keys:** when a key is unavoidable (an OpenAI-compatible endpoint), it goes to the OS keychain, never into `settings.json`.
- **The board** only shows whether something is connected or not.

## 5. Interactions taught, and where they come back

| Taught on the setup board | Used later in |
| --- | --- |
| Right-click → Add a card | Research sections, the Ensemble, the Studio |
| Fill a card using the 1B input style | New project, the Orchestrator bar |
| Drag a wire into a port | Choosing interpretation sources in Research; prerequisites lighting up in Create |
| Several cards into one port | Several sections into one interpretation |
| Cards spawning cards | Picking deliverables lights up their prerequisites |
| Collapse a card | Every board |
| Tidy, the minimap, the breadcrumb | Everywhere |
| The bar waking up, then typing instead of clicking | Every screen |

## 6. Finishing, and coming back

- **Open the studio** saves `settings.json`, creates the workspace, and plays a short version of the book animation in reverse:
  1. The board's cards fold into a cover called **Setup**, in ink, with the orb as its art.
  2. The cover drops onto the shelf, and the Studio (C1) appears with the blank New project cover pulsing once.
- **Settings is this board.** Settings → Setup, or opening the Setup book, reopens the same board with every card filled in. Add a provider, connect a new tool, change the folder. There are no lessons the second time.
- **Resuming:** if you quit halfway, the board reopens exactly as you left it, with its card positions saved in `setup.json`.

## 7. Edge cases

- **No provider works:** the finish node stays disabled. The coach shows where the problem is (for example, "Claude Code wasn't found. Install it, or add another provider"), with a link to install it.
- **A port of the wrong type:** you can't drop a wire on it. It shakes once and shows which port the card belongs to.
- **Deleting a wired card** removes its wire, and its port empties again.
- **Keyboard only:**
  - Tab moves between cards. Enter edits a card.
  - Pressing **C** on a card connects it to its matching finish port.
  - Numbers 1–6 add cards.
  - Lessons can be completed with the keyboard alone.
- **Screen readers:** each card is a labelled group, and each port reads as "Name, required, connected". Wires are also listed as text in the finish node.
- **Reduced motion:** no wire drawing animation and no fold-into-cover; it crossfades to the Studio instead.

## 8. Open questions

- Should the board start empty (right-click to add the first card), or with the You card already placed to remove friction? The mockup starts empty, because that is the lesson.
- Should the Orchestrator talk during setup (a voice line or typed greeting once a provider connects), as `future-ideas.md` suggests?
- Should installing prerequisites be one bundled installer or one card per item? The mockup uses one card per item.
- Merge in your onboarding notes from your computer (attach them, or link this chat to your computer).
