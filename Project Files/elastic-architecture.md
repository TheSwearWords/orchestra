# Orchestra: an elastic architecture

Notes for whoever builds Orchestra (people or agents). Read this before adding a feature.

Status: direction, Nov 6 2026. It extends "Fully open source and customizable" in `future-ideas.md` (Advanced mode, Orchestra as a project inside Orchestra).

---

## 1. The goal

Orchestra is open source, and every user should be able to bend it to fit how they work. That means adding or changing:

- **features:** a new phase, a new kind of research board, a new view
- **agents:** Musicians, Instruments and their prompts
- **products:** new deliverable types
- **interpretations:** new ways of reading references, and the files they write
- **connections:** new MCP servers, AI providers and tools
- **the UI itself:** colours, fonts, layout and components

They should be able to do this without breaking the rest of the app, and ideally by asking the Orchestrator instead of editing code themselves.

**What it looks like.** In Research, a user has run Interpret and got `research.md` for type direction. Now they want a second, separate set of references, inspiration and usable assets for the 3D models, with its own interpretation. If Orchestra can't do that yet, they ask the Orchestrator. It adds the feature, they preview it, and they turn it on. Nothing else changes.

## 2. Principles

1. **Files before code.** Anything a user might want to change lives as markdown or JSON in the library or the project, not as constants in TypeScript. The agent library already works this way: Musicians and Instruments are markdown files, and adding a deliverable needs no code. Extend that pattern to everything else.
2. **A small core and many parts.** The core is the stable piece: windows, the project store, sessions, the part loader, safety and recovery. Every feature is a **part**: a folder with a manifest that plugs into the core. The core never needs to know any part by name.
3. **Contracts, not reach-ins.** Parts talk to the core and to each other only through declared interfaces: named IPC channels, events, UI slots and file schemas. A part never imports another part's internals or writes another part's files.
4. **Additive by default.** A new feature is a new part, or a new file in the library. Changing an existing part is the exception. Changing the core is rare and always gets a warning.
5. **Every change can be undone.** Every change is a git commit. A part that fails is switched off automatically, and the app keeps running. The recovery controls live in the core, where an edit can't break them.
6. **Escalate only as far as needed.** A user's request should be met at the lowest level that works: content first, then configuration, and code only when neither can do it (see section 5).

## 3. Layers

```
┌──────────────────────────────────────────────────────────────┐
│ Theme        tokens, fonts, layout of slots       (no code)  │
├──────────────────────────────────────────────────────────────┤
│ Library      agents, house rules, prompts, interpreters,     │
│              board schemas, sources               (markdown) │
├──────────────────────────────────────────────────────────────┤
│ Parts        phases, boards, views, connections,             │
│              deliverable runners          (code + manifest)  │
├──────────────────────────────────────────────────────────────┤
│ Core         window, project store, part loader + registry,  │
│              event bus, sessions/providers, permissions,     │
│              safe mode, undo                      (protected)│
└──────────────────────────────────────────────────────────────┘
```

### Core (protected)

The core:
- **Loads parts.** It reads their manifests, checks dependencies and versions, and mounts each part's main and renderer code.
- **Keeps a registry.** This lists what each part provides: IPC handlers (namespaced as `part-id:channel`), events, UI slots, MCP tools and file schemas.
- **Owns the project store.** It handles all reading and writing in project folders. Each part gets its own area of each project, through a scoped API (`ctx.files`).
- **Runs agent sessions** for whichever provider is plugged in (Claude Code today, others later), with each part's declared tool permissions.
- **Handles safety:** an error boundary for each UI slot, a try/catch around each handler, safe mode, and an "Undo last change" control.

The core does not contain Research, Create or Refine logic. Those are parts.

### Parts

A part is a folder:

```
parts/
  research-board/
    part.json        manifest
    main.ts          main-process side: registers handlers through ctx
    view.tsx         renderer side: mounts into a named slot
    schema/          JSON schemas for the files it owns
    test/            contract tests the loader runs before enabling it
    README.md        what it does, for people and for the Orchestrator
```

Here is an example manifest:

```json
{
  "id": "research-board",
  "version": "1.2.0",
  "kind": "board",
  "core": "^1.0",
  "dependsOn": ["references@^1"],
  "provides": {
    "ipc": ["load", "add", "retag", "interpret"],
    "events": ["interpreted"],
    "slots": { "area:research": "Board" },
    "files": ["research/<board>/board.json", "research/<board>/interpretation.md"]
  },
  "permissions": { "fs": "project", "network": ["fetch"], "agents": ["orchestrator"] },
  "settings": "schema/settings.json"
}
```

Each part has one of these kinds:

