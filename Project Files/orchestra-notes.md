# Orchestration: Design Workflow Notes

Oct 30, 2026 · @Garrett Grainger

The plan: adopt a small stack of agent plugins and design-audit skills now, and use them as the backbone of a three-phase design web app, Orchestration (Research → Creation → Audit). These notes capture the tools to evaluate, the visual reference sources, and the app concept as it stands on Oct 30.

## Tonight's action plan

Run the pipeline by hand first, then build the app around what worked. Three blocks, about an hour each; stop after any block and you still have something usable.

### Block 1: Set up the machine (~1 hr)

- [x] Check prerequisites: Node 22 or 24 (not 23, which OmniRoute rejects), Python 3.10+, Git, latest Claude Code, Obsidian, Figma desktop.
- [x] Install Ponytail in Claude Code, sending each line as its own message: `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail`.
- [x] Install Graphify: `pip install graphifyy && graphify install` (two y's).
- [x] Clone [heydamir/unslop](https://github.com/heydamir/unslop) and install it per its README. Optional: Impeccable as a second opinion.
- [ ] Connect the Figma MCP in Claude Code and confirm it can see your account.
- [x] Create the Figma file **Orchestration** with pages: Foundations, Color, Type, Components, Audit.
- [ ] Create the vault folder: `Orchestration/projects/orchestration-brand/` with `references/`, `prereqs/`, `audits/` and a `concept.md`. Open `Orchestration/` as a vault in Obsidian.

### Block 2: Run the pipeline by hand on Orchestration's own brand (~1 hr)

- [ ] **Research:** save 5 to 10 references (Hermes screenshots plus finds from the seven sites) into `references/`. In `concept.md`, write the concept and one line per reference on what you like about it.
- [ ] **Index:** run `/graphify` on the project folder; read `GRAPH_REPORT.md` and check the Obsidian output looks right.
- [ ] **Generate prerequisites:** ask Claude Code to produce a color palette, type styles and spacing guide as `prereqs/tokens.json` + `prereqs/design-system.md` + a project `SKILL.md`, then push them to the Figma pages through the MCP.
- [ ] **Create:** ask for one landing-page hero and one app screen, with the project skill loaded.
- [ ] **Audit:** run unslop (and `/audit` if installed) on the output; save reports to `audits/`.
- [ ] Write down every manual step, prompt and snag, such as a paywalled font. That list becomes the app's spec.

### Block 3: Start the app (~1 hr+)

- [ ] Branch or fork Pitcrew into an **Orchestration** repo with Ponytail active.
- [ ] Split the structure: Electron shell · React UI · Node agent service talking over a local API.
- [ ] Build the layout shell: sidebar (search, projects, + New; settings, account, agents) and the project workspace with four tabs.
- [ ] Build the Research tab first: site buttons, references table, deliverables picker, agent output panel. New projects create the vault folder structure from Block 1.
- [ ] Wire Generate to the exact steps from Block 2.

**Parked for later:** OmniRoute, combined-graph view, Refine button, Graphify Python bundling, web version.

## Plugins & skills to evaluate

All four are open source and work in Claude Code; three also run in Codex, Cursor, Gemini CLI and similar agents. Ponytail and Graphify are the quickest wins; OmniRoute is infrastructure with real security trade-offs.

| Tool | What it does | Install | Fit for the design app |
| --- | --- | --- | --- |
| [Ponytail](https://github.com/DietrichGebert/ponytail) | Minimalism plugin that makes agents walk a seven-step "do we need this?" ladder before writing code, to stop over-engineering. v1.0 benchmark: 293 → 47 lines, about 16% fewer tokens. | `/plugin marketplace add DietrichGebert/ponytail`, then `/plugin install ponytail@ponytail` (send as two messages). Needs Node on PATH. | Keeps the app's codebase lean while building it. `/ponytail-review` audits a change. |
| [OmniRoute](https://github.com/diegosouzapw/OmniRoute) | Self-hosted, MIT-licensed AI gateway: one OpenAI-compatible endpoint (`localhost:20128/v1`) routing to hundreds of model providers, with fallback, quota tracking, MCP and A2A support. | Clone repo; Node 22 or 24 (not 23). | Could be the model layer for the orchestrator and subagents (cheap models for scanning, strong ones for generation). No published security audit; all traffic passes to upstream providers. |
| [Graphify](https://github.com/safishamsi/graphify) | Skill that turns a folder of code, docs, PDFs and images into a queryable knowledge graph, so the agent queries the graph instead of grepping files. Uses Claude vision for images. | `pip install graphifyy && graphify install` (package name has two y's), then `/graphify .` | Index a project's reference images + notes into one graph; `--mcp` exposes it as an MCP server agents can query. |
| [Agent Skills](https://agentskills.io) | The open standard (from Anthropic, Dec 2025) for packaging skills as a folder with a `SKILL.md`; adopted by Claude, Codex, Gemini CLI, Copilot, Cursor, VS Code and more. | No install; a format. | Write the app's audit rules and agent roles as Agent Skills so they're portable across any model/agent. |

Open question: "Agent Skills" may have meant a specific collection (e.g. ConardLi's Agent Skills, which includes a web-design-engineer skill) rather than the standard. Confirm which.

**Also watch: [Hermes Agent](https://github.com/NousResearch/hermes-agent)** (Nous Research, MIT, released Feb 2026). A self-improving agent pitched as "the agent that grows with you": persistent memory across sessions, and it writes and refines its own skills from experience. Model-agnostic; runs on a laptop, a cheap server or Nous's cloud, and reaches you through Telegram, Slack, Discord and others. Relevance to Orchestration: its learning loop is a model for how a project's design system and the user's taste could compound over time instead of resetting each session.

## AI "unslop" skills: spacing & color auditing

Damir Sokolovsky ([@heydamir](https://x.com/heydamir)) released the skill from his demo: after his "unslopping a vibecoded dashboard" post hit 1M views (Oct 27–28), he published it free at [github.com/heydamir/unslop](https://github.com/heydamir/unslop). He says it works on landing pages, dashboards and mobile apps. Install and test it first.

Other skills covering the same ground, worth comparing:

| Skill | Approach | Notable |
| --- | --- | --- |
| [unslop](https://github.com/heydamir/unslop) (Damir Sokolovsky) | His personal unslopping process as a Claude skill | Brand new; check the README for scope |
| [Impeccable](https://impeccable.style) (Paul Bakaus) | Extends Anthropic's frontend-design skill with 7 references (type, OKLCH color, spatial, motion, interaction, responsive, UX writing) + ~20 commands | `/audit`, `/critique`, `/layout`, `/normalize`, `/polish`; a CLI `npx impeccable detect src/` flags anti-patterns without an LLM |
| [Design Auditor](https://github.com/borghei/Claude-Skills) (borghei) | 12-category scored audit → three grades: Design, AI Slop, Accessibility | Scripts: `ai_slop_detector.py`, `color_contrast_checker.py` (WCAG AA/AAA with fix suggestions) |
| [OPTIK / taste-skills](https://dragoon0x.github.io/optik) (dragoon0x) | Design-quality engine with a scoring algorithm and anti-pattern registry | `/density`, `/rhythm`, `/align`, `/layout-fix` (auto-fixes off-grid spacing) |
| Hallmark | Forces a design direction before code; ~57 "slop gates" | `study <screenshot or URL>` extracts design DNA from a reference, useful for Phase 1 |

What to check for, across all of them: off-grid spacing and broken vertical rhythm; generic fonts (Inter/Roboto everywhere); purple-to-blue gradients and neon-on-dark palettes; low contrast; predictable card-grid layouts.

## Visual design reference databases

Seven sources for Phase 1, split by what they're good for. Three are public-domain image banks you can use directly in deliverables; the rest are for inspiration only.

| Site | What it is | Use in the app | Reuse rights |
| --- | --- | --- | --- |
| [are.na](https://www.are.na) | Collaborative boards/channels for collecting images, links and text | Moodboards; has a public API, so a candidate for direct import | Varies by item |
| [visuelle.co.uk](https://visuelle.co.uk) | Curated graphic design inspiration blog | Branding, identity, editorial references | Inspiration only |
| [designreviewed.com](https://designreviewed.com) | Archive of vintage graphic design (posters, ads, print) | Historical type and layout references | Inspiration only |
| [cari.institute](https://cari.institute) | Consumer Aesthetics Research Institute: archive naming and cataloguing aesthetics | Defining the visual era/vibe of a concept | Inspiration only |
| [public.work](https://public.work) | Cosmos's search engine for 100,000+ public domain images (The Met, NYPL and others) | Imagery and texture you can actually use | Public domain |
| [artvee.com](https://artvee.com) | Free downloads of public domain fine art | Classical art, illustration, posters | Public domain |
| [rawpixel.com](https://www.rawpixel.com) | Stock library with a large free public domain section | Photos, vintage illustrations, mockups | Check per image (CC0 vs paid license) |

Tag each saved reference in the app as "inspiration" or "usable asset" so licensing never gets lost.

## App concept: Orchestration

Orchestration is the evolution of Pitcrew and will replace it. Each project moves through Research → Creation → Audit, and the Audit phase can send work back to Creation. Everything hangs off a **Project** the user creates first (name, client, goal).

*Diagram (in the online doc): Create a project → Research → Design creation → Design audit, with audit sending fixes back to creation.*

**1. Research**

- A row of buttons, one per reference database; each opens the site in a new tab.
- **Visual references** panel: paste a link to an inspiration image/page, or upload files. Each saved item gets a thumbnail, source URL and an "inspiration / usable asset" tag.
- **Concept** box: a description/prompt of what the project is trying to say.

**2. Design creation (orchestrator + subagents, carried over from Pitcrew)**

- An orchestrator agent reads the concept and references and hands work to specialist subagents, each able to use MCP connections.
- Suggested subagents: Reference scanner (extracts palette, type, mood, composition from each image) · Color palette · Typography · Layout/grid · Asset builder.
- Output lands in a Figma file via the Figma MCP: a styles page (color variables, text styles), then design assets.
- The user chats with the orchestrator to refine and generate more content.

**3. Design audit**

- Run deliverables (Figma frames, screenshots or built pages) against spacing, alignment, grid, type scale, color contrast and AI-slop checks.
- Output: a scored report with specific fixes; "Send back" routes fixes to the orchestrator.
- Build the checks from the skills above (unslop, Impeccable, Design Auditor) packaged as Agent Skills.

Stack (decided Oct 30: Electron, carried over from Pitcrew): React UI hosted in Electron · a separate Node agent service talking to the UI over a local API, so it can move to a server later · OmniRoute as the model gateway · Figma MCP for output · Graphify (MCP mode) to index each project's references · Cloudflare R2 for uploads and D1 for project data.

**Inspired by Hermes Agent**

- **Behavior: an Orchestration that grows with you.** Keep memory across projects, not just within one: which references you saved, what you said you liked, which fonts and palettes you kept or rejected, which audit fixes you accepted. Over time the orchestrator proposes directions closer to your taste. Like Hermes, agents could turn repeated workflows into their own skills.
- **Visual direction: Hermes-like.** A stark, saturated blue field with white; serif headlines; classical engraving-style imagery rendered with dithering; scroll-driven reveals on the landing page. For the app itself, keep the blue as an accent and the workspace mostly white so users' own design work stays the focus.
- Next: save a few Hermes screenshots into the Research references and run them through Phase 1, so Orchestration's own brand is its first test project.

## UI layout

Two columns: a fixed management sidebar on the left, the project workspace on the right. The workspace header holds the project name and description, then four tabs: Research · Create · Refine · Files.

*Wireframe (in the online doc): management sidebar on the left; project header, four tabs, site buttons, references table, deliverables picker and agent output panel on the right.*

**Sidebar (management)**

- Top: Search, Projects list, + New project.
- Bottom: Settings, Account, Agents (orchestrator and subagent setup, models, MCP connections).

**Research tab** (top to bottom)

1. **Reference sites**: the seven site buttons, each opening in a new tab, plus "+ Add site" to save more sources later.
2. **References table**: one row per pasted link or uploaded file. Columns: Link or file (with thumbnail) · What I like about it · Tag (inspiration / usable asset).
3. **Deliverables picker**: once references exist, choose what to generate first: color palette, type styles, spacing guide, grid and layouts, components, and so on. Then Generate.
4. **Agent output panel**: where agents report anything they can't resolve alone, each with action buttons. Example: a chosen font is behind a paywall → buy it, or swap for a free alternative?

When generation finishes, the prerequisites are saved to Figma (pages such as Foundations, Color palette, Type, Components), to local files, or both.

**Create tab**

- Chat with the orchestrator, with a preview of the Figma frames it produces.
- The project's design system is attached to every request automatically, so the user never has to say "use the design system." A pinned chip ("Using: design system v1") shows it's active.
- Implementation idea: write the prerequisites out as `tokens.json` + a per-project `SKILL.md` (Agent Skills format) that the orchestrator always loads. Same source of truth for Figma, code and agents.

**Refine (audit)**

- Recommendation: merge it into Create as a **Refine** button that runs every audit and unslop skill on the selected frames or the whole file and returns a scored report with fixes.
- Keep a slim Refine tab only as the history of audit reports, so you can compare passes.

**Files tab**: every upload, generated asset, exported token file and the Figma file link in one place.

**Agents tab: knowledge graphs (Graphify)**

- **Per-project graph.** Each project folder (references, concept, saved notes, chat history, audit reports, prerequisite files) is indexed with Graphify. Images go through Claude vision, so a reference's palette, type and mood become nodes linked to the concept.
- **Combined graph.** One graph across all projects, built by running Graphify over the parent folder or merging each project's `graph.json`. This is where cross-project taste shows up: fonts, colors and references you keep returning to.
- **The view.** Graphify already outputs an interactive `graph.html`; embed it in the Agents tab with a project / all-projects toggle, search and filter by community. Show its report alongside: "god nodes" (most-connected ideas) and surprising connections.
- **Agents use it too.** Run Graphify as an MCP server so the orchestrator queries the graph instead of re-reading files. This is the memory layer behind the Hermes-style "grows with you" idea.
- **Keeping it current.** Re-run with `--update` after each phase, or `--watch` while a project is open.
- **Watch out:** Graphify is Python 3.10+, so the Electron app must bundle Python or check for it at install. Image and doc extraction makes model calls, so large reference sets cost tokens on each full rebuild.

**Obsidian as the readable layer** (from [Chase AI's Graphify + Obsidian + Claude Code video](https://www.youtube.com/watch?v=mWLDn49_8HA)): Graphify can write its graph out as an Obsidian vault, so the graph's insights merge into a larger vault that Claude Code reads as plain markdown. For Orchestration:

- Store each project as an Obsidian-compatible folder (markdown notes + links), with the Graphify output inside it. All projects together form one master vault: the combined graph.
- Any agent, including Claude Code outside the app, can then query a project by reading notes and following links, no custom API needed.
- Bonus: you can open the vault in Obsidian itself to browse or edit a project's knowledge by hand, and the app picks up your edits on the next `--update`.

## Open questions & next steps

- [ ] Install and trial Damir's [unslop](https://github.com/heydamir/unslop) on a past project; compare against Impeccable's `/audit`.
- [x] Install Ponytail and Graphify on the home machine.
- [x] Confirm which "Agent Skills" was meant: Addy Osmani's [agent-skills](https://github.com/addyosmani/agent-skills) plugin (installed Oct 30).
- [ ] Decide on OmniRoute vs. calling one provider directly for v1 (security review first).
- [ ] Is the app for personal use, the team at work, or public? This drives auth, hosting and licensing.
- [ ] Should references pull in automatically (Are.na API) or stay copy-paste for v1?
- [ ] Audit input: Figma frames only, or also live URLs and screenshots?
- [ ] Where does Figma output go: one file per project, or a team library?

### Sources

[Ponytail on GitHub](https://github.com/DietrichGebert/ponytail) · [Ponytail v1.0.0 release](https://newreleases.io/project/github/DietrichGebert/ponytail/release/v1.0.0) · [OmniRoute on GitHub](https://github.com/diegosouzapw/OmniRoute) · [OmniRoute security notes (dev.co)](https://dev.co/ai/mcp/omniroute) · [Graphify on PyPI](https://pypi.org/project/graphifyy/) · [agentskills.io](https://agentskills.io) · [Damir Sokolovsky on X](https://x.com/heydamir) · [Impeccable](https://www.mintlify.com/pbakaus/impeccable/introduction) · [Design Auditor](https://openskillindex.com/skills/borghei-claude-skills-design-auditor) · [OPTIK](https://dragoon0x.github.io/optik) · [Public Work (Cosmos)](https://www.cosmos.so/public-work)

## Brand direction (Oct 30)

- **Mark:** your f-hole on a stark blue field. It reads as a violin's sound hole (orchestra) and as the integral sign ∫ (many parts summed into one). Redraw it as a vector for final use.
- **Imagery:** classical figures rendered in text characters, ideally built from real agent-log words.
- **Name:** "Orchestration" in Instrument Serif italic.
- **Type:** Instrument Serif roman for headlines; Instrument Sans for the interface, labels and body; IBM Plex Mono for agent log messages only.
- **Color:** Orchestration Blue #0538FF (confirm the exact hex from your file) · White #FFFFFF · Ink #0B0B12 · Mist #B8C4FF for agents · Signal #FF5A1F for "needs you" moments.
- **References:** Nigel Cottier's *Alphabetical Playground* (grid-built letterforms; kept as a secondary modular wordmark), Lost Property's *Super Generic* (classical serif plus one blue motif), Hermes Agent (blue, serif, dithered engraving).
- **Still open:** title font alternatives explored on the brand canvas (thin and sharp italics), the tagline copy, and the f-hole's source typeface.

## Product vision (Oct 31, dictated)

**Name:** the app is now **Orchestra** (was Orchestration).

**Core idea: it grows with you.** It ships with enough defaults to start, but the long-term value is what the user adds: their own deliverable types, research sources, refine skills and agents.

**Research:** browse visual content, then screenshot it or paste a link and add a note ("I like the typography here", "I like these colors"). The AI turns the notes into a research markdown file that interprets what the user wants.

**Create**
- Starts with a **deliverable picker**: a searchable grid of buttons (Brand kit, Slide deck, Website, Web app…), where you select all that apply and can add your own.
- Each deliverable type has **prerequisites**. Example: a slide deck needs a color palette, typography, layout and content (content can come later). Users can edit the prerequisites for each type.
- Agents build the shared foundations first, then the deliverables, and check in with the user throughout so the result stays distinctive and not AI slop.
- **Hierarchy (named Oct 31): Orchestrator → Musicians → Instruments.** One **Orchestrator** (Opus/Fable or whatever model the user can afford); one **Musician** per deliverable; **Instruments** are the subagents a Musician spawns for each prerequisite. Example: the Brand kit Musician plays Typography, Color, Layout and Spacing Instruments.
- **Screen:** a chat with the Orchestrator, plus a live view of the agent hierarchy with each agent's status.

**Refine:** run audits once work reaches a checkpoint, going back and forth with Create. It ships with preset skills (spacing audit, unslop…), and users can add their own refine skills or workflows.

**Agents menu:** view and edit the hierarchy, add agents, edit each agent's responsibilities and markdown file, and assign MCP connections per agent.


## Build plan (Oct 31)

Source of truth for screens: Figma Mockups page (node 2024:146). Code: `_Orchestration\app` (copied from Pitcrew's Electron + React + Tailwind scaffold; Pitcrew itself is untouched). Data: each project is a folder in the `Orchestration\projects` vault, so Obsidian, Graphify and any agent can read it.

**Decision:** the agent service stays in Electron's main process for v1 (as in Pitcrew), not a separate Node server. Split it out only when a web version is real.

1. **Foundation (done Oct 31).** Tokens generated from `tokens.json` (`npm run tokens`), brand fonts, logo and column icons from Figma, sidebar (expanded and collapsed), project header, phase tabs, New project screen that creates the vault folder and `concept.md`.
2. **Research (done Oct 31).** Site buttons (+ Add site), references (paste a link or drop a file, plus "what I like"), saved to `references/` as markdown. An **Interpret** button has the Orchestrator write `research.md`: what the user seems to want.
3. **Deliverable library.** Each deliverable type is a markdown file (name, prerequisites, Musician prompt, Instruments). It ships with defaults, and users can add their own.
4. **Create.** Deliverable picker, chat with the Orchestrator, live agent tree (Orchestrator → Musicians → Instruments) with status, and a "Needs you" queue. Reuse Pitcrew's `claude-runner`, `spawn-guard` and MCP pattern. Foundations are built once and shared across deliverables, then handed to the Musicians.
5. **Agents.** Edit the hierarchy, each agent's markdown file, its model and its MCP connections.
6. **Refine.** Audit suite from skills (unslop, spacing, contrast…), users can add their own audits, then findings → "Send back to Create".
7. **Files**, then the knowledge graph (Graphify), then dark mode.

Fixes from the mock-up review go in as each screen is built (Musician/Instrument names, outline "+ Add site", one solid button per panel).

## Deliverable library plan (Nov 1)

**Goal:** a library that grows with the user. The Orchestrator can write new deliverables and agents, the user can bring their own, and everything stays editable markdown.

**Where it lives:** `Orchestration/library/`, shared by every project, next to `projects/`.
- `deliverables/<slug>.md`: one file per deliverable.
  - Front matter: `name`, `category`, `keywords` (for search), `prerequisites` (a list of Instrument slugs), `source` (starter / orchestrator / mine).
  - Body: the **Musician prompt**.
- `instruments/<slug>.md`: one file per prerequisite.
  - Front matter: `name`, `output` (the file it writes into the project's `prereqs/`, e.g. `palette.md`, `tokens.json`), `needs` (other Instruments that must exist first), `source`.
  - Body: the **Instrument prompt**.
- Instruments are separate files, not copied into each deliverable, because prerequisites are shared. A logo and a business card both need the color palette. Building it once per project is what "foundations first" means, and it keeps the two deliverables consistent. A deliverable file still lists its Instruments by name, so it reads as a whole.

**Per project:** picking deliverables writes `deliverables.md` into the project. It lists the chosen deliverables and the prerequisites as edited for this project. Editing prerequisites in the picker only changes this project. A "Save to library" link copies the change back. This way library edits never shift a project mid-build.

**Three ways things get into the library:**
1. **Starter set from the user's list.** The user writes the deliverables they usually encounter. A one-off batch run has the Orchestrator draft each deliverable's prerequisites, Musician prompt and Instruments, reusing Instruments across deliverables. The user reviews the whole set once before it's saved.
2. **Import the user's existing agents** from their other project. Rename their code names to Orchestrator / Musician / Instrument, and convert each to the format above with `source: mine`.
3. **Created during the conversation (the main way).** When the user asks for something no Musician covers (e.g. a trailer inside a brand campaign), the Orchestrator says so and proposes a new Musician. Once the user approves, the Orchestrator writes the Musician. The Musician then designs its Instruments: it reuses existing ones first and writes new ones only for what's missing. The Musician's proposal goes back through the Orchestrator, who checks it with the user before anything is saved. The picker's "Add your own" just starts this conversation.

**Chain of command (rule, enforced by tools):**
- Only the Orchestrator talks to the user.
- Only the Orchestrator creates Musicians, and only Musicians create Instruments.
- Musicians report to the Orchestrator; Instruments report to their Musician.
- Each agent gets only the tools for its level. For example, no Musician has a "message user" or "create Musician" tool, so the rules hold even if a prompt drifts.

**Build slices** (each one works on its own):
1. Library format: `library.ts` (parse/write deliverables and Instruments, check that every prerequisite exists, no circular `needs`) plus tests. Seed 3 hand-written examples so the UI has data.
2. Picker: the start of Create. A searchable multi-select grid grouped by category; selected cards use the serif-italic style. The selection saves to `deliverables.md`.
3. Prerequisite editing: open a deliverable from the picker to add or remove Instruments for this project, plus "Save to library".
4. Creating agents in the conversation: the Orchestrator proposes a Musician, the Musician proposes its Instruments, the Orchestrator relays to the user, and approved drafts are saved. Built with the Create chat (build step 4), since that is where the conversation lives.
5. Bulk starter set from the user's list (reuses slice 4's generator).
6. Import the user's existing agents.

The Agents screen (build step 5) later becomes the full editor for these same files.

**Progress (Nov 1):**
- Slice 1 is done: `app/src/main/library.ts` (`loadLibrary`, `checkLibrary`) plus tests.
- Slice 6 is done early: the user's Pitcrew agents ("The Design Server" archive) were converted into `Orchestration/library/`.
  - Ultron → `orchestrator.md`.
  - 5 Commanders → Musicians: Brand Kit, UI Mockups, Motion, 3D Trailer, Implementation.
  - 7 Conscripts → Instruments: Brand Spec, Screen Inventory, Shot List, Kit Builder, Logo Builder, Mockup Builder, Blender Builder.
  - Kit Builder 2 was merged into Kit Builder.
  - Left out because they aren't design deliverables: Stand-up Recorder and the Cafe Club ops agents.
- Agents' lessons → `house-rules.md`, added to every prompt: loaded tools only, handoff notes, no images in chat, trust live state, limited Figma use.
- Templates are in `library/templates/`.

## The user's usual deliverables (Nov 1, dictated)

1. Brand kit: the source of truth for visual language.
2. Product website.
3. Slide decks.
4. Feature / app website.
5. Mobile app design.
6. Logos.
7. Logo animations / motion media.
8. Brand copy: slogans and marketing text.
9. 3D models in Blender, for rendering.
10. 3D models in Autodesk CAD, for print and production.

**Problem to solve: the kit has to keep growing.** Once a brand kit exists, agents avoid adding to it, but features keep needing new components, tokens and styles. The same happens with Orchestra's own Figma file. Today's rule ("flag gaps, never edit the design system") causes this.

**Library v2 (Nov 1):** 11 Musicians and 20 Instruments, covering the user's list. `checkLibrary` reports no problems.
- **Websites:** one Website Musician covers both product sites and SaaS/app sites.
- **3D:** 3D Trailer became 3D Render: sketch → reference sheet → model in review rounds → stills, trailer or browser GLB.
- **New:** Logo, Brand Copy, Mobile App, Slide Deck, CAD Model (Fusion).
- **Renamed:** UI Mockups → App UI.
- **Implementation** is a placeholder; it will later split into website, mobile and backend.
- **New shared prerequisites:** Product Brief, Voice Guide, Sitemap, Deck Outline, Model Reference, Part Spec.
- **The kit keeps growing:** gaps become kit addition requests, routed by the Orchestrator to Brand Kit. Additions only, approved by the user, and logged in `prereqs/kit-changelog.md`. The rule is in the Orchestrator, Brand Kit and the house rules.
- **Slice 2 (picker) is done, Nov 1.**
  - The Create tab opens on a searchable, multi-select grid of the library's Musicians, grouped by category.
  - A sticky footer shows the foundations in build order, worked out live by `plan.ts` (`foundationOrder`).
  - The selection saves to the project's `deliverables.md`: ids in the front matter, plus a readable build order.
  - "Add your own" is a placeholder until the Create chat exists.
- **Multiple windows (Nov 1):** Ctrl+Shift+N opens a new window. Ctrl+click or middle-click a project opens it in its own window, and the window is titled with the project name. **In-app tabs** come after the Create chat, when background agents make them pay off.
- **Deliverable icons:** each Musician has `icon:` (a Remix icon name) in its front matter; unknown names fall back to `shapes-line`. A new icon must be copied into `app/src/renderer/src/assets/icons/`.
- **Tabs and split view (Nov 1):**
  - A tab strip of open projects sits above the workspace. Clicking a project in the sidebar opens or focuses its tab.
  - Right-click a tab → "Split with <current tab>" shows the two side by side (no split button). A brand line marks the focused pane, which is where tab clicks go. The two split tabs sit together inside a thick dark-gray border. Dragging a tab past the window edge tears it off: a real window follows the cursor until release, and dragging back in cancels. Dropping on another window's tab strip (the dragged window goes see-through) moves the tab there. A window's only tab drags the window itself.
  - Right-click a project → "Open to the side".
  - The rules live in `renderer/src/tabs.ts`, with tests. Each project remembers its phase.
  - In a half-width pane, the 4-up grids drop to 2 (container queries).

## Create, part 1 (Nov 1)
- After deliverables are saved, Create shows the conversation with the Orchestrator ("A direction, together") beside the Agents card and Created files. "Change deliverables" goes back to the picker.
- `main/conductor.ts`: one long-lived headless Claude Code session per project (stream-json, like Pitcrew's runner). Replies stream live. The chat is saved in `<project>/.orchestra/chat.jsonl`, the session id in `.orchestra/session.json`. A resume that fails starts a fresh session.
- **The Orchestrator's instructions:** the library's `orchestrator.md`, the house rules, and the project context. Its tools: read the project and library, write inside the project, web. No Bash, and no Claude subagents.
- **Agents card:** foundations show "Ready" when their file exists in `prereqs/`. Musicians show "Not started" until briefing exists.
- **Next:**
  - Part 2: an Orchestra MCP with `brief_musician`; Musicians run as their own sessions with their Instruments, and the tree shows live status.
  - Part 3: "Before we move forward" decision cards and agent-creation approvals.
  - Part 4: the preview card.
