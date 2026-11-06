# Orchestra: extensibility plan

Goal (from `future-ideas.md` §2): release Orchestra so anyone can use it **and change it however they like**. This plan maps the app as it is today (Nov 2), lists what's already easy to change and what isn't, and sets out the work in order.

---

## 1. The architecture today

```
Orchestra/ (the vault, ORCHESTRA_HOME)        app/ (Electron)
  library/                                      main process (Node)
    orchestrator.md, house-rules.md               index.ts       windows, tab drag, ~50 IPC handlers
    musicians/*.md   (one per deliverable)        conductor.ts   runs the agent tree, chats, logs, Stop
    instruments/*.md                              session.ts     one headless `claude` CLI process per agent
    templates/                                    orchestra-mcp.ts  local MCP server: agents' Orchestra tools
  sites.json  (user's own reference sites)        prompts.ts     builds each agent's system prompt
  projects/<id>/                                  library.ts     reads/writes the markdown agent library
    concept.md, research.md, deliverables.md      providers.ts / connections.ts  provider list + detection
    references/, prereqs/, exports/               research.ts, projects.ts, deliverables.ts, plan.ts, proposals.ts
    .orchestra/ (chats, logs, sessions)          preload/index.ts  the bridge: the renderer's whole API
                                                renderer (React + Tailwind)
                                                  App.tsx, Sidebar, Workspace (tabs), Research, Create, Agents
                                                  tokens.css (generated from Figma tokens.json), Icon, Ascii
```

How a request flows: the user types in Create → IPC `chat:send` → `Conductor` → a `ClaudeSession` (spawns `claude -p --input-format stream-json`) for the Orchestrator → the Orchestrator calls tools on `orchestra-mcp` (brief a Musician, propose an agent…) → the Conductor starts Musician/Instrument sessions the same way → events stream back to the renderer over IPC.

Rules of thumb already in the code: data is plain files (markdown + JSON) that Obsidian, Graphify and agents can all read; no database; no import cycles; pure logic has tests (`*.test.mjs`).

## 2. What's already easy to change (keep it this way)

| What | Where | Why it's easy |
|---|---|---|
| Agents (Orchestrator, Musicians, Instruments) | `library/*.md` | Plain markdown: front matter = settings, body = prompt. Editable in the app, in Obsidian, or by agents. `source:` field says who made it. |
| Deliverable types | `library/musicians/*.md` | A new deliverable is a new Musician file; prerequisites and build order are computed (`plan.ts`). |
| House rules | `library/house-rules.md` | One file, read into every prompt. |
| Reference sites | `sites.json` + `DEFAULT_SITES` | Users' own sites stack on top of the defaults. |
| Colors and type | `tokens.json` → `npm run tokens` → `tokens.css` | Screens use only token variables (no raw hex in any `.tsx`), so a palette swap is one file. |
| Models per agent | `model:` / `provider:` in each agent file | Already per agent; the provider list is a data table. |

## 3. Pain points (what an outsider would struggle with)

Ranked by how much they block release or customization.

1. **Only runs on this machine.** `paths.ts` finds the vault relative to the folder the app was started from. An installed or forked copy won't find its data. *(Blocks release.)*
2. **Starter content isn't in the app.** The agent library and templates live only in your vault, not in `app/`. A new user gets an empty library. There's also no plan for shipping updated starter agents without overwriting a user's edits.
3. **Claude is wired in, not plugged in.** `conductor.ts` creates `ClaudeSession` directly; `RUNNABLE` is Anthropic only; `ProviderId` is a closed type. The mix-and-match-models idea needs a seam here.
4. **Tool and safety policy is hard-coded.** `READ_TOOLS`, `NOT_ALLOWED`, `MAX_WORKING` (4), `MESSAGES_PER_HOUR` (40) in `conductor.ts`; the "Figma/Blender not connected" line in `prompts.ts`. External tools (Figma MCP etc.) can't be connected without code changes.
5. **Theme is your brand only.** `tokens.css` is generated at build time from *your* brand project. A user can't change the palette without rebuilding. Logo, wordmark and ASCII art are also baked in (fine for Advanced mode, but no in-app way).
6. **A few very large files.** `Create.tsx` 1,301 lines, `conductor.ts` 799, `Agents.tsx` 744, `Research.tsx` 693, `index.ts` 484 (window/drag code mixed with every IPC handler). Hard to find your way around, and risky for agent-driven edits.
7. **No written docs for contributors.** No architecture overview, no spec of the agent file format, no list of the IPC API (`preload/index.ts` is the de facto contract).
8. **Packaged builds can't edit themselves.** An installed app is compiled into an archive, so Advanced mode needs a source checkout to edit.

