// Interpret boxes (references/interprets.json): each reads the groups wired into it and writes one
// markdown file. The first box writes research.md; the rest write research/<id>.md.
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { readGroups, type Groups, type Reference } from './research.ts'

export interface InterpretBox {
  id: string
  name: string
  groups: string[] // group names; '' is the project's default group
}

const MAIN = 'main'
const file = (project: string): string => join(project, 'references', 'interprets.json')
const known = (g: Groups, name: string): boolean => name === '' || g.others.includes(name)

export const outputFor = (id: string): string => (id === MAIN ? 'research.md' : `research/${id}.md`)

export const refsFor = (refs: Reference[], box: InterpretBox): Reference[] =>
  refs.filter((r) => box.groups.includes(r.group ?? ''))

/** The boxes; a project that never changed them has one, wired to every group. */
export async function readBoxes(project: string): Promise<InterpretBox[]> {
  const groups = await readGroups(project)
  const saved = await readFile(file(project), 'utf8')
    .then((t) => JSON.parse(t) as InterpretBox[])
    .catch(() => null)
  if (!Array.isArray(saved) || saved.length === 0)
    return [{ id: MAIN, name: 'Interpret', groups: ['', ...groups.others] }]
  return saved.map((b) => ({ ...b, groups: b.groups.filter((g) => known(groups, g)) }))
}

const save = async (project: string, boxes: InterpretBox[]): Promise<InterpretBox[]> => {
  await writeFile(file(project), JSON.stringify(boxes, null, 2))
  return boxes
}

export async function addBox(project: string): Promise<InterpretBox[]> {
  const boxes = await readBoxes(project)
  let n = boxes.length + 1
  while (boxes.some((b) => b.id === `interpret-${n}`)) n++
  return save(project, [...boxes, { id: `interpret-${n}`, name: `Interpret ${n}`, groups: [] }])
}

function find(boxes: InterpretBox[], id: unknown): InterpretBox {
  const box = boxes.find((b) => b.id === id)
  if (!box) throw new Error('That Interpret box is gone.')
  return box
}

export async function renameBox(project: string, id: unknown, name: unknown): Promise<void> {
  const boxes = await readBoxes(project)
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 60) : ''
  if (!text) throw new Error('Give it a name.')
  find(boxes, id).name = text
  await save(project, boxes)
}

export async function removeBox(project: string, id: unknown): Promise<void> {
  if (id === MAIN) throw new Error('The first Interpret box stays: it writes research.md.')
  const boxes = await readBoxes(project)
  find(boxes, id)
  await save(
    project,
    boxes.filter((b) => b.id !== id)
  )
}

/** Wires a group into a box, or takes it out. */
export async function connectBox(
  project: string,
  id: unknown,
  group: unknown,
  on: boolean
): Promise<void> {
  const boxes = await readBoxes(project)
  const box = find(boxes, id)
  if (typeof group !== 'string' || !known(await readGroups(project), group))
    throw new Error('Unknown group.')
  box.groups = on ? [...new Set([...box.groups, group])] : box.groups.filter((g) => g !== group)
  await save(project, boxes)
}

/** Keeps boxes wired to a group after it's renamed. */
export async function renameBoxGroup(project: string, from: string, to: string): Promise<void> {
  // straight from the file: readBoxes would already have dropped the old name
  const boxes = await readFile(file(project), 'utf8')
    .then((t) => JSON.parse(t) as InterpretBox[])
    .catch(() => null)
  if (!boxes) return
  await save(
    project,
    boxes.map((b) => ({ ...b, groups: b.groups.map((g) => (g === from ? to : g)) }))
  )
}
