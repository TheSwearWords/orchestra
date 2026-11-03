import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { provider, PROVIDERS } from './providers.ts'

// The agent library (ORCHESTRA_HOME/library): plain markdown the user, the Orchestrator and
// Musicians all edit. orchestrator.md, musicians/<id>.md (one per deliverable) and
// instruments/<id>.md. Front matter holds the fields; the body is the agent's prompt.

export interface AgentDoc {
  id: string
  name: string
  prompt: string
  tools: string[]
  model: string // opus | sonnet | haiku; defaults by tier: Orchestrator opus, Musician sonnet, Instrument haiku
  provider: string // anthropic (default) | openai | gemini
  description: string // the Orchestrator's one line; Musicians use deliverable, Instruments job
  source: string // mine | starter | orchestrator | <musician id>
}

export interface Musician extends AgentDoc {
  deliverable: string
  icon: string // a Remix icon name bundled in the app; unknown names fall back to a generic one
  category: string
  keywords: string[]
  prerequisites: string[] // foundation Instruments, built once per project and shared
  instruments: string[] // this Musician's own crew, in run order
}

export interface Instrument extends AgentDoc {
  job: string
  output: string
  needs: string[] // Instruments whose output must exist first
}

export interface Library {
  orchestrator: AgentDoc | null
  musicians: Musician[]
  instruments: Instrument[]
}

type Fields = Record<string, string | string[]>

/** Front matter with `key: value` and `key: [a, b]` lines, then the body. */
export function parseDoc(md: string): { fields: Fields; body: string } | null {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md)
  if (!m) return null
  const fields: Fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (!kv) continue
    const list = /^\[(.*)\]$/.exec(kv[2].trim())
    fields[kv[1]] = list
      ? list[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : kv[2].trim()
  }
  return { fields, body: m[2].trim() }
}

const str = (f: Fields, k: string): string => (typeof f[k] === 'string' ? (f[k] as string) : '')
const list = (f: Fields, k: string): string[] => (Array.isArray(f[k]) ? (f[k] as string[]) : [])

function agent(id: string, f: Fields, body: string, tierModel: string): AgentDoc {
  const p = provider(str(f, 'provider')) ?? PROVIDERS[0]
  return {
    id,
    name: str(f, 'name') || id,
    prompt: body,
    tools: list(f, 'tools'),
    // the tier default is an Anthropic model; other providers default to their middle model
    model: str(f, 'model') || (p.id === 'anthropic' ? tierModel : p.models[1].id),
    provider: p.id,
    description: str(f, 'description'),
    source: str(f, 'source')
  }
}

async function readFolder(dir: string): Promise<{ id: string; fields: Fields; body: string }[]> {
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.md'))
  const docs = await Promise.all(
    names.map(async (n) => ({
      id: n.slice(0, -3),
      doc: parseDoc(await readFile(join(dir, n), 'utf8'))
    }))
  )
  return docs.flatMap(({ id, doc }) => (doc ? [{ id, ...doc }] : []))
}

export async function loadLibrary(home: string): Promise<Library> {
  const dir = join(home, 'library')
  const orch = await readFile(join(dir, 'orchestrator.md'), 'utf8').then(parseDoc, () => null)
  const musicians = (await readFolder(join(dir, 'musicians'))).map(({ id, fields, body }) => ({
    ...agent(id, fields, body, 'sonnet'),
    deliverable: str(fields, 'deliverable'),
    icon: str(fields, 'icon'),
    category: str(fields, 'category') || 'Other',
    keywords: list(fields, 'keywords'),
    prerequisites: list(fields, 'prerequisites'),
    instruments: list(fields, 'instruments')
  }))
  const instruments = (await readFolder(join(dir, 'instruments'))).map(({ id, fields, body }) => ({
    ...agent(id, fields, body, 'haiku'),
    job: str(fields, 'job'),
    output: str(fields, 'output'),
    needs: list(fields, 'needs')
  }))
  return {
    orchestrator: orch ? agent('orchestrator', orch.fields, orch.body, 'opus') : null,
    musicians,
    instruments
  }
}

