# Approval, Refine and the Showcase: feature spec

This spec defines how work moves through the three areas, how a book gets from Create into Refine, and where finished work lives afterwards. It is written to be handed to an implementer (human or model) and built in phases.

- **Status:** spec from the discussion of Nov 13, 2026. Nothing here is built yet, except the pieces marked *exists*.
- **Related docs:** `canvas-spec.md` (screens), `canvas-concept.md` (the idea), `../AGENTS.md` (how the code is organised and how to land a change).
- **Read first:** `AGENTS.md` rules 3, 4, 6, 7 and 8 and the "Changes that must travel together" table. This spec adds a new IPC group, a new area and a new state, so every row of that table that applies must be followed.

Words used here (on top of the glossary in `AGENTS.md`):
- **Approval:** the user saying "this is good enough to move on". It is not "finished". Refine is where work gets good.
- **Item:** anything that can be approved. In Research it is an interpretation note, in Create a deliverable, in Refine an audited deliverable.
- **Showcase:** the gallery of signed-off work.

---

## 1. The idea in one paragraph

Each area has one goal, and reaching it is an approval by the user. Research's goal is a set of approved interpretation notes. Create's goal is an approved first version of every locked-in deliverable. Refine's goal is a signed-off deliverable. Approved work is the *only* input to the next area, so a half-formed note cannot steer Create and an unreviewed deliverable cannot reach the portfolio. Signed-off work appears in the Showcase, a masonry gallery of everything finished.

```
Research            Create                 Refine               Showcase
note ──approve──▶  (briefs read these)
                    deliverable ──approve──▶ audit ──sign off──▶ tile
                         ▲                     │
                         └──── fixes (a brief back to its seat) ◀┘
```

## 2. One rule across all areas

