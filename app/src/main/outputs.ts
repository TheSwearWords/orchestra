import { readdir, stat } from 'fs/promises'
import { join, relative, resolve, sep } from 'path'

// What a project has produced so far, for Create's "Created files": the foundations in prereqs/,
// final files in exports/, and the research and deliverables write-ups.

export interface Output {
  path: string // relative to the project, with forward slashes
  size: number
  modified: string // ISO time
}

const TOP_FILES = ['research.md', 'deliverables.md']
const FOLDERS = ['prereqs', 'exports']

async function walk(root: string, dir: string, depth: number): Promise<Output[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const found = await Promise.all(
    entries
      .filter((e) => !e.name.startsWith('.'))
      .map(async (e): Promise<Output[]> => {
        const full = join(dir, e.name)
        if (e.isDirectory()) return depth > 0 ? walk(root, full, depth - 1) : []
        const s = await stat(full)
        return [
          {
            path: relative(root, full).split(sep).join('/'),
            size: s.size,
            modified: s.mtime.toISOString()
          }
        ]
      })
  )
  return found.flat()
}

export async function listOutputs(project: string): Promise<Output[]> {
  const top = await Promise.all(
    TOP_FILES.map(async (f) => {
      const s = await stat(join(project, f)).catch(() => null)
      return s ? [{ path: f, size: s.size, modified: s.mtime.toISOString() }] : []
    })
  )
  const nested = await Promise.all(FOLDERS.map((f) => walk(project, join(project, f), 2)))
  return [...top.flat(), ...nested.flat()].sort((a, b) => b.modified.localeCompare(a.modified))
}

/** Absolute path of a file inside the project, refusing anything that climbs out of it. */
export function outputPath(project: string, rel: string): string {
  const full = resolve(project, rel)
  if (full !== project && !full.startsWith(resolve(project) + sep)) throw new Error('Bad path.')
  return full
}
