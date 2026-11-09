# Orchestra: read this before you change anything

Orchestra is an Electron design app. A user works through three areas (I Research, II Create, III Refine) with a team of AI agents. This file is for agents and people adding to the code. It covers how the app is built, which pieces depend on each other, and how to land a change without colliding with other contributors.

Last checked against commit `d2d501f` on branch `canvas` (2026-11-08). If you change something described here, update this file in the same pull request.

## The ten rules

1. Branch from `canvas`, and open your pull request against `canvas` (see [Branches and merging](#branches-and-merging)).
2. Keep one concern per branch. Never reformat, rename or reorganise a file as part of a feature.
3. Put new logic in a new file. Touch the shared files below with as few lines as possible.
4. Everything that touches the disk, a process or the network runs in the main process. The renderer only calls `window.api`.
5. Validate every id or path that arrives from the renderer or from a model, in the main process, before using it.
6. Data is plain markdown and JSON in the vault. There is no database, and none should be added.
7. Only the Orchestrator talks to the user, only the Orchestrator starts Musicians, and only Musicians start Instruments.
8. On an artboard, windows never scroll and nothing overlaps. Read [UI rules](#ui-rules) before building any screen.
9. Colours and type come from tokens. There is no raw hex in any `.tsx` file today, so keep it that way.
10. Never `git add -A`. Running the app writes user data into tracked folders (see [What never gets committed](#what-never-gets-committed)).

## Words the code uses

| Word | Meaning |
| --- | --- |
| Vault | The data folder (`ORCHESTRA_HOME`), also an Obsidian vault. Defaults to `../Orchestra` from `app/`. |
| Studio | The top level: every project as a cover, plus the desk (Agents, MCPs, Knowledge graph, Settings). |
| Book | One open project. Its three **areas** (also called movements) are Research, Create and Refine. |
| Board / artboard | A pannable, zoomable dot-grid surface. One per area. |
| Card / window | A box on a board. The two words mean the same thing. |
| Stage | The seats and circles under the cards on the Create board. |
| Orchestrator | The one agent the user talks to. One session per chat. |
| Musician | Owns one deliverable. A file in `library/musicians/`. |
| Instrument | Does one job for a Musician. A file in `library/instruments/`. |
| Foundation / prerequisite | An Instrument whose output is shared across deliverables and built once per project, in `prereqs/`. |
| Chat | `general`, a Musician id (that deliverable's chat), or `t-<id>` (an extra conversation from the bar). |
| Action box | The card where the Orchestrator's questions, choices and approvals wait for the user. |
| Needs you | The anchored list of everything waiting on the user, across projects. |

## How the app is put together

```
_Orchestra/
  app/                     the Electron app (run every npm command from here)
    src/main/              Node: files, processes, agents, IPC handlers
    src/preload/index.ts   the bridge: the renderer's entire API, and its types
    src/renderer/src/      React + Tailwind
      App.tsx              top-level view state: Studio, Book or cover editor; back and forward
      canvas/              the artboard engine, chrome, Studio, Setup, Orchestrator bar
      components/          the larger area screens: Research, Create, Agents
      assets/              tokens.css (generated), main.css, icons, ASCII art
    scripts/tokens.mjs     generates tokens.css from tokens.json
  Orchestra/               the vault: agent library and projects
  ideation/                specs: brand-spec, canvas-concept, canvas-spec, elastic-architecture
  Project Files/           the owner's plans and notes
```

The main process splits into small modules:

| File | What it owns |
| --- | --- |
| `index.ts` | Window creation, every IPC handler, the `orchestra://` protocol. Wires everything together. |
| `conductor.ts` | The agent tree, chats, logs, statuses, Stop, proposals, limits. |
| `session.ts` | One headless `claude` process, spoken to in stream-json. |
| `orchestra-mcp.ts` | The localhost tool server that gives agents their Orchestra tools. |
| `prompts.ts` | Builds each agent's system prompt. |
| `library.ts` | Reads and edits the agent markdown files. |
| `plan.ts` | `foundationOrder`. Pure, and shared with the renderer. |
| `providers.ts` | The provider and model table. Pure, and shared with the renderer. |
| `connections.ts` | Detects installed CLIs and API keys. |
| `projects.ts`, `deliverables.ts`, `research.ts`, `interpret.ts`, `outputs.ts` | One project concern each, as files in the project folder. |
| `asks.ts`, `proposals.ts` | Choices waiting on the user, and proposed new agents. |
| `graph.ts` | Per-project knowledge graphs, built by the `graphify` CLI. |
| `setup.ts`, `paths.ts` | First-launch state, and where the vault is (the folder chosen in setup is kept in `~/.orchestra/home`). |
| `research.ts` | References, their groups (`references/groups.json`, a `group:` line in each note) and the reference library. |
| `recipes.ts`, `onboard.ts` | How each setup item really connects, and running those steps. Main runs a step only by its id in `recipes.ts`. Pure data in `recipes.ts` is shared with the renderer. |
| `covers.ts` | A book's cover colour and artwork (`<project>/cover.json`). |
| `previews.ts` | Where finished work lives (`.orchestra/previews.json`), its thumbnails, and starting local dev servers. `cleanPreview` is a trust boundary: agents supply the input. |
| `keys.ts` | API keys from setup: tested with the provider, encrypted with `safeStorage`, kept in Electron's `userData`, never in the vault. |

## How the pieces talk

### Renderer to main

There is one path, and it has three steps:

```
component → window.api.x()        src/preload/index.ts
          → ipcRenderer.invoke('area:verb', ...)
          → ipcMain.handle('area:verb', ...)   src/main/index.ts
          → a function in a main-process module
```

Main pushes to the renderer on three channels. `chat:event` carries every agent event to every window, and each listener filters by `project` and `chat`. `drop:state` and `tabs:adopt` are left over from the removed tab strip and have no callers in the renderer.

### One message, end to end

```
OrchestratorBar → sendChat → 'chat:send' → Conductor.send
  → ClaudeSession spawns `claude -p --input-format stream-json` (cwd = project folder)
  → stdout lines → onLive / onAssistant / onTurnEnd
  → Conductor.say / log append to chat.jsonl / log.jsonl and emit
  → 'chat:event' → every window → Create, ChatPanel, OrchestratorBar re-read what they need
```

Event kinds are `live`, `message`, `busy`, `log`, `agents`, `asks`, `error` and `usage`, defined as `EventBody` in `conductor.ts`.

### The agent tree

Every agent is its own `claude` process with its own saved session id, so it resumes after a restart. Agents get their Orchestra tools from `orchestra-mcp.ts`, over HTTP on a random localhost port, guarded by a per-run bearer token. Each session connects to `/mcp/<project>/<chat>/<agent>`, so the server knows the caller, and the role decides which tools exist. This is what enforces the chain of command.

| Role | Orchestra tools | How it answers |
| --- | --- | --- |
| Orchestrator | `ask_graph`, `brief_musician`, `propose_musician`, `open_window` | Its reply goes to the user. |
| Musician | `ask_graph`, `run_instrument`, `report`, `propose_instrument` | `report` goes to the Orchestrator. |
| Instrument | None (no MCP config at all) | Its closing message goes to its Musician automatically. |

- An agent's key is `<musician>` or `<musician>--<instrument>`.
- All agents get `Read, Glob, Grep, WebFetch, WebSearch`, and file edits inside the project through `acceptEdits`. `Task`, `Agent` and `Bash` are disallowed.
- Limits live in `conductor.ts`: 4 agents working at once per project, 40 messages between agents per project per hour.
- At 140,000 context tokens the Orchestrator writes a handoff note to `notes/`, and the next message starts a fresh session that reads it.
- `open_window` kept its name from an earlier design. It now puts a choice in the Action box.

### Agents steering the UI through their text

The Orchestrator ends replies with plain-text markers, which the renderer strips and turns into UI. The prompt that teaches a marker and the parser that reads it must change together.

| Marker | Taught in | Parsed in |
| --- | --- | --- |
| `Go to: <project>/<area>` | `prompts.ts` | `goto.ts` |
| `Suggest deliverables: a, b` | `prompts.ts` | `suggest.ts` |
| `Decide: ...` plus bullet options | `prompts.ts` | `decide.ts` |

Bracket prefixes such as `[Brief from the Orchestrator]` and `[Report from the … Musician]` work the same way. They are written in `conductor.ts`, and `prompts.ts` tells agents to expect them.

### The canvas

- `Canvas.tsx` is the surface (pan, zoom, dot grid). `camera.ts` holds the maths, and `useCamera.ts` holds the state and flights.
- `Board.tsx` puts `CardSpec` objects on a `Canvas`, handles drag, resize, collapse and selection, and saves positions to `<project>/boards/<board>.json`.
- `place.ts` (`settle`, `freeSpot`) moves cards so nothing overlaps.
- `Chrome.tsx` draws the viewport-anchored frame: breadcrumb, pages, minimap and zoom.
- `Book.tsx` plays the camera between the three areas and calls `render(area, frame)`. `App.tsx` chooses what each area renders.
- `App.tsx` also owns Back, `NeedsYou` and `OrchestratorBar`, because they belong to the whole window.

Screens that don't share React state coordinate through window events: `orchestra:desk`, `orchestra:needs`, `orchestra:focus` and `orchestra:agents-changed`.

## Where data lives

```
Orchestra/
  library/
    orchestrator.md, house-rules.md        house-rules is added to every agent's prompt
    musicians/<id>.md, instruments/<id>.md front matter = settings, body = prompt
    templates/                             what new agents are drafted from
  studio.json, setup.json, sites.json      Studio layout, first-launch state, user's sites
  studio/                                  the _studio chat's home, and boards/setup.json
  projects/<id>/
    concept.md                             name and client in front matter, "## Concept" section
    research.md, deliverables.md           interpretation; chosen ids in front matter
    references/ (+ files/), prereqs/, exports/, audits/, notes/
    boards/<board>.json                    card positions
    graphify-out/                          the project's knowledge graph
    .orchestra/
      chats/<chat>/chat.jsonl, log.jsonl, session.json
      agents/<key>/session.json, agents.json, asks.json, proposals.json
```

- A new deliverable type needs no code. It is a new Musician file, and build order is computed from `prerequisites` and `needs`.
- The folder name is a project's permanent id. Renaming changes only `concept.md`.
- `_studio` is a reserved pseudo-project for the chat above every project. Handlers that use `chatHome()` accept it. Handlers that use `projectDir()` reject it, and that's why `ChatPanel` skips proposals, outputs and agent states in the Studio.
- `asks.json`, `proposals.json` and `agents.json` are read, changed and rewritten whole with no lock. Keep each one to a single writer path through the Conductor.
- Per-viewer UI memory is in `localStorage` (`areas`, `needs-seen`, `confirmed:<project>`). Guard every access, as the existing code does.

## Changes that must travel together

Git will not flag a mismatch between these. Most of the bugs a clean merge can introduce live in this table.

| If you change | Also change |
| --- | --- |
| An IPC channel | Handler in `main/index.ts`, method and types in `preload/index.ts`, every caller |
| Board or Studio layout fields | `BoardLayout` / `StudioLayout` in preload, and the sanitiser in `board:save` / `studio:save`, which drops unknown fields |
| A chat event kind | `EventBody` in `conductor.ts`, listeners in `Create.tsx` and `OrchestratorBar.tsx` |
| An MCP tool | `registerTool` under the right role, the `Hub` interface, the `Conductor` method, the instructions in `prompts.ts`, `agents.test.mjs` |
| A reply marker or bracket prefix | Both sides in the section above, plus its test |
| `GENERAL` or `STUDIO` | `main/conductor.ts` and `canvas/shared.ts`, which each define them because the renderer can't import the conductor |
| The `t-` thread prefix | `newThread` in `OrchestratorBar.tsx`, `chats:threads` in `index.ts`, `orchestratorPrompt` in `prompts.ts` |
| Create card ids (`orchestrator`, `chat-<id>`, `inst--…`) | `Create.tsx`, and `cardOf` in `NeedsYou.tsx` |
| The areas | `AREAS` in `canvas/shared.ts`, `goto.ts`, `command()` and `area()` in `App.tsx`, the "Go to" text in `prompts.ts` |
| An agent front-matter field | `library.ts`, both files in `library/templates/`, `toMarkdown` and `draftProblems` in `proposals.ts`, the input schema in `orchestra-mcp.ts`, `newInstrument` |
| Model names | `providers.ts`, the `z.enum` in `orchestra-mcp.ts`, `MODELS` in `proposals.ts` |
| A setup field | `Setup` and `cleanSetup` in `setup.ts`, `SLOTS` in `canvas/Setup.tsx` |

The renderer may import from `src/main/` only the three modules with no Node dependency, `plan.ts`, `providers.ts` and `recipes.ts`. Everything else from main reaches it as types through preload.

## How to add common things

**An IPC call.** Write the logic in a module under `src/main/`. In `index.ts`, add a short handler that validates ids with `projectDir()` and delegates. Add the method to `api` in preload.

**A card on an existing board.** Add a `CardSpec` to that screen's `cards` array, and write its body as a component in a new file. Cards grow with their content. The exceptions are chats (`height`) and markdown files, capped at twice the Orchestrator's height (`DOC_BODY`).

**A new board.** Render `<Board project board label crumbs pages preview cards />` with a new `board` name. Board names must match the slug rule. To add a right-click menu, pass `addMenu`, and use `popMenu` for card menus.

**A Studio desk window.** Add it to `DESK`, `WINDOW` and the `Desk` type in `Studio.tsx`, then add a slash command.

**A slash command.** Add it to the `commands` list in `App.tsx` and handle its id in `command()`.

**A Musician or Instrument.** Copy a file from `Orchestra/library/templates/`. No code is needed.

**A second AI provider.** It can't be added yet. `Conductor` constructs `ClaudeSession` directly, and `RUNNABLE` allows Anthropic only. The runner interface has to exist first (`Project Files/extensibility-plan.md`, Phase 2), so raise it with the maintainer before starting.

## Branches and merging

**Base branch.** All current work is on `canvas`. GitHub's default branch, `main`, is 12 commits behind it and still has the old sidebar UI. Run `git log origin/main..origin/canvas` before you start. If it prints nothing, `canvas` has been merged and you should use `main`.

**Landing a change.**

1. Branch from the latest base. If several agents work at once, give each its own `git worktree` and run `npm install` in each one's `app/`.
2. Before opening the pull request, and again before merging, run `git merge origin/canvas`. Don't rebase or force-push a branch you've already published.
3. Changes land as merge commits. Don't squash.

**Where collisions happen.** These files changed most often across the last 60 commits touching `app/`:

| File | Commits | How to stay out of trouble |
| --- | --- | --- |
| `renderer/src/App.tsx` | 26 | Add one line for a command or a mount. Keep logic in your component. |
| `main/index.ts` | 23 | Add a short handler inside the group for its feature, never at the end of the file. |
| `preload/index.ts` | 20 | Same: place the method beside its feature's group. |
| `components/Create.tsx` | 17 | 1,800+ lines. Put new components in new files and import them. |
| `main/conductor.ts` | 11 | Keep new logic in a module the Conductor calls. |

Other habits that prevent conflicts:

- Two branches that both add to the end of a list always conflict, so insert beside related code.
- Splitting a large file gets its own pull request with no behaviour change. Splitting `index.ts`, `conductor.ts` and `Create.tsx` is planned, so check with the maintainer before starting, and expect to coordinate with open branches.
- Don't add a dependency for something a few lines can do. If you do add one, change `package-lock.json` only through `npm install`.

**Resolving a conflict.**

- In `index.ts` and `preload/index.ts`, both sides usually added something, so keep both.
- For `package-lock.json`, take the base branch's version and run `npm install` again.
- `tokens.css` is generated. Run `npm run tokens` instead of merging it by hand.
- Conflicts inside `.orchestra/` are chat history, so take the base branch's version.
- After any merge, run the checks below and read [Changes that must travel together](#changes-that-must-travel-together) for anything the other side changed.

## What never gets committed

Stage files by name. `.gitignore` covers most of these, but not library edits:

- `Orchestra/setup.json`, `setup.json.bak`, `studio.json`, `sites.json` and `Orchestra/studio/`
- Anything new under `Orchestra/projects/orchestra-brand/` from running the app (`boards/`, `references/`, `.orchestra/`, `.graphifyignore`)
- Library edits made by clicking around in the app, such as `library/instruments/new-instrument*.md`
- `app/tsconfig.*.tsbuildinfo`
- `Site/` and `website/`: the product site has its own private repo, `orchestra-site`

Commit changes to `Orchestra/library/` only when the agent content is what you meant to change.

## Running and checking

You need Node 24, and the `claude` CLI on `PATH` for agents to run. The `graphify` CLI is needed for knowledge graphs, and `ORCHESTRA_GRAPHIFY` overrides its path.

```
cd app
npm install
npm run dev         # must start from app/, or the vault path is wrong
npm test            # 66 tests, all passing at the commit above
npm run typecheck   # clean at the commit above
npm run lint
```

- `npm run lint` already fails with 10 errors, all missing return types in `.mjs` tests and scripts. Don't add more. On Windows it also prints about 1,200 "Delete ␍" warnings, which only reflect local line endings. Git stores LF.
- Don't run `npm run format` across the repo. Run `npx prettier --write <your files>`.
- Changes in `main` or `preload` need a full restart of `npm run dev`. On Windows, stopping the dev server can leave Electron running, so kill the process tree.

**Keep test runs out of the real vault.** By default the app reads and writes `../Orchestra`. Point it at a copy instead:

```powershell
$env:ORCHESTRA_HOME = "$env:TEMP\orchestra-test"
Copy-Item -Recurse ..\Orchestra\library "$env:ORCHESTRA_HOME\library"
npm run dev
```

The first launch shows the Setup board until `setup.json` has `done: true`. Sending messages starts real `claude` sessions on the user's account, which costs money.

**Writing tests.** Tests are `*.test.mjs` files beside the code, run with `node --test`, importing the `.ts` file directly through Node's type stripping. A module under test must therefore:

- import nothing from Electron and contain no JSX
- import sibling modules with the `.ts` extension (`from './plan.ts'`)
- use only erasable TypeScript, so no `enum` and no constructor parameter properties

Put logic that needs testing in a pure file, as `place.ts`, `camera.ts` and `stage.ts` do. New logic gets a test. There are no automated component tests, so UI changes must be checked in the running app.

## Security boundaries

- Ids from the renderer go through `projectDir()`, `boardFile()`, `agentFile()`, `chatDir()`, `outputPath()` or `referenceFilePath()`. Don't build a path from renderer input any other way.
- Agent drafts come from a model, so `draftProblems` in `proposals.ts` is a trust boundary. Likewise `askProblems` in `asks.ts`. Nothing reaches the library until the user approves it, and `adopt` never overwrites.
- `board:save`, `studio:save` and `cleanSetup` keep only well-formed fields.
- The `orchestra://` protocol serves uploaded references and nothing else.
- External links open in the user's browser, never in the app.
- Giving agents `Bash` or widening their tools is a product decision for the maintainer.

## UI rules

The full reference is `ideation/brand-spec.md`, and the layouts are in `ideation/canvas-spec.md`. These rules apply to every screen:

- **Two kinds of UI.** Artboard-bound: cards, covers, the desk, everything inside a project. Viewport-anchored and the same everywhere: breadcrumb, Back, pages (bottom left), Orchestrator bar (bottom centre), minimap (bottom right).
- **Artboard windows never scroll.** A card grows to fit, and resizing changes only its width. Viewport chrome may scroll.
- **Nothing on an artboard overlaps.** Use `settle` and `freeSpot`, which keep 72px clear around every window.
- **A window opens with what it's connected to.** Give a card `link` and `auto`: `tree.ts` puts it under its parent, or beside it with `'left'` or `'right'`, in a column of its own. Moving a window by hand takes it out, and Tidy puts it back.
- **Inside a project, nothing navigates to a sub-board.** Clicking something opens a window beside it.
- **The user talks only to the Orchestrator.** Deliverable windows have no text input and are wired to the Orchestrator's window. Choices go in the Action box.
- **Waiting items** get an orange mark on their window and appear in Needs you. Orange means this and nothing else.
- **Wires curve** and go bold on hover.
- **A window shows what it is.** Give a card a `kind` (`canvas/kinds.tsx`). Agents are blue with round marks, files are paper with a page mark, finished work is ink, decisions have a diamond.
- **Labels explain themselves.** Use plain words with a one-line description. No in-joke names.
- **Hover never moves layout.** Add `serif-on` to labels, and `serifHold.ts` holds their width.
- **Selected, hovered or current** means Bodoni Moda italic 800, through `serif-on` or the `type-current-*` utilities.
- **Motion** uses one curve, `var(--ease)`. Screen entrances use `stagger`. With reduced motion, keep fades only.
- **Corners are sharp** (radius 0), except pills, avatars and the orb.

Tokens come from `Orchestra/projects/orchestra-brand/prereqs/tokens.json`, and `npm run tokens` generates `tokens.css`. Never edit `tokens.css`. Hand-written utilities go in `main.css`. Icons are SVGs in `assets/icons/`, drawn through `Icon`.

## Code style

- Prettier: no semicolons, single quotes, 100 columns, no trailing commas.
- Functions have explicit return types, enforced by ESLint on TypeScript.
- Comments say why, in plain English. Most files open with a comment explaining their job.
- Error messages are written for the person or agent who has to act on them. Follow the existing tone.
- A known limit gets a comment in this form: `// shortcut: <the limit>; upgrade when <condition>`. Search for `shortcut:` to see them all.

## What is planned but not built

`ideation/elastic-architecture.md` describes where the app is heading, not what exists. There is no `parts/` folder, part loader, manifest, slot system, safe mode or undo. Its Conduct, Arrange and Terminal modes are called Work, Customize and Code in the UI, and only Work is enabled.

Also not built or only partly built:

- **Refine** is a placeholder card in `App.tsx`.
- **MCP connections for agents** (Figma and others) don't exist, and `prompts.ts` tells agents so. Figma is the exception: Musicians and Instruments may use it if the user connected it (`FIGMA` in `conductor.ts`).
- **Only Anthropic can run agents.** The other providers are listed but refused by `runnableOrThrow`.
- **A packaged build can't find its vault** or ship a starter library. `paths.ts` depends on the working directory.
- **The `tools` front-matter field** is parsed but not applied. Tool access is set in `conductor.ts`.
- **The Studio's Orchestrator** is told not to use project tools, but is still given them.
- **Tab-drag IPC** (`drag:*`, `tabs:adopt`) has no remaining callers.

`Project Files/extensibility-plan.md` predates the canvas, so its file list and line counts are out of date. Its phases and open decisions still apply.

## Before you open a pull request

- [ ] Branched from the current base, merged it back in just now, no force-push
- [ ] One concern, with no drive-by formatting or renames
- [ ] `npm test` and `npm run typecheck` pass, and lint has no new errors
- [ ] New logic has a test, and UI changes were checked in the running app against a temporary vault
- [ ] Checked [Changes that must travel together](#changes-that-must-travel-together)
- [ ] Staged by name, with no user data from [What never gets committed](#what-never-gets-committed)
- [ ] Updated this file if a contract, a file's role or a rule changed
