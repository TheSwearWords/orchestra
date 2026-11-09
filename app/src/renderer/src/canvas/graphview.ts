// Reading a Graphify graph.json for people: what keeps coming up, and the neighbourhood of one
// thing to trace. Pure, so it is tested in node; the Knowledge window draws the results.

export interface GNode {
  id: string
  label?: string
  community?: number
  community_name?: string
  cluster?: string // keeps clusters apart when several projects' graphs are shown together
  source_file?: string
  file_type?: string
}
export interface GLink {
  source: string
  target: string
  relation?: string
  confidence?: string
}
export interface Graph {
  nodes: GNode[]
  links: GLink[]
}

export const label = (n: GNode): string => n.label || n.id

/** How many links touch each node. */
export function degrees(g: Graph): Map<string, number> {
  const d = new Map<string, number>()
  for (const l of g.links) {
    d.set(l.source, (d.get(l.source) ?? 0) + 1)
    d.set(l.target, (d.get(l.target) ?? 0) + 1)
  }
  return d
}

/** The most connected things, and the clusters, largest first. */
export function summarize(
  g: Graph,
  top = 10
): {
  hubs: { id: string; label: string; degree: number }[]
  clusters: { name: string; size: number }[]
} {
  const d = degrees(g)
  const hubs = g.nodes
    .map((n) => ({ id: n.id, label: label(n), degree: d.get(n.id) ?? 0 }))
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label))
    .slice(0, top)
  // Graphify often only numbers its clusters: those take the name of their best connected member
  const groups = new Map<string, GNode[]>()
  for (const n of g.nodes) {
    const key = n.community_name || (n.community !== undefined ? `Cluster ${n.community}` : '')
    if (key) groups.set(key, [...(groups.get(key) ?? []), n])
  }
  const clusters = [...groups]
    .map(([key, members]) => ({
      name: /^(cluster|community) \d+$/i.test(key)
        ? label([...members].sort((a, b) => (d.get(b.id) ?? 0) - (d.get(a.id) ?? 0))[0])
        : key,
      size: members.length
    }))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
  return { hubs, clusters }
}

/** Nodes whose label (or id) contains the words, the best connected first. */
export function search(g: Graph, q: string, limit = 8): GNode[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const d = degrees(g)
  return g.nodes
    .filter((n) => words.every((w) => `${label(n)} ${n.id}`.toLowerCase().includes(w)))
    .sort((a, b) => (d.get(b.id) ?? 0) - (d.get(a.id) ?? 0))
    .slice(0, limit)
}

/** One node and the things linked to it (the best connected, up to `limit`), with the
 * links between them, so a person can trace it without the whole tangle. */
export function neighbourhood(
  g: Graph,
  id: string,
  limit = 16
): { center: GNode | undefined; around: { node: GNode; relation: string }[]; more: number } {
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const d = degrees(g)
  const seen = new Map<string, string>()
  for (const l of g.links) {
    if (l.source === id && l.target !== id && !seen.has(l.target))
      seen.set(l.target, l.relation ?? '')
    if (l.target === id && l.source !== id && !seen.has(l.source))
      seen.set(l.source, l.relation ?? '')
  }
  const all = [...seen]
    .map(([nid, relation]) => ({ node: byId.get(nid), relation }))
    .filter((x): x is { node: GNode; relation: string } => !!x.node)
    .sort((a, b) => (d.get(b.node.id) ?? 0) - (d.get(a.node.id) ?? 0))
  return {
    center: byId.get(id),
    around: all.slice(0, limit),
    more: Math.max(0, all.length - limit)
  }
}
