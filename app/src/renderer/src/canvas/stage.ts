// Pure layout for the Create stage. Left to right: the deliverables in columns of five, the
// prerequisites in a column, and the button to lock them in; once locked in, the windows open below.
// No DOM, so it is tested in node.

import { outputPaths } from '../../../main/plan.ts'

export { outputPaths }
export const SEAT = { w: 208, h: 248 }
const SEAT_GAP = 32
const PER_COLUMN = 5
export const LANE = 160 // room for the wires between the columns
export const PREREQ = { w: 220, h: 44, gap: 16, x: SEAT.w / 2 + LANE + 110 }
export const LOCK_R = 120
export const WINDOW_W = 520
export const ORCH_W = 640
export const ORCH_CAP = Math.round((ORCH_W * 3240) / 1920)
// a markdown file's window stops at twice that, and scrolls
export const DOC_BODY = ORCH_CAP * 2 - 44
const WINDOW_GAP = 48

// Categories in the order a project usually needs them; unknown ones follow alphabetically.
const CATEGORY_ORDER = ['Brand', 'Web', 'Product', 'Motion', '3D', 'Code']
const rank = (c: string): number => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i < 0 ? CATEGORY_ORDER.length : i
}

export interface Seated {
  id: string // a Musician id
  x: number // seat centre
  y: number
}

/** Seats in columns of five, category by category; each new column goes on the left. */
export function seatColumns(musicians: { id: string; category: string; name: string }[]): Seated[] {
  const ordered = [...musicians].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name)
  )
  return ordered.map((m, i) => ({
    id: m.id,
    x: -Math.floor(i / PER_COLUMN) * (SEAT.w + SEAT_GAP),
    y: (i % PER_COLUMN) * (SEAT.h + SEAT_GAP)
  }))
}

/** The prerequisites in a column, centred on `middle`; each point the middle of one. */
export function prereqSpots(n: number, middle: number): { x: number; y: number }[] {
  const step = PREREQ.h + PREREQ.gap
  return Array.from({ length: n }, (_, i) => ({
    x: PREREQ.x,
    y: middle + (i - (n - 1) / 2) * step
  }))
}

// A deliverable's connections, from its `tools` list. figma-read and figma-write are one connection.
const NOT_MCP = ['files', 'shell']
const pair = (t: string): string => t.replace(/-(read|write)$/, '')
export const mcpsOf = (tools: string[]): string[] => [
  ...new Set(tools.filter((t) => !NOT_MCP.includes(t)).map(pair))
]
/** Its tools list with these connections instead of the ones it had. */
export const toolsFor = (mcps: string[], tools: string[]): string[] => [
  ...tools.filter((t) => NOT_MCP.includes(t)),
  ...mcps.flatMap((m) => (m === 'figma' ? ['figma-read', 'figma-write'] : [m]))
]
const NAMES: Record<string, string> = { elevenlabs: 'ElevenLabs' }
export const mcpLabel = (id: string): string =>
  NAMES[id] ??
  id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

export type McpState = 'connected' | 'auth' | 'failed' | 'missing'
// names as `claude mcp list` shows them, where they differ from ours
const LISTED: Record<string, string> = { 'google-drive': 'google drive' }
const LOCAL = ['blender'] // being added is enough: it can't answer unless the app is open
export function mcpState(id: string, listed: Record<string, string>): McpState {
  const s = listed[LISTED[id] ?? id]
  if (!s) return 'missing'
  if (LOCAL.includes(id) || s === 'connected') return 'connected'
  return s === 'auth' ? 'auth' : 'failed'
}

/** Points evenly round a ring, starting at the top. */
export function ring(n: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** The left edge of the i-th of n windows, in a centred row under the Deliverables circle. */
export function windowX(i: number, n: number): number {
  const step = WINDOW_W + WINDOW_GAP
  return Math.round((-((n - 1) * step) / 2 - WINDOW_W / 2 + i * step) / 24) * 24
}

/** The project paths an Instrument's `output` names (prereqs/… or exports/), if any. */

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
