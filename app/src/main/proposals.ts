import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Library } from './library.ts'

// New agents proposed during a conversation. The Orchestrator proposes Musicians; a Musician
// proposes Instruments for itself. Nothing reaches the library until the user approves the
// card in the chat. Proposals are kept per project in .orchestra/proposals.json.

export type ProposalKind = 'musician' | 'instrument'
export type ProposalStatus = 'pending' | 'approved' | 'declined'

export interface MusicianDraft {
  id: string
  name: string
  deliverable: string
  category: string
  icon?: string
  keywords?: string[]
  prerequisites?: string[]
  instruments?: string[]
  model?: string
  prompt: string
}

export interface InstrumentDraft {
  id: string
  name: string
  job: string
  output: string
  needs?: string[]
  model?: string
  prompt: string
}

export interface Proposal {
  id: string // "<kind>:<agent id>"
  kind: ProposalKind
  from: string // 'orchestrator', or the proposing Musician's id
  chat: string
  status: ProposalStatus
  t: string
  draft: MusicianDraft | InstrumentDraft
}

const ID = /^[a-z0-9][a-z0-9-]{0,47}$/
const MODELS = ['opus', 'sonnet', 'haiku']

/** Everything wrong with a draft, so the proposing agent can fix it in one go. Drafts come
 * from a model, so this is the trust boundary before anything is written to the library. */
export function draftProblems(
  kind: ProposalKind,
  d: MusicianDraft | InstrumentDraft,
  lib: Pick<Library, 'musicians' | 'instruments'>
): string[] {
  const p: string[] = []
  const known = new Set(lib.instruments.map((i) => i.id))
  const taken = kind === 'musician' ? lib.musicians : lib.instruments
  if (!ID.test(d.id ?? ''))
    p.push('id must be lowercase letters, digits and dashes, e.g. "trailer-cut".')
  else if (taken.some((x) => x.id === d.id))
    p.push(`A ${kind} called ${d.id} already exists; use it instead.`)
  if (!d.name?.trim()) p.push('name is required.')
  if ((d.prompt ?? '').trim().length < 80)
    p.push('prompt is required: the agent’s full instructions, written from the template.')
  if (d.model && !MODELS.includes(d.model)) p.push(`model must be one of ${MODELS.join(', ')}.`)
  const unknown = (ids: string[] = []): string[] => ids.filter((id) => !known.has(id))
  if (kind === 'musician') {
    const m = d as MusicianDraft
    if (!m.deliverable?.trim()) p.push('deliverable is required: what it owns, in one line.')
    if (!m.category?.trim()) p.push('category is required.')
    const missing = unknown([...(m.prerequisites ?? []), ...(m.instruments ?? [])])
    if (missing.length)
      p.push(
        `These Instruments don’t exist: ${missing.join(', ')}. List only existing ones; once the Musician is approved, it proposes its own new Instruments.`
      )
  } else {
    const i = d as InstrumentDraft
    if (!i.job?.trim()) p.push('job is required: one sentence.')
    if (!i.output?.trim() || /(^|[\\/])\.\.([\\/]|$)|^[\\/]|^[a-z]:/i.test(i.output))
      p.push('output is required: a path inside the project, e.g. prereqs/shot-list.md.')
    const missing = unknown(i.needs)
    if (missing.length) p.push(`needs lists Instruments that don’t exist: ${missing.join(', ')}.`)
    if (i.needs?.includes(i.id)) p.push('An Instrument can’t need itself.')
  }
  return p
}

const line = (s: string): string => s.replace(/\s+/g, ' ').trim()
const list = (xs: string[] = []): string => `[${xs.map(line).join(', ')}]`

/** The library file for an approved draft, in the template's format. */
export function toMarkdown(
  kind: ProposalKind,
  d: MusicianDraft | InstrumentDraft,
  source: string
): string {
  const fields =
    kind === 'musician'
      ? [
          `name: ${line(d.name)}`,
          `deliverable: ${line((d as MusicianDraft).deliverable)}`,
          `icon: ${line((d as MusicianDraft).icon || 'shapes-line')}`,
          `category: ${line((d as MusicianDraft).category)}`,
          `keywords: ${list((d as MusicianDraft).keywords)}`,
          `prerequisites: ${list((d as MusicianDraft).prerequisites)}`,
          `instruments: ${list((d as MusicianDraft).instruments)}`
        ]
      : [
          `name: ${line(d.name)}`,
          `job: ${line((d as InstrumentDraft).job)}`,
          `output: ${line((d as InstrumentDraft).output)}`,
          `needs: ${list((d as InstrumentDraft).needs)}`
        ]
  if (d.model) fields.push(`model: ${d.model}`)
  fields.push('tools: []', `source: ${source}`)
  return ['---', ...fields, '---', '', d.prompt.trim(), ''].join('\n')
}

const file = (projectDir: string): string => join(projectDir, '.orchestra', 'proposals.json')

export async function readProposals(projectDir: string): Promise<Record<string, Proposal>> {
  return readFile(file(projectDir), 'utf8')
    .then((t) => JSON.parse(t) as Record<string, Proposal>)
    .catch(() => ({}))
}

export async function saveProposal(projectDir: string, p: Proposal): Promise<void> {
  const all = await readProposals(projectDir)
  all[p.id] = p
  await mkdir(join(projectDir, '.orchestra'), { recursive: true })
  await writeFile(file(projectDir), JSON.stringify(all, null, 2))
}

/** Writes an approved draft into the library. A new Instrument is also added to its Musician's
 * crew. Never overwrites: if the file appeared meanwhile, it throws. */
export async function adopt(home: string, p: Proposal): Promise<void> {
  const lib = join(home, 'library')
  if (p.kind === 'musician') {
    await writeFile(
      join(lib, 'musicians', `${p.draft.id}.md`),
      toMarkdown('musician', p.draft, 'orchestrator'),
      { flag: 'wx' }
    )
    return
  }
  const crewFile = join(lib, 'musicians', `${p.from}.md`)
  const md = await readFile(crewFile, 'utf8') // its Musician must still exist
  await writeFile(
    join(lib, 'instruments', `${p.draft.id}.md`),
    toMarkdown('instrument', p.draft, p.from),
    { flag: 'wx' }
  )
  await writeFile(crewFile, addToCrew(md, p.draft.id))
}

/** Adds an Instrument id to the `instruments: [...]` line of a Musician's front matter. */
export function addToCrew(md: string, id: string): string {
  const end = md.indexOf('\n---', 3)
  const head = md.slice(0, end)
  const m = /^instruments:\s*\[(.*)\]\s*$/m.exec(head)
  if (!m) return md.slice(0, end) + `\ninstruments: [${id}]` + md.slice(end)
  const ids = m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.includes(id)) return md
  return (
    md.slice(0, m.index) +
    `instruments: [${[...ids, id].join(', ')}]` +
    md.slice(m.index + m[0].length)
  )
}
