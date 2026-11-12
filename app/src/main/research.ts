import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'

// Each reference is a markdown note in the project's references/ folder (front matter +
// "what I like" as the body), so Obsidian, Graphify and agents read it as plain text.
// Uploaded files are copied into references/files/ beside their notes.

export type Tag = 'inspiration' | 'asset'

export interface Reference {
  id: string // note file name without .md
  kind: 'link' | 'file' | 'text' // text: words the user wrote, kept as the note
  source: string // the URL, or the file name inside references/files/
  note: string
  tag: Tag
  added: string // ISO date
  size?: number // bytes, files only
  group?: string // the group it's filed under; none means the project's default group
}

/** How the references are organised (references/groups.json). Every project has one default
 * group, called "<project> research" until it's renamed. */
export interface Groups {
  default: string | null
  others: string[]
  kinds: Record<string, Kind[]> // a window of its own has one kind; a full group isn't listed
}

export const KINDS = ['links', 'inspiration', 'assets', 'text'] as const
export type Kind = (typeof KINDS)[number]

export interface Site {
  name: string
  url: string
  about?: string // what the site is for, in a line; names alone don't say
  tags?: string[] // what kind of library it is
  shot?: boolean // has a picture of its landing page, worked out on load and never saved
}

// The seven sources from the project notes; users add their own on top (sites.json).
export const DEFAULT_SITES: Site[] = [
  {
    name: 'Are.na',
    url: 'https://www.are.na',
    about: 'Boards of images, links and text that people collect and connect. Good for moodboards.'
  },
  {
    name: 'Visuelle',
    url: 'https://visuelle.co.uk',
    about: 'A curated blog of graphic design, branding and typography from studios worldwide.'
  },
  {
    name: 'Design Reviewed',
    url: 'https://designreviewed.com',
    about: 'Scans of mid-century graphic design: posters, books, ads and trade journals.'
  },
  {
    name: 'CARI',
    url: 'https://cari.institute',
    about: 'Consumer aesthetics by era (Y2K, Frutiger Aero and more), each with image references.'
  },
  {
    name: 'Public Work',
    url: 'https://public.work',
    about: 'A search engine for public-domain images: art, photography and illustration.'
  },
  {
    name: 'Artvee',
    url: 'https://artvee.com',
    about: 'Public-domain fine art in high resolution, by artist, movement and subject.'
  },
  {
    name: 'Rawpixel',
    url: 'https://www.rawpixel.com',
    about: 'Stock images, mockups and public-domain art, much of it free to use.'
  }
]

const DEFAULT_TAGS: Record<string, string[]> = {
  'Are.na': ['Moodboards'],
  Visuelle: ['Graphic design', 'Typography'],
  'Design Reviewed': ['Graphic design', 'Print'],
  CARI: ['Aesthetics', 'Images'],
  'Public Work': ['Images'],
  Artvee: ['Art', 'Images'],
  Rawpixel: ['Images', 'Stock']
}

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
  const group = r.group ? `group: ${oneLine(r.group)}\n` : ''
  return `---\nkind: ${r.kind}\nsource: ${oneLine(r.source)}\ntag: ${r.tag}\nadded: ${r.added}\n${size}${group}---\n\n${r.note.trim()}\n`
}

export function parseReference(id: string, md: string): Reference | null {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md)
  if (!m) return null
  const f: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line)
    if (kv) f[kv[1]] = kv[2].trim()
  }
  if ((f.kind !== 'link' && f.kind !== 'file' && f.kind !== 'text') || !f.source) return null
  return {
    id,
    kind: f.kind,
    source: f.source,
    note: m[2].trim(),
    tag: f.tag === 'asset' ? 'asset' : 'inspiration',
    added: f.added ?? '',
    ...(f.size ? { size: Number(f.size) } : {}),
    ...(f.group ? { group: f.group } : {})
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
  change: { note?: string; tag?: Tag; group?: string | null }
): Promise<Reference> {
  const { group, ...rest } = change
  const ref: Reference = { ...(await readRef(project, id)), ...rest }
  if (group === null) delete ref.group
  else if (group !== undefined) {
    if (!(await readGroups(project)).others.includes(group)) throw new Error('Unknown group.')
    ref.group = group
  }
  await writeFile(join(refsDir(project), `${id}.md`), referenceMarkdown(ref))
  return { ...ref, note: ref.note.trim() }
}