/** Problems that would stop a build: missing Instruments and circular `needs`. */
export function checkLibrary(lib: Library): string[] {
  const known = new Map(lib.instruments.map((i) => [i.id, i]))
  const problems: string[] = []
  if (!lib.orchestrator) problems.push('library/orchestrator.md is missing.')
  for (const m of lib.musicians)
    for (const id of [...m.prerequisites, ...m.instruments])
      if (!known.has(id)) problems.push(`${m.name} uses an Instrument that doesn't exist: ${id}`)
  for (const i of lib.instruments)
    for (const id of i.needs)
      if (!known.has(id)) problems.push(`${i.name} needs an Instrument that doesn't exist: ${id}`)

  const done = new Set<string>()
  const visit = (id: string, path: string[]): void => {
    if (path.includes(id)) {
      problems.push(`Circular needs: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`)
      return
    }
    if (done.has(id)) return
    for (const next of known.get(id)?.needs ?? []) visit(next, [...path, id])
    done.add(id)
  }
  for (const i of lib.instruments) visit(i.id, [])
  return problems
}

export type Role = 'orchestrator' | 'musician' | 'instrument'

/** An agent's file in the library. Ids come from the renderer, so only plain slugs are allowed. */
export function agentFile(home: string, role: Role, id: string): string {
  if (role === 'orchestrator') return join(home, 'library', 'orchestrator.md')
  if (!/^[\w-]+$/.test(id)) throw new Error(`Not an agent id: ${id}`)
  return join(home, 'library', role === 'musician' ? 'musicians' : 'instruments', `${id}.md`)
}

/** Sets one front-matter field, adding the line if it's missing; the rest of the file is untouched. */
export function setField(md: string, key: string, value: string | string[]): string {
  const doc = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---)/.exec(md)
  if (!doc) throw new Error('The file has no front matter.')
  const line = `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`
  const lines = doc[2].split(/\r?\n/)
  const at = lines.findIndex((l) => l.startsWith(`${key}:`))
  if (at >= 0) lines[at] = line
  else lines.push(line)
  return doc[1] + lines.join('\n') + md.slice(doc[1].length + doc[2].length)
}

export type EditKey = 'name' | 'description' | 'runsOn'

/** One edit from the Agents screen, checked, applied to an agent file's front matter. The
 * description lives in a role's own field; runsOn is "<provider>/<model>", set together. */
export function editAgent(md: string, role: Role, key: EditKey, value: string): string {
  const v = String(value).replace(/\s+/g, ' ').trim()
  switch (key) {
    case 'name':
      if (!v || v.length > 60) throw new Error('Give it a name of 1 to 60 characters.')
      return setField(md, 'name', v)
    case 'description':
      if (v.length > 300) throw new Error('Keep the description to one line, under 300 characters.')
      return setField(
        md,
        role === 'musician' ? 'deliverable' : role === 'instrument' ? 'job' : 'description',
        v
      )
    case 'runsOn': {
      const [pid, model] = v.split('/')
      const p = provider(pid)
      if (!p) throw new Error(`Orchestra supports ${PROVIDERS.map((x) => x.name).join(', ')}.`)
      if (!p.models.some((m) => m.id === model))
        throw new Error(`${model} isn't one of ${p.name}'s models.`)
      return setField(setField(md, 'provider', p.id), 'model', model)
    }
  }
  throw new Error(`Can't edit ${key}.`)
}

/** A new, blank Instrument in a Musician's crew, from the library's template, ready to be
 * named and described on the Agents screen. Returns its id. */
export async function newInstrument(home: string, musician: string): Promise<string> {
  const crewFile = agentFile(home, 'musician', musician)
  const md = await readFile(crewFile, 'utf8') // the Musician must exist
  const taken = new Set(
    (await readdir(join(home, 'library', 'instruments')).catch(() => [] as string[])).map((n) =>
      n.replace(/\.md$/, '')
    )
  )
  let id = 'new-instrument'
  for (let n = 2; taken.has(id); n++) id = `new-instrument-${n}`
  const template = await readFile(
    join(home, 'library', 'templates', 'instrument-template.md'),
    'utf8'
  )
    .then((t) => parseDoc(t)?.body ?? '')
    .catch(() => '')
  const body = (template || 'You are the <Job> Instrument. You do one job: <job>.')
    .replace(/<Job>/g, 'New')
    .replace(/<job>/g, 'describe it on the Agents screen')
  const file = [
    '---',
    'name: New Instrument',
    'job: ',
    `output: prereqs/${id}.md`,
    'needs: []',
    'model: haiku',
    'provider: anthropic',
    'tools: []',
    `source: ${musician}`,
    '---',
    '',
    body,
    ''
  ].join('\n')
  await writeFile(agentFile(home, 'instrument', id), file, { flag: 'wx' })
  const crew = parseDoc(md)?.fields.instruments
  await writeFile(crewFile, setField(md, 'instruments', [...(Array.isArray(crew) ? crew : []), id]))
  return id
}