| Kind | What it is | Examples |
| --- | --- | --- |
| `phase` | An area of the book | Research, Create, Refine; a user's own "Pitch" phase |
| `board` | A group of cards inside an area | references, inspiration, usable assets; a "3D references" board |
| `interpreter` | Reads the inputs and writes a document | art direction, type direction, 3D direction |
| `deliverable` | A runner for a Musician type, where it needs code beyond its markdown | slide export, render queue |
| `connection` | A provider or MCP server, with a setup UI | Figma, Blender, ElevenLabs; ChatGPT as a provider |
| `view` | A UI surface in a slot | the stage, the drawer, the minimap |
| `theme` | Tokens, fonts and slot layout | the Orchestra theme, a user's own brand |

The canvas from `canvas-concept.md` fits this well. The book is a set of areas (phase parts). Each area is a board of cards (board and view parts). The slot system is just "which part renders which card where".

### Library (markdown, no code)

The library holds what exists today (`musicians/`, `instruments/`, `house-rules.md`, `orchestrator.md`, `templates/`) and adds:

- **`interpreters/*.md`:** what to read, what to write and the prompt. This is the Interpret prompt that is hard-coded in `interpret.ts` today, moved into a file.
- **`boards/*.md`:** a board's sections and tags. Today these are hard-coded as `Tag = 'inspiration' | 'asset'` in `research.ts` and in `Research.tsx`.
- **`sources.json`:** the reference sites. This replaces `DEFAULT_SITES` plus `sites.json`.
- **`reads:` front matter on Musicians:** which interpretation files an agent takes as its brief.

### Theme (no code)

The theme layer covers:
- **`tokens.css` / `tokens.json`:** colours, type, spacing and elevation. This is already generated from Figma.
- **`fonts/`:** the font files the theme uses.
- **`layout.json`:** which part goes in which slot, and the default card positions on each board.

There is a user override layer on top that never touches the shipped theme. "Change the colours" edits that override, not the core CSS.

## 4. What's in the code today

| Today | Problem | Elastic version |
| --- | --- | --- |
| `main/index.ts` registers about 35 IPC handlers in one file | Every feature edits the same file | Each part registers its own namespaced handlers through `ctx.ipc` |
| `research.ts`: `Tag = 'inspiration' \| 'asset'` | You can't add a section or a second board | Board schema in `library/boards/*.md`; tags come from the schema |
| `interpret.ts`: prompt and sections hard-coded, writes only `research.md` | You can't have a type direction and a 3D direction side by side | Interpreter files; each writes `research/<board>/interpretation.md` |
| `Research.tsx` renders fixed sections | The UI can't follow new board types | The board view renders whatever sections the schema declares |
| `prompts.ts` builds every agent's instructions in code | Changing how agents are briefed needs a code change | It assembles from library files; only the glue stays in code |
| `plan.ts` `foundationOrder` (pure, shared with the renderer) | Already the right shape | Keep it. This is the model for core utilities: pure, tested, no I/O |
| Library markdown for Musicians and Instruments | Already the right shape | Keep it, and copy the pattern for interpreters, boards and sources |
| `tokens.css` generated from Figma ("Do not edit") | Users can't restyle the app without losing changes on the next export | Shipped theme plus a user override layer |

## 5. The Orchestrator bar's three modes

The input at the bottom of the canvas has three modes. Each mode goes one step deeper into the app, so each one looks different. You switch with a segmented control on the bar, or by typing `/conduct`, `/arrange` or `/terminal`.

### I. Conduct (default)
- **What it's for:** working on the project. You brief agents, approve work and give feedback.
- **What it can change:** project files only.
- **Look:** a white bar and the orb (the current design).

### II. Arrange
- **What it's for:** reshaping Orchestra without touching code.
- **What it can change:** the library and the theme. It adds a Musician or an Instrument, writes a new interpreter, defines a new board, adds a source site, or changes colours, fonts or the slot layout.
- **How changes land:** each one is a markdown or JSON file the user can read, and the app picks it up live.
- **Look:** a blue bar, with a list of the files it will change.

### III. Terminal
- **What it's for:** changing the app's code when nothing in Arrange can do the job.
- **How a change runs:**
  1. **Check the cheaper levels first.** The Orchestrator looks for an existing extension point. If Arrange can do it, it says so and offers to do it there.
  2. **Plan.** It lists the parts it will add or change, whether the core is touched (a warning in red), the permissions the change needs, and how risky it is.
  3. **Work on a branch.** It works in a git worktree of the user's fork (`local/<feature>`), never on the running code.
  4. **Check.** It runs typecheck, lint, unit tests, the part's contract tests, and a test launch in a sandbox window that loads only that branch.
  5. **Preview.** The user tries it in the sandbox window.
  6. **Merge.** When the user approves, the branch merges and the new part is turned on behind its own toggle, in Settings → Parts.
  7. **Undo.** "Undo last change" in the core switches the part off and reverts the commit.
