// A book's cover settings (<project>/cover.json). Anything unset is generated from the project id.
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises'
import { extname, join } from 'path'

export interface Cover {
  color?: 'blue' | 'ink' | 'white'
  art?: string // a built-in artwork
  image?: string // an uploaded one, in the project's cover/ folder; wins over art
}

const COLORS = ['blue', 'ink', 'white']
const ART = ['apollo', 'violin', 'hand', 'concert']
const IMAGE = /^cover\/[\w.-]+\.(png|jpe?g|gif|webp|svg)$/i
export const COVER_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']

/** Keeps only well-formed settings from whatever the renderer sent. */
export function cleanCover(v: unknown): Cover {
  const o = (v ?? {}) as Record<string, unknown>
  return {
    ...(COLORS.includes(o.color as string) ? { color: o.color as Cover['color'] } : {}),
    ...(ART.includes(o.art as string) ? { art: o.art as string } : {}),
    ...(typeof o.image === 'string' && IMAGE.test(o.image) ? { image: o.image } : {})
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

/** Copies an image into the project under a new name, so the cover never shows a stale one. */
export async function addCoverImage(dir: string, source: string): Promise<string> {
  const ext = extname(source).toLowerCase()
  if (!COVER_TYPES.includes(ext.slice(1))) throw new Error('Covers can be images only.')
  await mkdir(join(dir, 'cover'), { recursive: true })
  const name = `cover/art-${Date.now().toString(36)}${ext}`
  await copyFile(source, join(dir, name))
  return name
}
