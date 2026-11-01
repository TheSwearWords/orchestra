import type { Instrument, Musician } from './library'

// No Node imports: the renderer uses this too, to show the build order live.

/** The foundation Instruments the chosen deliverables need, each once, needs before dependents. */
export function foundationOrder(
  musicians: Musician[],
  instruments: Instrument[],
  chosen: string[]
): Instrument[] {
  const byId = new Map(instruments.map((i) => [i.id, i]))
  const order: Instrument[] = []
  const seen = new Set<string>()
  const visit = (id: string): void => {
    const inst = byId.get(id)
    if (!inst || seen.has(id)) return
    seen.add(id) // marked before recursing, so even a circular `needs` can't loop
    inst.needs.forEach(visit)
    order.push(inst)
  }
  for (const m of musicians) if (chosen.includes(m.id)) m.prerequisites.forEach(visit)
  return order
}
