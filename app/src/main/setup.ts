// First-time setup: who you are and what Orchestra is plugged into, kept in <home>/setup.json.
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { PROVIDERS } from './providers.ts'

export interface Setup {
  done: boolean
  name: string
  providers: string[] // provider ids wired in
  tools: string[] // apps the user designs in
  workspace: string // the folder everything lives in
  memory: boolean // keep the Obsidian vault as memory
  github: boolean
}

export const EMPTY: Setup = {
  done: false,
  name: '',
  providers: [],
  tools: [],
  workspace: '',
  memory: false,
  github: false
}

/** Keeps only well-formed fields from whatever the renderer sent. */
export function cleanSetup(v: unknown): Setup {
  const o = (v ?? {}) as Record<string, unknown>
  const strings = (a: unknown, ok: (s: string) => boolean): string[] =>
    Array.isArray(a) ? [...new Set(a.map(String).filter(ok))] : []
  return {
    done: o.done === true,
    name: typeof o.name === 'string' ? o.name.trim().slice(0, 80) : '',
    providers: strings(o.providers, (s) => PROVIDERS.some((p) => p.id === s)),
    tools: strings(o.tools, (s) => /^[\w-]{1,40}$/.test(s)),
    workspace: typeof o.workspace === 'string' ? o.workspace.slice(0, 1000) : '',
    memory: o.memory === true,
    github: o.github === true
  }
}

export async function readSetup(home: string): Promise<Setup> {
  try {
    return cleanSetup(JSON.parse(await readFile(join(home, 'setup.json'), 'utf8')))
  } catch {
    return EMPTY // none yet: first launch
  }
}

export async function saveSetup(home: string, v: unknown): Promise<Setup> {
  const s = cleanSetup(v)
  await writeFile(join(home, 'setup.json'), JSON.stringify(s, null, 2) + '\n')
  return s
}