- **Look:** an ink bar with mono text, a `>` prompt and the current branch name. You can see you're working on the machine, not the music.

**Protected paths.** Terminal mode cannot edit these without a separate, explicit confirmation:
- `core/`
- the safe-mode and undo code
- the parts loader
- the permissions table

## 6. Keeping it from breaking

- **Isolation.**
  - Every UI slot has an error boundary.
  - Every IPC handler runs in a try/catch.
  - A part that throws on load, or fails its contract tests, is switched off and shown in Settings → Parts with the error. The app goes on without it.
- **Safe mode.** Hold Shift at launch, or let the app enter it by itself after two crashes in a row. Safe mode loads only the core and the official parts, with the shipped theme. Users can always get back in.
- **One owner per file.** Each part owns the files listed in its manifest. Other parts can read them through events or the read API, but never write them.
- **Versions.**
  - Parts use semver, and declare which core version they need (`"core": "^1.0"`).
  - File schemas carry a `schemaVersion`. Parts ship migrations, and the core runs them with a backup first.
- **Permissions.** A part declares its filesystem scope, network use, agents and MCP tools. The user approves them when turning the part on. Agents inherit only their part's permissions; the house rule "use only the tools loaded in your session" already points this way.
- **Git as the safety net.**
  - Every Arrange or Terminal change is a commit with a plain-language message saying what changed and why.
  - The history is browsable in Settings, with a revert button on each commit.
- **Upstream updates.**
  - **Where changes live:** a user's changes sit in parts, library files and theme overrides, not in core edits. So pulling a new official version rarely conflicts.
  - **When it does conflict:** Terminal mode offers to rebase the user's parts on the new core, and runs the contract tests again before switching them back on.

## 7. Worked example: a 3D research board

The request: *"Use research.md for type only. I want a separate set of references, inspiration and assets for the 3D models, with its own direction."*

1. The Orchestrator, in Conduct, sees this needs a new board, which is something Arrange can make. It suggests switching to Arrange.
2. In Arrange it writes `library/boards/3d.md`:
   ```markdown
   ---
   id: 3d
   name: 3D references
   area: research
   sections: [references, inspiration, usable-assets]
   tags: [form, material, lighting, scale]
   interpreter: 3d-direction
   ---
   For models and renders. Keep separate from the art direction.
   ```
3. Still in Arrange, it writes `library/interpreters/3d-direction.md`. This holds the prompt, the sections to write (Form, Materials, Lighting, Camera, Questions) and the output file, `research/3d/interpretation.md`.
4. It adds `reads: [research/3d/interpretation.md]` to `musicians/render-3d.md` and `musicians/cad-model.md`.
5. The Research area now shows a second board, "3D references", next to the first. Running Interpret on it writes its own document, which the 3D Musicians take as their brief. No code changed.
6. **If Orchestra can't yet show two boards in one area,** that one missing capability is the only part of the request that needs Terminal mode. It becomes a small, single change to the board part, made through the branch, checks, preview and merge steps. The next user who wants a third board only needs Arrange.

That last step is how the app stays elastic: each Terminal change should add an extension point, so the same kind of request can be met in Arrange from then on.

## 8. Suggested repo layout

```
app/
  core/              loader, registry, store, sessions, permissions, safe mode, undo
  parts/             official parts (research-board, interpreter, stage, drawer, …)
  sdk/               types and helpers parts build against (ctx, slots, schemas)
Orchestra/
  library/           agents, house rules, interpreters, boards, sources
  theme/             shipped theme + user/ overrides
  parts/             the user's own parts (a separate folder, so updates never clash)
  projects/
```

## 9. Order of work

1. **Split the main process.** Build a part registry and namespaced IPC, and move each group of handlers in `index.ts` into its own part. Behaviour doesn't change.
2. **Move the hard-coded parts of Research into files:** board schemas, interpreter files and `reads:` on Musicians.
3. **Theme override layer.** Tokens plus slot layout, with live reload.
4. **Arrange mode.** The Orchestrator edits the library and theme, with a list of changed files and a git commit for each change.
5. **Terminal mode.** Worktree branches, the checks, the sandbox window, a toggle for each part, protected paths and safe mode.
6. **Sharing parts.** Export a part as a folder or zip, and install one from a link. Show its permissions before install.

## 10. Open questions

- **Live reload.** Renderer parts can hot-reload. Main-process parts need a restart. Is a quick automatic relaunch acceptable, or should main parts run in a utility process that can restart on its own?
- **Community parts.** How much do we trust parts written by other people? Requiring their permissions to be listed and approved at install is the minimum. Do they also need sandboxing?
- **Other providers.** If Terminal mode runs on a non-Claude provider, does it get the same tool permissions, or a narrower set?
- **Naming.** "Parts" fits the orchestra theme (an orchestral part is one player's music). Do we keep it, or call them "Sections"?
