// A knowledge graph laid out in 3D: pure maths, tested in node; Graph3D.tsx draws it.
import type { Graph } from './graphview'

export interface Point {
  id: string
  x: number
  y: number
  z: number
  degree: number
}

const MAX_NODES = 500

/** Spread nodes through a sphere: linked ones pull together, everything pushes apart. The same
 * graph always comes out the same. Only the best connected are kept, for speed. */
export function layout3d(g: Graph, iterations = 120, flat = false): Point[] {
  const d = new Map<string, number>()
  for (const l of g.links) for (const id of [l.source, l.target]) d.set(id, (d.get(id) ?? 0) + 1)
  const nodes = [...g.nodes]
    .sort((a, b) => (d.get(b.id) ?? 0) - (d.get(a.id) ?? 0))
    .slice(0, MAX_NODES)
  const n = nodes.length
  const index = new Map(nodes.map((v, i) => [v.id, i]))
  // start on a Fibonacci sphere, so nothing depends on a random seed
  const golden = Math.PI * (3 - Math.sqrt(5))
  const p = nodes.map((_, i) => {
    const y = n > 1 ? 1 - (2 * i) / (n - 1) : 0
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    // with no depth to start from, none appears: the same forces lay it out in a plane
    return flat
      ? [
          Math.cos(i * golden) * Math.sqrt((i + 1) / n),
          Math.sin(i * golden) * Math.sqrt((i + 1) / n),
          0
        ]
      : [Math.cos(i * golden) * r, y, Math.sin(i * golden) * r]
  })
  const links = g.links
    .map((l) => [index.get(l.source), index.get(l.target)])
    .filter((l): l is number[] => l[0] !== undefined && l[1] !== undefined && l[0] !== l[1])
  const k = 1 / Math.cbrt(Math.max(n, 1))
  const rounds = n > 200 ? Math.min(iterations, 70) : iterations
  for (let it = 0; it < rounds; it++) {
    const step = 0.08 * (1 - it / rounds)
    const f = p.map(() => [0, 0, 0])
    // plain numbers throughout: this loop runs millions of times as the Studio opens
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = p[i][0] - p[j][0]
        const dy = p[i][1] - p[j][1]
        const dz = p[i][2] - p[j][2]
        const push = (k * k) / Math.max(1e-4, dx * dx + dy * dy + dz * dz)
        f[i][0] += dx * push
        f[i][1] += dy * push
        f[i][2] += dz * push
        f[j][0] -= dx * push
        f[j][1] -= dy * push
        f[j][2] -= dz * push
      }
    for (const [a, b] of links) {
      const dx = p[a][0] - p[b][0]
      const dy = p[a][1] - p[b][1]
      const dz = p[a][2] - p[b][2]
      const pull = Math.max(1e-4, Math.hypot(dx, dy, dz)) / k
      f[a][0] -= dx * pull
      f[a][1] -= dy * pull
      f[a][2] -= dz * pull
      f[b][0] += dx * pull
      f[b][1] += dy * pull
      f[b][2] += dz * pull
    }
    for (let i = 0; i < n; i++) {
      const size = Math.max(1e-4, Math.hypot(f[i][0], f[i][1], f[i][2]))
      const move = Math.min(size, step)
      for (let c = 0; c < 3; c++) p[i][c] += (f[i][c] / size) * move
    }
  }
  // centred and scaled to fit a unit sphere
  const mid = [0, 1, 2].map((c) => p.reduce((s, q) => s + q[c], 0) / Math.max(n, 1))
  // scaled to where most of it is, so a few loose nodes can't shrink the rest to a dot
  const far = p
    .map((q) => Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2]))
    .sort((a, b) => a - b)
  const reach = Math.max(1e-4, far[Math.floor((far.length - 1) * 0.9)] ?? 0)
  const inside = (q: number[]): number =>
    Math.min(1, reach / Math.max(1e-4, Math.hypot(q[0] - mid[0], q[1] - mid[1], q[2] - mid[2])))
  return nodes.map((v, i) => ({
    id: v.id,
    x: ((p[i][0] - mid[0]) / reach) * inside(p[i]),
    y: ((p[i][1] - mid[1]) / reach) * inside(p[i]),
    z: ((p[i][2] - mid[2]) / reach) * inside(p[i]),
    degree: d.get(v.id) ?? 0
  }))
}

/** A point turned by yaw and pitch, in perspective: screen position, nearness and scale. */
export function project(
  p: { x: number; y: number; z: number },
  yaw: number,
  pitch: number,
  cx: number,
  cy: number,
  radius: number
): { sx: number; sy: number; depth: number; scale: number } {
  const x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw)
  const z1 = p.x * Math.sin(yaw) + p.z * Math.cos(yaw)
  const y = p.y * Math.cos(pitch) - z1 * Math.sin(pitch)
  const z = p.y * Math.sin(pitch) + z1 * Math.cos(pitch)
  const scale = 2.6 / (2.6 + z)
  return { sx: cx + x * radius * scale, sy: cy + y * radius * scale, depth: z, scale }
}

export interface Cluster {
  name: string
  ids: string[]
  x: number // its middle
  y: number
  z: number
}

const MIN_TITLED = 3 // a pair isn't worth a title

/** The graph's clusters, biggest first, each named after its best connected member, since
 * Graphify only numbers them. `of` says which cluster each node is in, for shading. */
export function findClusters(
  g: Graph,
  points: Point[]
): { clusters: Cluster[]; of: Map<string, number> } {
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const groups = new Map<string, Point[]>()
  // points come best connected first, so each group's first member is its hub
  for (const p of points) {
    const n = byId.get(p.id)
    const key = n?.cluster ?? (n?.community === undefined ? '' : String(n.community))
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
  const of = new Map<string, number>()
  sorted.forEach((members, i) => members.forEach((p) => of.set(p.id, i)))
  const mean = (m: Point[], c: 'x' | 'y' | 'z'): number =>
    m.reduce((sum, p) => sum + p[c], 0) / m.length
  const clusters = sorted
    .filter((m) => m.length >= MIN_TITLED)
    .map((m) => {
      const hub = byId.get(m[0].id)
      return {
        name: hub?.label || m[0].id,
        ids: m.map((p) => p.id),
        x: mean(m, 'x'),
        y: mean(m, 'y'),
        z: mean(m, 'z')
      }
    })
  return { clusters, of }
}
