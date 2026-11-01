import { readFile } from 'fs/promises'
import { join } from 'path'
import { GENERAL, handoffFile, parseAgent } from './conductor'
import { readSelection } from './deliverables'
import { loadLibrary } from './library'
import { foundationOrder } from './plan'
import { listProjects } from './projects'

// The instructions each agent's session starts with: its library prompt, the house rules, and
// Orchestra's part (where it is, who it answers to, the tools it has).

const NO_EXTERNAL_TOOLS =
  'Figma, Blender and Fusion are not connected to agents yet in this version of Orchestra: work in files (markdown specs, copy, plans, tokens). If a step needs one of those tools, say so plainly instead of pretending.'

async function context(
  home: string,
  projectsDir: string,
  id: string
): Promise<{
  dir: string
  lib: Awaited<ReturnType<typeof loadLibrary>>
  rules: string
  selected: string[]
  name: string
}> {
  const dir = join(projectsDir, id)
  const [lib, rules, projects, selected] = await Promise.all([
    loadLibrary(home),
    readFile(join(home, 'library', 'house-rules.md'), 'utf8').catch(() => ''),
    listProjects(projectsDir),
    readSelection(dir)
  ])
  return { dir, lib, rules, selected, name: projects.find((p) => p.id === id)?.name ?? id }
}

export async function orchestratorPrompt(
  home: string,
  projectsDir: string,
  id: string,
  chat: string
): Promise<string> {
  const { dir, lib, rules, selected, name } = await context(home, projectsDir, id)
  const handoff = await readFile(join(dir, handoffFile(chat)), 'utf8').catch(() => '')
  const catalogue = lib.musicians.map((m) => `- ${m.id}: ${m.name}. ${m.deliverable}`).join('\n')
  const focus = lib.musicians.find((m) => m.id === chat)
  const needs = focus
    ? foundationOrder(lib.musicians, lib.instruments, [focus.id]).map((f) => f.name)
    : []
  const thisChat =
    chat === GENERAL
      ? `## This chat: General
This is the project's General chat: the whole project, its overall plan, and adding deliverables. Each chosen deliverable also has its own chat in Orchestra, where its detailed work happens; when the user goes deep on one deliverable, suggest continuing in that deliverable's chat.`
      : focus
        ? `## This chat: ${focus.name}
This chat is only about the ${focus.name} deliverable (id ${focus.id}): ${focus.deliverable} Its Musician is defined in ${join(home, 'library', 'musicians', `${focus.id}.md`)}. Shared foundations it needs first: ${needs.join(', ') || 'none'}. In this chat, brief only the ${focus.name} Musician. If the user brings up another deliverable, say it belongs in that deliverable's chat (or in the General chat if it isn't chosen yet).`
        : ''
  return [
    lib.orchestrator?.prompt ?? '',
    rules,
    thisChat,
    `## This project
You are working in the project "${name}"; your current directory is its folder. Read concept.md, research.md and deliverables.md before planning, and read deliverables.md again whenever the plan matters: the user can change it at any time. The agent library (Musicians and Instruments, as markdown) is at ${join(home, 'library')}.

Deliverables chosen so far: ${selected.length ? selected.join(', ') : 'none yet'}.

## The conversation is open-ended
The user may start with no deliverables, add more at any point, or just think out loud with you. When they want something that one of the library's deliverables covers and it isn't chosen yet, say so, and end your reply with exactly one line of this form (ids from the list below, comma-separated):
Suggest deliverables: website, slide-deck
Orchestra turns that line into an "Add to deliverables" button; nothing is added until the user clicks it. If nothing in the library fits, say so and describe the Musician you would propose instead.

Library deliverables (id: name):
${catalogue}

## Working with your Musicians
Once you and the user agree what to do, brief the deliverable's Musician with the brief_musician tool: the goal, the files to read, constraints, the output and where it goes, and what "done" means. Musicians run their own Instruments and report back to you; a report arrives as a message starting "[Report from the … Musician]". When one arrives, tell the user in a sentence or two what was made and what, if anything, needs their decision, then wait for them. Brief the Musician again only when there is something to change or decide. Never claim work that hasn't been reported. You can still read and write small things in the project yourself.
${NO_EXTERNAL_TOOLS}`,
    handoff &&
      `## Your handoff note from the previous session (${handoffFile(chat)})
You wrote this before your last session ended. Continue from it.

${handoff}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function agentPrompt(
  home: string,
  projectsDir: string,
  id: string,
  key: string
): Promise<string> {
  const { lib, rules, name } = await context(home, projectsDir, id)
  const { musician, instrument } = parseAgent(key)
  const m = lib.musicians.find((x) => x.id === musician)
  if (!m) throw new Error(`No Musician called ${musician}.`)
  const where = `Your current directory is the project "${name}": concept.md, research.md and deliverables.md describe it, references/ holds the user's references, and prereqs/ holds the shared foundations other agents have made.`

  if (!instrument) {
    const runnable = new Set([
      ...foundationOrder(lib.musicians, lib.instruments, [m.id]).map((i) => i.id),
      ...m.instruments
    ])
    const list = lib.instruments
      .filter((i) => runnable.has(i.id))
      .map((i) => `- ${i.id}: ${i.name}. ${i.job} Output: ${i.output}`)
      .join('\n')
    return [
      m.prompt,
      rules,
      `## How you work in Orchestra
You are the ${m.name} Musician. ${where}
- The Orchestrator briefs you; briefs arrive as messages starting "[Brief from the Orchestrator]".
- Run your Instruments with the run_instrument tool, one job each, with a clear brief: the inputs, the output file and what "done" means. Their reports come back to you as messages starting "[Report from the … Instrument]". Run them one or two at a time.
- Shared foundations live in prereqs/. Check what already exists before running an Instrument for one; never redo a foundation that is already there unless you were asked to.
- Review each Instrument's output before going on.
- Use the report tool to tell the Orchestrator where things stand after each meaningful step, and whenever the user needs to decide something (give the options and your recommendation). Set done only when the whole deliverable is finished. You never talk to the user.
- ${NO_EXTERNAL_TOOLS}

Instruments you can run:
${list}`
    ]
      .filter(Boolean)
      .join('\n\n')
  }

  const inst = lib.instruments.find((x) => x.id === instrument)
  if (!inst) throw new Error(`No Instrument called ${instrument}.`)
  const needs = lib.instruments.filter((i) => inst.needs.includes(i.id)).map((i) => i.output)
  return [
    inst.prompt,
    rules,
    `## How you work in Orchestra
You are the ${inst.name} Instrument, working for the ${m.name} Musician. ${where}
- Your Musician's brief arrives as a message starting "[Brief from your Musician]".
- Do your one job. Write the output where the brief says; by default that is: ${inst.output}.${needs.length ? `\n- Read these first if they exist: ${needs.join('; ')}.` : ''}
- Then end your turn with a short report: what you made, where it is, and anything unclear or missing. That closing message goes to your Musician automatically. You never talk to the user or the Orchestrator.
- ${NO_EXTERNAL_TOOLS}`
  ]
    .filter(Boolean)
    .join('\n\n')
}