- **Approval is per item, not per project.** There is no all-or-nothing gate. A book can have a signed-off logo while the website is still in Create.
- **Approval is explicit and reversible.** Only the user approves (an Approve action on the item's window, or choosing it in the Action box). Reopening an item sets it back to *in revision*.
- **Approved is the input to the next area.** Agents in the next area read approved items only.
- **One visual language.** An approved item shows a small "Approved" mark on its window. Each area's tab shows a count ("2 of 4 approved") so progress reads at a glance. Learn it once, it works everywhere. Colour is the Nocturne success tone; amber stays reserved for "waiting on you".

### 2.1 States

| State | Meaning | Who sets it |
| --- | --- | --- |
| `draft` | Exists, not yet approved. The default. | App |
| `approved` | The user is happy for it to move on. | User |
| `revision` | Was approved, reopened or sent back by Refine. Behaves like `draft`, and shows why. | User, or Refine |
| `signed-off` | Refine is done with it. Eligible for the Showcase. | User |

Only the user ever moves an item to `approved` or `signed-off`. Agents may *propose* it (the Orchestrator asks in the Action box with a `Decide:` marker) but never set it. This follows rule 7 of `AGENTS.md`: only the Orchestrator talks to the user.

## 3. Research: approving interpretation notes

*Exists today:* a project has `research.md`, and the interpretation is read as one document.

Change: a project may hold **several interpretation notes**, and each is approved on its own.

- **Where they live:** `projects/<id>/research/*.md`, one file per note. The existing `research.md` is read as the first note, so old projects keep working.
- **Approval state** is a `status:` line in each note's front matter (`draft` | `approved`). No database (rule 6).
- **UI:** each note is a markdown window in the Research board (the existing `DocWindow`), with an Approve button in its header. Approved notes get the mark from section 2.
- **Effect:** when the Orchestrator briefs a Musician, `prompts.ts` includes **approved notes only**. If none are approved, Create shows "Approve at least one note to brief deliverables" on the stage, and `brief_musician` refuses with a message the Orchestrator can act on (same pattern as the lock-in check).
- **Gating Create:** the existing "Research comes first" lock on the Create board (`needsResearch`) now means "no approved note yet", not "no research file".

## 4. Create: approving deliverables

*Exists today:* deliverables are chosen and locked in (`locked:` in `deliverables.md`); finished work appears as previews on the Create board (`previews.ts`).

Change: a locked-in deliverable can be **approved for Refine**.

- **Where it is stored:** `approved:` list in `deliverables.md` front matter, beside `locked:`. Parsing and writing follow `deliverables.ts`.
- **UI:** the deliverable's chat window gets an **Approve for Refine** action in its right-click menu and as a button under its finished-work preview. Approving needs at least one preview, so there is something to refine.
- **The nudge:** when every locked-in deliverable is approved, the Orchestrator asks in the Action box, "Everything is approved. Move to Refine?" with the options *Go to Refine* and *Not yet*. It uses the existing `Decide:` marker. It asks once per transition, not on every message.
- **Reopening:** *Reopen* in the same menu moves the deliverable to `revision` and removes it from Refine's frames and, if it was there, from the Showcase until it is signed off again.

## 5. Refine

*Exists today:* a placeholder card in `App.tsx`.

Refine becomes a real board. This spec fixes its behaviour; the visual design (frames, pins, scorecard) follows `canvas-spec.md` section 9.

### 5.1 Getting in
- The Refine tab is **always visible and always openable**. Forcing people to wait is more annoying than helpful.
- Its hover text shows progress: "2 of 4 deliverables approved".
- With none approved it opens on an explanation of what unlocks it, plus a link back to Create.

### 5.2 What it shows
- One **frame** per approved deliverable, holding its finished-work preview.
- **Audit pins:** numbered marks on the frame, each with a note (what is wrong, where, how severe).
- A **scorecard** window per deliverable summarising the audit.

### 5.3 Who audits
Audits are **Instruments**, so a new check is a new file in `library/instruments/` and needs no code (see "A Musician or Instrument" in `AGENTS.md`). The Orchestrator runs an audit by briefing the deliverable's Musician, which runs the audit Instruments, as for any other job. Open decision: whether to add a dedicated Auditor Musician. The default is no, to keep one chain of command (rule 7).

Candidate checks are the unslop and design-audit skills listed in `Project Files/orchestra-notes.md`.

### 5.4 The loop with Create
- **Fix this pin** sends a brief back to the deliverable's Musician, carrying the pin's note. The deliverable becomes `revision` until the user approves it again.
- When a deliverable has no open pins, or the user accepts what is left, **Sign off** sets it to `signed-off`.
- Sign-off needs a confirmation that lists any open pins, so nothing is signed off by accident.

### 5.5 Storage
- `projects/<id>/audits/<deliverable>.json`: the pins and scorecard (the `audits/` folder already exists in the project layout).
- The approval and sign-off states live in `deliverables.md` (`approved:`, `signed:`).

## 6. The Showcase

A gallery of finished work. It is for *viewing*, not working, which is why it is allowed to scroll.

### 6.1 Two scopes
1. **Per project:** an area after Refine, inside the book. The project's finished set. Build this first.
2. **Studio-wide:** the same gallery across every project, reached from the Studio desk next to Agents and MCPs. This is the real portfolio. It is a view over the same data, built second.

### 6.2 What goes in
Only `signed-off` deliverables. Nothing else can appear.

### 6.3 Layout
- A **masonry grid**: each tile keeps its own aspect ratio, so a logo, a landing page and a poster sit together without being cropped square. Columns follow the window width.
- Tiles use the finished-work thumbnails that `previews.ts` already makes. A deliverable with several previews shows the first and a count.
- The grid **scrolls** like a normal page. This is a deliberate exception to rule 8 ("artboard windows never scroll"), so the Showcase is built as viewport UI, not as a board. It has no pan, no zoom and no dot grid.
- Order is newest-signed-off first. The user can **pin** tiles to the top, and the pinned order is stored in `showcase.json` in the project (or in `studio.json` for the Studio-wide scope).

### 6.4 Opening a tile
A tile opens large, with the title, a one-line description, the project it came from, and actions: open the real thing (the existing preview open), export, and *Reopen in Create*.

### 6.5 Reopening
*Reopen in Create* sets the deliverable to `revision`. It leaves the Showcase until it is signed off again, so everything in the Showcase is finished.

### 6.6 Empty state
"Nothing here yet. Sign off a deliverable in Refine and it appears here." with a link to Refine.

## 7. Data summary

All plain markdown and JSON in the vault (rule 6).

| What | Where | Field |
| --- | --- | --- |
| Interpretation notes | `projects/<id>/research/*.md` | `status: draft \| approved` in front matter |
| Locked in (exists) | `deliverables.md` front matter | `locked: [...]` |
| Approved for Refine | `deliverables.md` front matter | `approved: [...]` |
| Signed off | `deliverables.md` front matter | `signed: [...]` |
| Audit pins and scorecard | `projects/<id>/audits/<deliverable>.json` | pins, notes, score |
| Showcase pins | `projects/<id>/showcase.json` | ordered ids |
| Studio-wide Showcase pins | `studio.json` | ordered `project/deliverable` ids |

## 8. Code touchpoints

Follow "Changes that must travel together" in `AGENTS.md`. Specifically:

- **New IPC** (approve, reopen, sign off, list approved notes, read audits): logic in new modules under `src/main/` (for example `approvals.ts` and `audits.ts`), a short handler in `index.ts`, the method in `preload/index.ts`, and the callers. Validate every id with `projectDir()` (rule 5).
- **`deliverables.ts`:** add `approved` and `signed` beside `locked`. Keep `readLocked`'s approach: a deliverable only keeps a state while it is still chosen.
- **`prompts.ts`:** the Orchestrator learns the approve and sign-off states and the "Move to Refine?" question; Musicians are given approved notes only.
- **`conductor.ts`:** `brief_musician` refuses when no note is approved, with a clear message.
- **A reply marker?** Not needed. The "Move to Refine?" question reuses `Decide:` (parsed in `decide.ts`); the choice *Go to Refine* uses the existing `Go to:` marker (parsed in `goto.ts`).
- **The areas:** adding the Showcase changes `AREAS` in `canvas/shared.ts`, `goto.ts`, `command()` and `area()` in `App.tsx`, and the "Go to" text in `prompts.ts`. Do this in its own branch.
- **New logic gets a test.** State transitions (draft, approved, revision, signed-off) are pure; put them in a pure file and test them in node.

## 9. Build order

Each phase is its own branch and pull request, against `main`.

1. **Approval state.** `approved` for Research notes and Create deliverables: data, IPC, the mark on the windows, and the tab counts. Everything else depends on this.
2. **Research with several notes.** The `research/` folder, per-note approval, and briefs reading approved notes only.
3. **The nudge.** The Orchestrator's "Move to Refine?" and the openable-but-dimmed Refine tab with progress.
4. **Refine board.** Frames, audit Instruments, pins, scorecard, the fix-it loop and sign-off.
5. **Showcase, per project.** Masonry view, tile open, reopen.
6. **Showcase, Studio-wide.** The same view across projects, with pinning.

## 10. Open questions

1. Should the Orchestrator run audits itself, or should there be a dedicated Auditor Musician? Default: Instruments briefed through the deliverable's own Musician.
2. Does a deliverable with several previews approve as one, or per preview? Default: one approval per deliverable.
3. Does the Showcase keep version history (earlier signed-off versions)? Default: no, only the current one. Add later if wanted.
4. Export from the Showcase: single tile, or a whole-portfolio export (for example a static site)? Out of scope here.

---

## 11. Refine v1 (revised Nov 16, 2026)

This section supersedes the "finished-work preview" assumptions in sections 4 and 5. Build this first; sections 3 and 6 (several research notes, the Showcase) wait.

### 11.1 The model
- Finished work is **not a file Orchestra holds**. A deliverable is flagged **Ready for Refine** and points at wherever the work lives: a Figma page or frame, a Blender file, a code folder, a URL.
- **The user sets the flag.** An **Approve for Refine** action on the deliverable's window (right-click menu, and a button on the window). Agents may propose it in the Action box (`Decide:`) but never set it. It needs a work link.
- The flag is the `approved:` list from section 4, shown in the UI as "Ready for Refine". No new state name.
- **The Musician records the work link** as it works (an optional `link` on the existing `report` tool). The user can edit or replace it from the deliverable's window.

### 11.2 Storage
- `projects/<id>/work.json`: deliverable id → `{ kind: 'figma' | 'blender' | 'folder' | 'url' | 'other', ref, note? }`. Plain JSON (rule 6), read and written by one module (`work.ts`) through the Conductor-side path, one writer.
- `deliverables.md`: `approved:` and `signed:` lists beside `locked:`, as in section 7.
- `audits/<deliverable>.json`: `{ score?, findings: [{ id, severity, note, target: { kind, ref }, status: 'open' | 'fixed' | 'dismissed' }] }`.
- A finding's `target` points inside the work (a Figma node id, a Blender object name, a file and line), not at pixel coordinates. Real pins on a canvas are a later step.

### 11.3 Trust boundaries
- Work links come from agents, so `work.ts` validates them like `cleanPreview` does: `https:` URLs open in the user's browser (never in the app), file paths open with the OS file manager, nothing else. Follow rule 5.
- Audit files are written by an Instrument via the Musician, so the findings shape is checked in a pure `cleanAudit` (same pattern as `askProblems`) before it is saved.

### 11.4 The Refine board
- One **work card** per Ready deliverable: its name, the kind of file, an **Open** button, the link (editable), and its audit state.
- A **scorecard** card beside it: the open findings, each with severity, note and target, a **Fix this** button, and Dismiss.
- **Run audit** button. The Orchestrator briefs the deliverable's Musician, which runs the audit Instruments (section 5.3).
- **Sign off** shows the open findings and asks for confirmation, then adds the deliverable to `signed:`.
- With none ready, the board opens on an explanation of what unlocks it, plus a link back to Create (section 5.1).

### 11.5 What can be audited in v1
- **Figma work:** fully. The audit Instrument reads the frames and node ids through the Figma connection that Musicians already have when the user has connected it.
- **Blender and anything else:** flagged, linked and signed off, but not audited by an agent. Agents have no Blender MCP yet (`AGENTS.md`, "planned but not built"). Until the per-agent MCP assignment on the Agents desk exists, these offer **manual findings**: the user adds a note, and Fix this and Sign off work the same.

### 11.6 Build order (each step is its own branch and PR)
1. **Pure core.** `work.ts` and `audits.ts` (link cleaning, finding shape, `cleanAudit`, state transitions), with node tests. No UI.
2. **Storage and IPC.** `work.json` and audit read/write, `approved:` and `signed:` in `deliverables.ts`, handlers in `index.ts`, methods in `preload/index.ts`.
3. **Flag it.** Approve for Refine and Reopen on the deliverable window, the work link field, the `link` on `report`, and the tab count ("2 of 4 ready").
4. **The Refine board.** Replace the placeholder in `App.tsx` with work cards and scorecards from stored data, plus manual findings.
5. **Run audit.** One audit Instrument (unslop) in `library/instruments/`, the Orchestrator briefing, and `prompts.ts` changes.
6. **Fix this and Sign off.** The brief back to the Musician, the `revision` state, and the confirmation.

### 11.7 Not in v1
The Showcase, several research notes, the "Move to Refine?" nudge, image pins, score history, and agent audits of Blender work.
