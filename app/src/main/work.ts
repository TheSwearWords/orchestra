import { mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { isAbsolute, join } from 'path'

// Where a deliverable's finished work lives. Orchestra does not hold the work: a deliverable is
// flagged ready for Refine and points at whatever it is made in, such as a Figma page, a Blender
// file or a code folder. The links are kept in work.json, one entry per deliverable.
//
// Agents supply these links, so cleanWork is a trust boundary (like cleanPreview): only https
// links and plain paths get through, and nothing is opened from here, only described.

export type WorkKind = 'figma' | 'blender' | 'folder' | 'url' | 'other'
export interface Work {
  kind: WorkKind
  ref: string // an https link, or a path (absolute, ~/…, or inside the project)
  note?: string
}

const KINDS: WorkKind[] = ['figma', 'blender', 'folder', 'url', 'other']
const MAX_REF = 2000
const MAX_NOTE = 300
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters
const CONTROL = /[\u0000-\u001f\u007f]/
const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const DRIVE = /^[a-z]:[\\/]/i // C:\work is a path, not a scheme
const ID = /^[a-z0-9][a-z0-9-]*$/

/** An https link, parsed; anything else with a scheme (http, file, javascript…) is not one. */
function httpsUrl(ref: string): URL | null {
  try {
    const url = new URL(ref)
    return url.protocol === 'https:' && url.hostname ? url : null
  } catch {
    return null
  }
}
const isLink = (ref: string): boolean => SCHEME.test(ref) && !DRIVE.test(ref)

/** What a link or path most likely is. */
export function inferKind(ref: string): WorkKind {
  if (isLink(ref)) {
    const url = httpsUrl(ref)
    if (!url) return 'other'
    return /(^|\.)figma\.com$/i.test(url.hostname) ? 'figma' : 'url'
  }
  if (/\.blend\d?$/i.test(ref)) return 'blender'
  // no extension on the last part: a folder
  return /[\\/][^\\/.]+$/.test(ref) || /^[^\\/.]+$/.test(ref) ? 'folder' : 'other'
}

/** A well-formed work link, or null. The kind is taken from the link unless it is given. */
export function cleanWork(input: unknown): Work | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const ref = typeof o.ref === 'string' ? o.ref.trim() : ''
  if (!ref || ref.length > MAX_REF || CONTROL.test(ref)) return null
  const link = isLink(ref)
  if (link && !httpsUrl(ref)) return null
  if (!link && /(^|[\\/])\.\.([\\/]|$)/.test(ref)) return null // stays out of other folders
  const kind = KINDS.includes(o.kind as WorkKind) ? (o.kind as WorkKind) : inferKind(ref)
  if ((kind === 'figma' || kind === 'url') && !link) return null
  if ((kind === 'blender' || kind === 'folder') && link) return null
  if (kind === 'figma' && inferKind(ref) !== 'figma') return null
  const note = typeof o.note === 'string' ? o.note.trim().slice(0, MAX_NOTE) : ''
  return note ? { kind, ref, note } : { kind, ref }
}

export type Target = { url: string } | { path: string }

/** What opening a work link means: a link for the browser, or a path for the file manager. */
export function openTarget(work: Work, projectDir: string, home = homedir()): Target {
  if (isLink(work.ref)) return { url: work.ref }
  if (work.ref === '~' || /^~[\\/]/.test(work.ref)) return { path: join(home, work.ref.slice(1)) }
  return {
    path: isAbsolute(work.ref) || DRIVE.test(work.ref) ? work.ref : join(projectDir, work.ref)
  }
}

const file = (project: string): string => join(project, 'work.json')

/** Every deliverable's work link. Entries that are not well formed are left out. */
export async function readWork(project: string): Promise<Record<string, Work>> {
  const raw = await readFile(file(project), 'utf8').catch(() => '')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const out: Record<string, Work> = {}
  for (const [id, v] of Object.entries(parsed)) {
    const w = ID.test(id) ? cleanWork(v) : null
    if (w) out[id] = w
  }
  return out
}

/** Sets a deliverable's work link, or clears it with null. Throws when the link is refused. */
export async function setWork(project: string, id: string, input: unknown): Promise<Work | null> {
  if (!ID.test(id)) throw new Error(`"${id}" is not a deliverable id.`)
  const all = await readWork(project)
  let work: Work | null = null
  if (input === null) delete all[id]
  else {
    work = cleanWork(input)
    if (!work)
      throw new Error(
        'That is not a work link. Use an https link (a Figma page, say) or a path to the file or folder.'
      )
    all[id] = work
  }
  await mkdir(project, { recursive: true })
  await writeFile(file(project), JSON.stringify(all, null, 2) + '\n')
  return work
}
