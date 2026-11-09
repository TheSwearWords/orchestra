// Where a window goes when it opens: with what it's connected to. A window sits under its parent,
// each subtree gets its own column, and rows line up across the board, so everything has its
// own space and a wire never has to travel far. Pure, so it is tested in node.
export const H_GAP = 96
export const V_GAP = 144

export interface TreeNode {
  id: string
  parent?: string // the window it's wired to; none makes it a root
  // beside its parent instead of under it; or 'band', in a row of its own between it and its children
  side?: 'left' | 'right' | 'band'
  x: number // where a root goes; ignored for the rest
  y: number
  w: number
  h: number
}

const snap = (v: number): number => Math.round(v / 24) * 24

export function treeLayout(nodes: TreeNode[]): Record<string, { x: number; y: number }> {
  const known = new Set(nodes.map((n) => n.id))
  const hasParent = (n: TreeNode): boolean => !!n.parent && known.has(n.parent)
  const kids = (id: string): TreeNode[] => nodes.filter((n) => n.parent === id && !n.side)
  const sides = (id: string): TreeNode[] =>
    nodes.filter((n) => n.parent === id && n.side && n.side !== 'band')
  const bands = (id: string): TreeNode[] =>
    nodes.filter((n) => n.parent === id && n.side === 'band')
  const span = (n: TreeNode): number => {
    const row = kids(n.id)
    const total = row.reduce((sum, k) => sum + span(k), 0) + H_GAP * Math.max(0, row.length - 1)
    return Math.max(n.w, total)
  }

  // the tallest window at each depth sets where the next row starts, so rows line up
  const tallest: number[] = []
  const measure = (n: TreeNode, depth: number): void => {
    const here = [n, ...sides(n.id)].map((x) => x.h)
    tallest[depth] = Math.max(tallest[depth] ?? 0, ...here)
    kids(n.id).forEach((k) => measure(k, depth + 1))
  }
  const roots = nodes.filter((n) => !hasParent(n))
  roots.forEach((r) => measure(r, 0))

  const out: Record<string, { x: number; y: number }> = {}
  const place = (n: TreeNode, x: number, y: number, depth: number): void => {
    out[n.id] = { x: snap(x), y: snap(y) }
    let left = x
    let right = x + n.w
    for (const s of sides(n.id)) {
      const at = s.side === 'left' ? left - H_GAP - s.w : right + H_GAP
      out[s.id] = { x: snap(at), y: snap(y) }
      if (s.side === 'left') left = at
      else right = at + s.w
    }
    let nextY = y + tallest[depth] + V_GAP
    const band = bands(n.id)
    if (band.length) {
      let at = x + n.w / 2 - (band.reduce((sum, b) => sum + b.w, 0) + H_GAP * (band.length - 1)) / 2
      for (const b of band) {
        out[b.id] = { x: snap(at), y: snap(nextY) }
        at += b.w + H_GAP
      }
      nextY += Math.max(...band.map((b) => b.h)) + V_GAP
    }
    const row = kids(n.id)
    if (!row.length) return
    const width = row.reduce((sum, k) => sum + span(k), 0) + H_GAP * (row.length - 1)
    let cursor = x + n.w / 2 - width / 2
    for (const k of row) {
      const s = span(k)
      place(k, cursor + (s - k.w) / 2, nextY, depth + 1)
      cursor += s + H_GAP
    }
  }
  roots.forEach((r) => place(r, r.x, r.y, 0))
  return out
}
