import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'

// Each reference is a markdown note in the project's references/ folder (front matter +
// "what I like" as the body), so Obsidian, Graphify and agents read it as plain text.
// Uploaded files are copied into references/files/ beside their notes.

export type Tag = 'inspiration' | 'asset'

export interface Reference {
  id: string // note file name without .md
  kind: 'link' | 'file'
  source: string // the URL, or the file name inside references/files/
  note: string
  tag: Tag
  added: string // ISO date
  size?: number // bytes, files only
}

export interface Site {
  name: string
  url: string
}

// The seven sources from the project notes; users add their own on top (sites.json).
export const DEFAULT_SITES: Site[] = [
  { name: 'Are.na', url: 'https://www.are.na' },
  { name: 'Visuelle', url: 'https://visuelle.co.uk' },
  { name: 'Design Reviewed', url: 'https://designreviewed.com' },
  { name: 'CARI', url: 'https://cari.institute' },
  { name: 'Public Work', url: 'https://public.work' },
  { name: 'Artvee', url: 'https://artvee.com' },
  { name: 'Rawpixel', url: 'https://www.rawpixel.com' }
]

export const FILE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf']
const MAX_FILE_BYTES = 25 * 1024 * 1024
const ID = /^[a-z0-9][a-z0-9-]*$/

export function slugify(s: string, max = 48): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/, '') || 'reference'
  )
}

/** Accepts only http(s) URLs; adds https:// when the scheme is missing. */
export function normalizeUrl(raw: string): string {
  const text = raw.trim()
  const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`)
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Links must start with http or https.')
  if (!url.hostname.includes('.')) throw new Error('That doesn’t look like a web address.')
  return url.href
}

const oneLine = (s: string): string => s.replace(/\s*\r?\n\s*/g, ' ').trim()

export function referenceMarkdown(r: Omit<Reference, 'id'>): string {
  const size = r.size === undefined ? '' : `size: ${r.size}\n`
  return `---\nkind: ${r.kind}\nsource: ${oneLine(r.source)}\ntag: ${r.tag}\nadded: ${r.added}\n${size}---\n\n${r.note.trim()}\n`
}

export function parseReference(id: string, md: string): Reference | null {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md)
  if (!m) return null
  const f: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (kv) f[kv[1]] = kv[2].trim()
  }
  if ((f.kind !== 'link' && f.kind !== 'file') || !f.source) return null
  return {
    id,
    kind: f.kind,
    source: f.source,
    note: m[2].trim(),
    tag: f.tag === 'asset' ? 'asset' : 'inspiration',
    added: f.added ?? '',
    ...(f.size ? { size: Number(f.size) } : {})
  }
}

const refsDir = (project: string): string => join(project, 'references')
const filesDir = (project: string): string => join(refsDir(project), 'files')

async function uniqueName(dir: string, base: string, ext: string): Promise<string> {
  const taken = new Set(await readdir(dir).catch(() => [] as string[]))
  let name = base
  for (let n = 2; taken.has(name + ext); n++) name = `${base}-${n}`
  return name
}

export async function listReferences(project: string): Promise<Reference[]> {
  const dir = refsDir(project)
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.md'))
  const refs = await Promise.all(
    names.map(async (n) => parseReference(n.slice(0, -3), await readFile(join(dir, n), 'utf8')))
  )
  return refs
    .filter((r): r is Reference => r !== null)
    .sort((a, b) => b.added.localeCompare(a.added))
}

export async function addLink(
  project: string,
  input: { url: string; note: string; tag: Tag }
): Promise<Reference> {
  const url = normalizeUrl(input.url)
  const { hostname, pathname } = new URL(url)
  const dir = refsDir(project)
  await mkdir(dir, { recursive: true })
  const id = await uniqueName(dir, slugify(hostname.replace(/^www\./, '') + pathname), '.md')
  const ref = {
    kind: 'link' as const,
    source: url,
    note: input.note,
    tag: input.tag,
    added: new Date().toISOString()
  }
  await writeFile(join(dir, `${id}.md`), referenceMarkdown(ref))
  return { id, ...ref, note: ref.note.trim() }
}

export async function addFiles(project: string, paths: string[]): Promise<Reference[]> {
  await mkdir(filesDir(project), { recursive: true })
  const added: Reference[] = []
  for (const path of paths) {
    const ext = extname(path).toLowerCase()
    if (!FILE_TYPES.includes(ext.slice(1)))
      throw new Error(`${basename(path)}: only images and PDFs can be added.`)
    const { size, isFile } = await stat(path).then((s) => ({ size: s.size, isFile: s.isFile() }))
    if (!isFile) throw new Error(`${basename(path)} isn’t a file.`)
    if (size > MAX_FILE_BYTES) throw new Error(`${basename(path)} is over 25 MB.`)

    const base = slugify(basename(path, extname(path)))
    const file = (await uniqueName(filesDir(project), base, ext)) + ext
    await copyFile(path, join(filesDir(project), file))
    const id = await uniqueName(refsDir(project), base, '.md')
    const ref = {
      kind: 'file' as const,
      source: file,
      note: '',
      tag: 'inspiration' as Tag,
      added: new Date().toISOString(),
      size
    }
    await writeFile(join(refsDir(project), `${id}.md`), referenceMarkdown(ref))
    added.push({ id, ...ref })
  }
  return added
}

async function readRef(project: string, id: string): Promise<Reference> {
  if (!ID.test(id)) throw new Error('Unknown reference.')
  const ref = parseReference(id, await readFile(join(refsDir(project), `${id}.md`), 'utf8'))
  if (!ref) throw new Error('That reference note is unreadable.')
  return ref
}

export async function updateReference(
  project: string,
  id: string,
  change: { note?: string; tag?: Tag }
): Promise<Reference> {
  const ref = { ...(await readRef(project, id)), ...change }
  await writeFile(join(refsDir(project), `${id}.md`), referenceMarkdown(ref))
  return { ...ref, note: ref.note.trim() }
}

export async function removeReference(project: string, id: string): Promise<void> {
  const ref = await readRef(project, id)
  if (ref.kind === 'file') await rm(join(filesDir(project), basename(ref.source)), { force: true })
  await rm(join(refsDir(project), `${id}.md`))
}

/** Absolute path of an uploaded reference file, refusing anything outside references/files. */
export function referenceFilePath(project: string, file: string): string {
  if (file !== basename(file) || file.startsWith('.')) throw new Error('Bad file name.')
  return join(filesDir(project), file)
}

export async function listSites(home: string): Promise<Site[]> {
  const own = await readFile(join(home, 'sites.json'), 'utf8')
    .then((t) => JSON.parse(t) as Site[])
    .catch(() => [] as Site[])
  return [...DEFAULT_SITES, ...own]
}

export async function addSite(home: string, input: Site): Promise<Site[]> {
  const name = oneLine(input.name)
  if (!name) throw new Error('Give the site a name.')
  const site = { name, url: normalizeUrl(input.url) }
  const own = (await listSites(home)).slice(DEFAULT_SITES.length)
  await mkdir(home, { recursive: true })
  await writeFile(join(home, 'sites.json'), JSON.stringify([...own, site], null, 2))
  return [...DEFAULT_SITES, ...own, site]
}
