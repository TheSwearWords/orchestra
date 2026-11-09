// Where finished work lives, so a window on the board can show it and take you there: a Figma
// page, a site, a localhost address with the command that serves it. Agents record these with
// set_preview; the model's input stops at cleanPreview. Kept in .orchestra/previews.json.
import { spawn, type ChildProcess } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { connect } from 'net'
import { join, resolve, sep } from 'path'

export interface Preview {
  label: string
  url: string
  image?: string // project-relative path of its thumbnail
  dev?: string // what serves a localhost address, e.g. "npm run dev"
  dir?: string // where to run it, relative to the project
}
export type Previews = Record<string, Preview[]> // by deliverable (Musician id)

export interface PreviewInput {
  label: string
  url: string
  image_url?: string
  dev?: string
  dir?: string
}

const DEV = /^(npm run|pnpm|yarn) [\w:-]+$/
const MAX_IMAGE = 8 * 1024 * 1024
const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
}
const file = (dir: string): string => join(dir, '.orchestra', 'previews.json')
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'preview'

export const isLocal = (url: string): boolean =>
  ['localhost', '127.0.0.1'].includes(new URL(url).hostname)

/** Checks what an agent sent, in words it can fix. */
export function cleanPreview(p: PreviewInput): Preview {
  const label = String(p.label ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  if (!label) throw new Error('Give the preview a label.')
  let url: URL
  try {
    url = new URL(p.url)
  } catch {
    throw new Error('url must be a full address.')
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal(url.href)))
    throw new Error('url must be https, or http on localhost.')
  if (p.dev && !isLocal(url.href)) throw new Error('dev is only for localhost addresses.')
  if (p.dev && !DEV.test(p.dev)) throw new Error('dev must look like "npm run dev".')
  if (p.dir && (p.dir.includes('..') || /^([a-z]:|[\\/])/i.test(p.dir)))
    throw new Error('dir must be a folder inside the project.')
  return {
    label,
    url: url.href,
    ...(p.dev ? { dev: p.dev } : {}),
    ...(p.dir ? { dir: p.dir } : {})
  }
}

export const readPreviews = (dir: string): Promise<Previews> =>
  readFile(file(dir), 'utf8').then(
    (t) => JSON.parse(t) as Previews,
    () => ({})
  )

async function write(dir: string, all: Previews): Promise<void> {
  await mkdir(join(dir, '.orchestra'), { recursive: true })
  await writeFile(file(dir), JSON.stringify(all, null, 2))
}

const imagePath = (deliverable: string, label: string, ext: string): string =>
  `.orchestra/previews/${slug(deliverable)}-${slug(label)}-${Date.now().toString(36)}.${ext}`

/** Screenshot addresses expire quickly, so the picture is saved as soon as it's recorded. */
async function download(
  dir: string,
  deliverable: string,
  label: string,
  url: string
): Promise<string> {
  if (!url.startsWith('https://')) throw new Error('image_url must be https.')
  const res = await fetch(url).catch(() => null)
  if (!res?.ok) throw new Error('Could not download image_url. It may have expired.')
  const ext = TYPES[(res.headers.get('content-type') ?? '').split(';')[0]]
  if (!ext) throw new Error('image_url must be a png, jpeg or webp.')
  const data = Buffer.from(await res.arrayBuffer())
  if (data.length > MAX_IMAGE) throw new Error('image_url is over 8 MB.')
  const rel = imagePath(deliverable, label, ext)
  await mkdir(join(dir, '.orchestra', 'previews'), { recursive: true })
  await writeFile(join(dir, rel), data)
  return rel
}

/** Adds a preview, or replaces the one with this label. */
export async function savePreview(
  dir: string,
  deliverable: string,
  input: PreviewInput
): Promise<Preview> {
  const p = cleanPreview(input)
  const image = input.image_url
    ? await download(dir, deliverable, p.label, input.image_url)
    : undefined
  const all = await readPreviews(dir)
  const old = (all[deliverable] ?? []).find((x) => x.label === p.label)
  const saved = { ...p, ...(image ? { image } : old?.image ? { image: old.image } : {}) }
  all[deliverable] = [...(all[deliverable] ?? []).filter((x) => x.label !== p.label), saved]
  await write(dir, all)
  return saved
}

/** Saves a thumbnail the app captured itself. Returns where it went. */
export async function saveThumbnail(
  dir: string,
  deliverable: string,
  label: string,
  png: Buffer
): Promise<void> {
  const all = await readPreviews(dir)
  const p = (all[deliverable] ?? []).find((x) => x.label === label)
  if (!p) return
  const rel = imagePath(deliverable, label, 'png')
  await mkdir(join(dir, '.orchestra', 'previews'), { recursive: true })
  await writeFile(join(dir, rel), png)
  p.image = rel
  await write(dir, all)
}

/** Whether something is listening at a localhost address. */
export function isUp(url: string): Promise<boolean> {
  const { hostname, port } = new URL(url)
  return new Promise((done) => {
    const s = connect({ host: hostname, port: Number(port) || 80, timeout: 800 })
    const end = (v: boolean): void => {
      s.destroy()
      done(v)
    }
    s.once('connect', () => end(true))
    s.once('error', () => end(false))
    s.once('timeout', () => end(false))
  })
}

const servers = new Map<string, ChildProcess>()

/** Starts a preview's dev server if it's down, and waits for it to answer. */
export async function ensureServer(dir: string, p: Preview): Promise<void> {
  if (await isUp(p.url)) return
  if (!p.dev || !DEV.test(p.dev)) throw new Error(`Nothing is running at ${p.url}.`)
  const cwd = resolve(dir, p.dir ?? '.')
  if (cwd !== resolve(dir) && !cwd.startsWith(resolve(dir) + sep)) throw new Error('Bad folder.')
  // the command was checked against DEV above; a shell is how npm starts on Windows
  servers.set(p.url, spawn(p.dev, { cwd, shell: true, stdio: 'ignore' }))
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await isUp(p.url)) return
  }
  throw new Error(`${p.dev} started, but ${p.url} didn't answer within 30 seconds.`)
}

/** Ends the dev servers Orchestra started, and on Windows their whole process trees. */
export function stopServers(): void {
  for (const s of servers.values()) {
    if (process.platform === 'win32' && s.pid)
      spawn('taskkill', ['/pid', String(s.pid), '/T', '/F'])
    else s.kill()
  }
  servers.clear()
}
