import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseDoc, type Library } from './library.ts'
import { foundationOrder } from './plan.ts'

// A project's chosen deliverables live in deliverables.md: the ids in front matter (what the
// app reads), plus the build order written out for the user, Obsidian and the Orchestrator.

export async function readSelection(project: string): Promise<string[]> {
  const md = await readFile(join(project, 'deliverables.md'), 'utf8').catch(() => '')
  const list = parseDoc(md)?.fields.deliverables
  return Array.isArray(list) ? list : []
}

export async function saveSelection(
  project: string,
  lib: Library,
  ids: string[]
): Promise<string[]> {
  const unknown = ids.filter((id) => !lib.musicians.some((m) => m.id === id))
  if (unknown.length) throw new Error(`Unknown deliverable: ${unknown.join(', ')}`)
  const chosen = lib.musicians.filter((m) => ids.includes(m.id)) // library order, no duplicates
  const name = new Map(lib.instruments.map((i) => [i.id, i.name]))
  const foundations = foundationOrder(lib.musicians, lib.instruments, ids)

  const md = [
    '---',
    `deliverables: [${chosen.map((m) => m.id).join(', ')}]`,
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
