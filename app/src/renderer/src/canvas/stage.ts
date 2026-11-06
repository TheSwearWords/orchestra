// Pure layout for the Create stage (canvas spec §6): every deliverable is a seat on an arc
// above the Deliverables podium, grouped by category; foundations ring the Prerequisites circle.
// No DOM, so it is tested in node.

export const SEAT = { w: 216, h: 156 }
export const PODIUM = { x: 0, y: 0, r: 150 }
export const PREREQS = { x: 0, y: 560, r: 96, ring: 250 }
const ARC = { rx: 940, ry: 620 }

// Categories in the order a project usually needs them; unknown ones follow alphabetically.
const CATEGORY_ORDER = ['Brand', 'Web', 'Product', 'Motion', '3D', 'Code']
const rank = (c: string): number => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i < 0 ? CATEGORY_ORDER.length : i
}

export interface Seated {
  id: string // a Musician id, or "add" for the dashed Add seat
  x: number // seat centre
  y: number
}

/** Seats along the upper arc, left to right, category by category, then the Add seat. */
export function seatArc(musicians: { id: string; category: string; name: string }[]): Seated[] {
  const ordered = [...musicians].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name)
  )
  const ids = [...ordered.map((m) => m.id), 'add']
  // from just below the left horizon, over the top, to just below the right
  const from = Math.PI + 0.12
  const to = -0.12
  return ids.map((id, i) => {
    const t = ids.length === 1 ? 0.5 : i / (ids.length - 1)
    const a = from + (to - from) * t
    return { id, x: PODIUM.x + ARC.rx * Math.cos(a), y: PODIUM.y - ARC.ry * Math.sin(a) }
  })
}

/** Points evenly round a ring, starting at the top. */
export function ring(n: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** The project paths an Instrument's `output` names (prereqs/… or exports/), if any. */
export const outputPaths = (output: string): string[] =>
  output.match(/\b(?:prereqs|exports)\/[\w./-]*/g)?.map((p) => p.replace(/[.,]$/, '')) ?? []

/** The files a deliverable made: those under the paths its Instruments and foundations name.
 * shortcut: files are matched by path, so two deliverables sharing exports/ both list them;
 * upgrade when outputs are recorded per Musician. */
export function filesFor<T extends { path: string }>(
  musician: { instruments: string[]; prerequisites: string[] },
  instruments: { id: string; output: string }[],
  outputs: T[]
): T[] {
  const mine = new Set([...musician.instruments, ...musician.prerequisites])
  const paths = instruments.filter((i) => mine.has(i.id)).flatMap((i) => outputPaths(i.output))
  return outputs.filter((o) =>
    paths.some((p) =>
      p.endsWith('/') ? o.path.startsWith(p) : o.path === p || o.path.startsWith(p + '/')
    )
  )
}