/** What the user typed into a text window: one note per window; empty removes it. */
export async function saveText(project: string, group: unknown, raw: unknown): Promise<void> {
  const g = await readGroups(project)
  if (typeof group !== 'string' || !g.kinds[group]?.includes('text'))
    throw new Error('Unknown text window.')
  const text = typeof raw === 'string' ? raw.trim().slice(0, 20_000) : ''
  const old = (await listReferences(project)).find((r) => r.kind === 'text' && r.group === group)
  if (!text) {
    if (old) await rm(join(refsDir(project), `${old.id}.md`))
    return
  }
  const dir = refsDir(project)
  await mkdir(dir, { recursive: true })
  const id = old?.id ?? (await uniqueName(dir, slugify(`note-${group}`), '.md'))
  await writeFile(
    join(dir, `${id}.md`),
    referenceMarkdown({
      kind: 'text',
      source: 'text',
      note: text,
      tag: 'inspiration',
      added: old?.added ?? new Date().toISOString(),
      group
    })
  )
}

const groupsFile = (project: string): string => join(refsDir(project), 'groups.json')

export async function readGroups(project: string): Promise<Groups> {
  const g = await readFile(groupsFile(project), 'utf8')
    .then((t) => JSON.parse(t) as Partial<Groups>)
    .catch(() => ({}) as Partial<Groups>)
  return {
    default: typeof g.default === 'string' ? g.default : null,
    others: Array.isArray(g.others) ? g.others.filter((n) => typeof n === 'string') : [],
    kinds: g.kinds && typeof g.kinds === 'object' ? g.kinds : {}
  }
}

async function saveGroups(project: string, g: Groups): Promise<Groups> {
  await mkdir(refsDir(project), { recursive: true })
  await writeFile(groupsFile(project), JSON.stringify(g, null, 2))
  return g
}

function groupName(raw: unknown): string {
  const name = typeof raw === 'string' ? oneLine(raw).slice(0, 60) : ''
  if (!name) throw new Error('Give the group a name.')
  return name
}

/** Adds a group, numbering the name if it's already used. */
export async function addGroup(project: string, raw: unknown, kinds?: unknown): Promise<Groups> {
  const g = await readGroups(project)
  const base = groupName(raw)
  let name = base
  for (let n = 2; g.others.includes(name) || g.default === name; n++) name = `${base} ${n}`
  const only = Array.isArray(kinds) ? kinds.filter((k) => KINDS.includes(k)) : []
  return saveGroups(project, {
    ...g,
    others: [...g.others, name],
    kinds: only.length ? { ...g.kinds, [name]: only } : g.kinds
  })
}

/** Renames a group (null is the default one) and refiles what's in it under the new name. */
export async function renameGroup(project: string, from: unknown, raw: unknown): Promise<Groups> {
  const g = await readGroups(project)
  const name = groupName(raw)
  if (from === null) return saveGroups(project, { ...g, default: name })
  if (from === name) return g
  if (typeof from !== 'string' || !g.others.includes(from)) throw new Error('Unknown group.')
  if (g.others.includes(name) || g.default === name)
    throw new Error('There is already a group with that name.')
  for (const r of await listReferences(project))
    if (r.group === from) {
      const { id, ...rest } = r
      await writeFile(
        join(refsDir(project), `${id}.md`),
        referenceMarkdown({ ...rest, group: name })
      )
    }
  const { [from]: kept, ...kinds } = g.kinds
  return saveGroups(project, {
    ...g,
    others: g.others.map((n) => (n === from ? name : n)),
    kinds: kept ? { ...kinds, [name]: kept } : kinds
  })
}

