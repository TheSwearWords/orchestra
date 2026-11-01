import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

// The agent library (ORCHESTRA_HOME/library): plain markdown the user, the Orchestrator and
// Musicians all edit. orchestrator.md, musicians/<id>.md (one per deliverable) and
// instruments/<id>.md. Front matter holds the fields; the body is the agent's prompt.

export interface AgentDoc {
  id: string
  name: string
  prompt: string
  tools: string[]
  source: string // mine | starter | orchestrator | <musician id>
}

export interface Musician extends AgentDoc {
  deliverable: string
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
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md)
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

function agent(id: string, f: Fields, body: string): AgentDoc {
  return { id, name: str(f, 'name') || id, prompt: body, tools: list(f, 'tools'), source: str(f, 'source') }
}

async function readFolder(dir: string): Promise<{ id: string; fields: Fields; body: string }[]> {
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.md'))
  const docs = await Promise.all(
    names.map(async (n) => ({ id: n.slice(0, -3), doc: parseDoc(await readFile(join(dir, n), 'utf8')) }))
  )
  return docs.flatMap(({ id, doc }) => (doc ? [{ id, ...doc }] : []))
}

export async function loadLibrary(home: string): Promise<Library> {
  const dir = join(home, 'library')
  const orch = await readFile(join(dir, 'orchestrator.md'), 'utf8').then(parseDoc, () => null)
  const musicians = (await readFolder(join(dir, 'musicians'))).map(({ id, fields, body }) => ({
    ...agent(id, fields, body),
    deliverable: str(fields, 'deliverable'),
    category: str(fields, 'category') || 'Other',
    keywords: list(fields, 'keywords'),
    prerequisites: list(fields, 'prerequisites'),
    instruments: list(fields, 'instruments')
  }))
  const instruments = (await readFolder(join(dir, 'instruments'))).map(({ id, fields, body }) => ({
    ...agent(id, fields, body),
    job: str(fields, 'job'),
    output: str(fields, 'output'),
    needs: list(fields, 'needs')
  }))
  return {
    orchestrator: orch ? agent('orchestrator', orch.fields, orch.body) : null,
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