## 4. Approach: three layers of customization

Each change a user might want should land in the lowest layer that can handle it.

1. **Data (no code, everyone).** Agents, deliverables, house rules, sites, theme tokens, settings. Lives in the user's Orchestra folder, survives app updates, editable in the app and in Obsidian.
2. **Extension points (small, documented code).** A few named seams with one interface each: compute providers, tool/MCP connections, Refine audits. Adding one = adding a file that follows the interface, not editing the core.
3. **Source (Advanced mode).** Anything else: screens, layout, motion, features. Git-backed, with "revert last change".

The rule for future work: when building a feature, ask "is this data, a seam, or core?" and put user-changeable parts in the lowest layer.

## 5. Work plan (in order)

**Phase 0: Map (small).**
- Refresh the Graphify graph of the repo (current one is from Nov 1).
- Turn §1 above into `ARCHITECTURE.md` in the repo.

**Phase 1: Portable (needed for any release).**
- Data folder: default to a real location (e.g. `Documents\Orchestra`), set by onboarding Step 4, overridable by `ORCHESTRA_HOME`. Fixes pain point 1.
- Starter content ships in the app (`app/resources/starter/`) and is copied into the data folder on first launch.
- Starter updates: compare by `source: starter` + a version in front matter. Untouched starter files update automatically; ones the user edited are kept, and the new version is offered as a suggestion. Fixes pain point 2.

**Phase 2: Seams (the extension points).**
- **Runner interface.** Pull what `Conductor` needs from `ClaudeSession` (start, send, stop, stream events) into an `AgentRunner` interface; Claude Code becomes the first adapter. New providers = new adapter + a row in `providers.ts`. Fixes pain point 3.
- **Tool policy to data.** Move tool lists and limits into a settings file in the data folder; let agents' front matter list the MCP connections they may use (Figma first). Fixes pain point 4.
- **Runtime theme.** Load an optional user `theme.json` (same shape as `tokens.json`) at startup and apply it over the built-in tokens; same for logo/ASCII files. Fixes pain point 5.

**Phase 3: Split the big files** (only where it helps someone find their way; no behavior change, tests stay green).
- `index.ts` → windows/drag vs. IPC handlers grouped by screen.
- `conductor.ts` → chat storage (files) vs. running agents.
- `Create.tsx` → chat, agent tree/score, files panel as separate components. Same for `Agents.tsx`, `Research.tsx` as they grow.

**Phase 4: Docs.**
- `ARCHITECTURE.md` (Phase 0), `CONTRIBUTING.md` (dev setup, tests, the three layers), `docs/agent-format.md` (every front-matter field), `docs/extending.md` (how to add a provider, a tool connection, an audit), and comments on the preload API.

**Phase 5: Advanced mode** (from `future-ideas.md` §2).
- Clone the source into the data folder, run it in dev mode, add the "Orchestra" project, git commit every change, "revert last change" outside the editable UI.

## 6. Fitting it around the current build

- Don't stop current work (decision cards, preview card, Agents screen + MCP, Files screen) for this. Instead:
  - Phase 0 and Phase 1 can go in any time; they're small.
  - Do the runner interface (Phase 2) **before** adding a second provider, and the tool-policy move **with** the Figma MCP connection work on the Agents screen, since that touches the same code.
  - Split `Create.tsx` the next time a feature there is big (decision cards would be a good moment).
- Phases 4 and 5 come right before a public release.

## 7. Decisions for you

- **License:** MIT (anyone can do anything), or something that keeps forks open (e.g. GPL)?
- **Default data folder:** `Documents\Orchestra`, Desktop (as onboarding Step 4 says), or the user's choice with one of those as default?
- **Starter updates:** auto-update untouched starter agents, or always ask?
- **Public repo:** open the current repo, or a fresh public one without your client history (`.gitignore` already keeps client projects out, but history should be checked)?