/** Deletes a group; its references go back to the default group. */
export async function removeGroup(project: string, name: unknown): Promise<Groups> {
  const g = await readGroups(project)
  if (typeof name !== 'string' || !g.others.includes(name)) throw new Error('Unknown group.')
  for (const r of await listReferences(project))
    if (r.group === name) {
      if (r.kind === 'text') {
        await rm(join(refsDir(project), `${r.id}.md`))
        continue
      }
      const { id, group: _gone, ...rest } = r
      await writeFile(join(refsDir(project), `${id}.md`), referenceMarkdown(rest))
    }
  const { [name]: _kinds, ...kinds } = g.kinds
  return saveGroups(project, { ...g, others: g.others.filter((n) => n !== name), kinds })
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

// Built-in sites the user removed, by host. Kept apart from sites.json so that file keeps its
// shape: a plain list of the user's own sites.
const hiddenFile = (home: string): string => join(home, 'sites-hidden.json')
async function hiddenSites(home: string): Promise<string[]> {
  return readFile(hiddenFile(home), 'utf8')
    .then((t) => JSON.parse(t) as unknown)
    .then((v) => (Array.isArray(v) ? v.filter((h): h is string => typeof h === 'string') : []))
    .catch(() => [])
}
async function ownSites(home: string): Promise<Site[]> {
  return readFile(join(home, 'sites.json'), 'utf8')
    .then((t) => JSON.parse(t) as Site[])
    .catch(() => [] as Site[])
}

export async function listSites(home: string): Promise<Site[]> {
  const [own, hidden] = await Promise.all([ownSites(home), hiddenSites(home)])
  const builtIn = DEFAULT_SITES.filter((s) => !hidden.includes(siteHost(s.url)))
  return [...builtIn.map((s) => ({ ...s, tags: DEFAULT_TAGS[s.name] })), ...own]
}

/** Takes a site out of the library: one the user added is deleted, a built-in one is hidden. */
export async function removeSite(home: string, url: string): Promise<Site[]> {
  const host = siteHost(normalizeUrl(url))
  const own = await ownSites(home)
  const kept = own.filter((s) => siteHost(s.url) !== host)
  await mkdir(home, { recursive: true })
  if (kept.length !== own.length)
    await writeFile(join(home, 'sites.json'), JSON.stringify(kept, null, 2))
  if (DEFAULT_SITES.some((s) => siteHost(s.url) === host)) {
    const hidden = await hiddenSites(home)
    if (!hidden.includes(host))
      await writeFile(hiddenFile(home), JSON.stringify([...hidden, host], null, 2))
  }
  return listSites(home)
}

export const siteHost = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** Puts a link's website in the reference library, unless it's already there. */
export async function ensureSite(home: string, url: string): Promise<void> {
  const host = siteHost(url)
  if ((await listSites(home)).some((s) => siteHost(s.url) === host)) return
  // removed on purpose: a new link from it doesn't bring it back
  if ((await hiddenSites(home)).includes(host)) return
  const name = host.split('.')[0]
  await addSite(home, {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    url: new URL(url).origin,
    about: 'Added from a reference link.'
  })
}

export async function addSite(home: string, input: Site): Promise<Site[]> {
  const name = oneLine(input.name)
  if (!name) throw new Error('Give the site a name.')
  const about = oneLine(input.about ?? '').slice(0, 160)
  const tags = (Array.isArray(input.tags) ? input.tags : [])
    .map((t) => oneLine(String(t)).slice(0, 24))
    .filter(Boolean)
    .slice(0, 5)
  const site = {
    name,
    url: normalizeUrl(input.url),
    ...(about ? { about } : {}),
    ...(tags.length ? { tags } : {})
  }
  const own = await ownSites(home)
  await mkdir(home, { recursive: true })
  await writeFile(join(home, 'sites.json'), JSON.stringify([...own, site], null, 2))
  return listSites(home)
}
