// The choices behind the Create start modal: which research notes and deliverables to build
// from. Pure, so it is tested in node.

import { foundationOrder } from '../../../main/plan.ts'
import { CATEGORY_ORDER } from './stage.ts'

export interface ResearchChoice {
  path: string // inside the project: research.md or research/<name>.md
  label: string
}

/** The notes the modal offers: the summary first, then each file in research/. */
export function researchChoices(outputs: { path: string }[]): ResearchChoice[] {
  const paths = outputs.map((o) => o.path)
  const notes = paths
    .filter((p) => /^research\/[^/]+\.md$/.test(p))
    .sort((a, b) => a.localeCompare(b))
    .map((p) => ({ path: p, label: p.slice(9, -3).replace(/[-_]+/g, ' ') }))
  return [
    ...(paths.includes('research.md') ? [{ path: 'research.md', label: 'Research summary' }] : []),
    ...notes
  ]
}

/** What starts ticked: the saved picks that still exist, or every note the first time. */
export function startingResearch(saved: string[], choices: ResearchChoice[]): string[] {
  const kept = choices.filter((c) => saved.includes(c.path)).map((c) => c.path)
  return kept.length || saved.length ? kept : choices.map((c) => c.path)
}

/** Deliverables grouped by category, in the order a project usually needs them. */
export function groupByCategory<T extends { id: string; name: string; category: string }>(
  musicians: T[]
): { category: string; items: T[] }[] {
  const rank = (c: string): number => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i < 0 ? CATEGORY_ORDER.length : i
  }
  const names = [...new Set(musicians.map((m) => m.category))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  )
  return names.map((category) => ({
    category,
    items: musicians
      .filter((m) => m.category === category)
      .sort((a, b) => a.name.localeCompare(b.name))
  }))
}

/** Turns one on or off. Anything pinned (work has started on it) stays on. */
export function toggled(list: string[], id: string, pinned: string[]): string[] {
  if (pinned.includes(id)) return list.includes(id) ? list : [...list, id]
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/** The prerequisites these deliverables need, built once each, in build order. */
export function neededNames(
  musicians: Parameters<typeof foundationOrder>[0],
  instruments: Parameters<typeof foundationOrder>[1],
  picks: string[]
): string[] {
  return foundationOrder(musicians, instruments, picks).map((i) => i.name)
}
