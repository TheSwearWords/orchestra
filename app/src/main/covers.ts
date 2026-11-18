// A book's cover settings (<project>/cover.json). Anything unset is generated from the project id.
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export interface Cover {
  landscape?: string // one of the backdrops in LANDSCAPES; unset means picked from the id
}

// the names of the plates in renderer/src/assets/landscapes
const LANDSCAPES = ['sunset', 'alpine', 'desert', 'hills', 'coast']

/** Keeps only well-formed settings from whatever the renderer sent. */
export function cleanCover(v: unknown): Cover {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    ...(LANDSCAPES.includes(o.landscape as string) ? { landscape: o.landscape as string } : {})
  }
}

const file = (dir: string): string => join(dir, 'cover.json')

export const readCover = (dir: string): Promise<Cover> =>
  readFile(file(dir), 'utf8').then(
    (t) => cleanCover(JSON.parse(t)),
    () => ({})
  )

export async function saveCover(dir: string, v: unknown): Promise<Cover> {
  const cover = cleanCover(v)
  await writeFile(file(dir), JSON.stringify(cover, null, 2))
  return cover
}
