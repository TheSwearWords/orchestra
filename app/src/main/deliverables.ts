import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseDoc, type Library } from './library.ts'
import { foundationOrder } from './plan.ts'

// A project's chosen deliverables live in deliverables.md: the ids in front matter (what the
// app reads), plus the build order written out for the user, Obsidian and the Orchestrator.
// `locked` lists the ones the user has locked in; only those can be briefed. `research` lists
// the research notes the user picked for Create to use, as paths inside the project.

export async function readSelection(project: string): Promise<string[]> {
  const md = await readFile(join(project, 'deliverables.md'), 'utf8').catch(() => '')
  const list = parseDoc(md)?.fields.deliverables
  return Array.isArray(list) ? list : []
}

/** The deliverables the user has locked in on the Create board. */
export async function readLocked(project: string): Promise<string[]> {
  const md = await readFile(join(project, 'deliverables.md'), 'utf8').catch(() => '')
  const list = parseDoc(md)?.fields.locked
  return Array.isArray(list) ? list : []
}

/** Keeps only well-formed research paths (`research.md` or `research/<name>.md`). The list is
 * kept in front matter, where a comma or bracket would split it, so those are refused too. */
export function cleanResearch(paths: unknown): string[] {
  if (!Array.isArray(paths)) return []
  const ok = paths.filter(
    (p): p is string => typeof p === 'string' && /^research(\.md|\/[\w .-]+\.md)$/.test(p)
  )
  return [...new Set(ok)]
}

/** The research notes the user picked for Create to use. */
export async function readResearch(project: string): Promise<string[]> {
  const md = await readFile(join(project, 'deliverables.md'), 'utf8').catch(() => '')
  return cleanResearch(parseDoc(md)?.fields.research)
}

/** Saves which research notes Create should use, leaving the deliverables as they are. */
export async function saveResearch(
  project: string,
  lib: Library,
  paths: unknown
): Promise<string[]> {
  const research = cleanResearch(paths)
  await saveSelection(project, lib, await readSelection(project), undefined, research)
  return research
}

/** Locks in more deliverables. It only ever adds, and only ones that are chosen. */
export async function lockDeliverables(
  project: string,
  lib: Library,
  ids: string[]
): Promise<string[]> {
  const selected = await readSelection(project)
  const locked = [...new Set([...(await readLocked(project)), ...ids])].filter((id) =>
    selected.includes(id)
  )
  await saveSelection(project, lib, selected, locked)
  return locked
}

export async function saveSelection(
  project: string,
  lib: Library,
  ids: string[],
  lockedIn?: string[], // left out: what was locked in stays locked, if it's still chosen
  picked?: string[] // research notes picked for Create; left out: the picks stay as they were
): Promise<string[]> {
  const unknown = ids.filter((id) => !lib.musicians.some((m) => m.id === id))
  if (unknown.length) throw new Error(`Unknown deliverable: ${unknown.join(', ')}`)
  const chosen = lib.musicians.filter((m) => ids.includes(m.id)) // library order, no duplicates
  const name = new Map(lib.instruments.map((i) => [i.id, i.name]))
  const foundations = foundationOrder(lib.musicians, lib.instruments, ids)
  const locked = (lockedIn ?? (await readLocked(project))).filter((id) =>
    chosen.some((m) => m.id === id)
  )

  const research = picked ?? (await readResearch(project))

  const md = [
    '---',
    `deliverables: [${chosen.map((m) => m.id).join(', ')}]`,
    ...(locked.length ? [`locked: [${locked.join(', ')}]`] : []),
    ...(research.length ? [`research: [${research.join(', ')}]`] : []),
    '---',
    '',
    '# Deliverables',
    '',
    `Picked in Orchestra on ${new Date().toISOString().slice(0, 10)}. The Orchestrator builds the foundations first, once each, then briefs one Musician per deliverable.`,
    '',
    '## Foundations, built first',
    '',
    ...(foundations.length
      ? foundations.map((f, i) => `${i + 1}. **${f.name}**: ${f.output}`)
      : ['None.']),
    '',
    '## Deliverables',
    '',
    ...(chosen.length
      ? chosen.map(
          (m) =>
            `- **${m.name}**: ${m.deliverable}` +
            (m.prerequisites.length
              ? ` Needs ${m.prerequisites.map((p) => name.get(p) ?? p).join(', ')}.`
              : '')
        )
      : ['None yet.']),
    ''
  ].join('\n')
  await writeFile(join(project, 'deliverables.md'), md)
  return chosen.map((m) => m.id)
}
