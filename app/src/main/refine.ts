import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { readAudit, type Audit } from './audits.ts'
import { readWork, type Work } from './work.ts'

// Which deliverables the user has flagged ready for Refine, and which they have signed off. Only
// the user moves a deliverable between these: an agent may suggest it, never set it. Kept in
// refine.json beside the other project files. The transitions are pure so they are tested.

export interface RefineState {
  approved: string[] // ready for Refine
  signed: string[] // signed off (always also approved)
}
export type Stage = 'draft' | 'ready' | 'signed-off'

const ID = /^[a-z0-9][a-z0-9-]*$/
const ids = (v: unknown): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ID.test(x)))]
    : []

export const stageOf = (s: RefineState, id: string): Stage =>
  s.signed.includes(id) ? 'signed-off' : s.approved.includes(id) ? 'ready' : 'draft'

/** Flags a deliverable ready for Refine (again, if it was signed off). */
export const approve = (s: RefineState, id: string): RefineState => ({
  approved: s.approved.includes(id) ? s.approved : [...s.approved, id],
  signed: s.signed.filter((x) => x !== id)
})

/** Takes it back to Create: not ready, not signed off. */
export const reopen = (s: RefineState, id: string): RefineState => ({
  approved: s.approved.filter((x) => x !== id),
  signed: s.signed.filter((x) => x !== id)
})

/** Signs off a deliverable that is ready. */
export function signOff(s: RefineState, id: string): RefineState {
  if (!s.approved.includes(id)) throw new Error('Mark it ready for Refine before signing it off.')
  return { approved: s.approved, signed: s.signed.includes(id) ? s.signed : [...s.signed, id] }
}

const file = (project: string): string => join(project, 'refine.json')

export async function readRefine(project: string): Promise<RefineState> {
  try {
    const o = JSON.parse(await readFile(file(project), 'utf8'))
    const approved = ids(o?.approved)
    return { approved, signed: ids(o?.signed).filter((id) => approved.includes(id)) }
  } catch {
    return { approved: [], signed: [] }
  }
}

export async function saveRefine(project: string, s: RefineState): Promise<void> {
  await writeFile(file(project), JSON.stringify(s, null, 2) + '\n')
}

/** Everything the Refine board draws: the deliverables locked in, their links and states, and
 * the audits of the ones that are ready. Entries for deliverables no longer locked are left out. */
export interface RefineView {
  locked: string[]
  work: Record<string, Work>
  state: RefineState
  audits: Record<string, Audit>
}
export async function loadRefine(project: string, locked: string[]): Promise<RefineView> {
  const [work, saved] = await Promise.all([readWork(project), readRefine(project)])
  const state = {
    approved: saved.approved.filter((id) => locked.includes(id)),
    signed: saved.signed.filter((id) => locked.includes(id))
  }
  const audits: Record<string, Audit> = {}
  for (const id of state.approved) audits[id] = await readAudit(project, id)
  return {
    locked,
    work: Object.fromEntries(Object.entries(work).filter(([id]) => locked.includes(id))),
    state,
    audits
  }
}
