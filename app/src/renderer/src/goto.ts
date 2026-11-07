// The Orchestrator ends a reply with "Go to:" lines to send the user somewhere; Orchestra shows
// each as a card that takes them there. Forms: "Go to: <project>", "Go to: <project>/create",
// and inside a project "Go to: research" for one of its areas.

export type Area = 'research' | 'create' | 'refine'
export interface Place {
  project: string
  area: Area | null
}

const AREAS = new Set(['research', 'create', 'refine'])

/** Splits trailing "Go to:" lines off a reply. Unknown projects and areas are dropped;
 * `here` is the project an area-only line means (none in the Studio). */
export function splitGoTo(
  text: string,
  projects: Set<string>,
  here?: string
): { body: string; places: Place[] } {
  const lines = text.trimEnd().split('\n')
  const places: Place[] = []
  while (lines.length) {
    const m = /^\s*Go to:\s*(.+?)\s*\.?\s*$/i.exec(lines.at(-1)!.replace(/[`*]/g, ''))
    if (!m) break
    lines.pop()
    const [a, b] = m[1].toLowerCase().split(/\s*[/·>]\s*|\s+/)
    const place: Place | null =
      projects.has(a) && (!b || AREAS.has(b))
        ? { project: a, area: (b as Area) ?? null }
        : here && AREAS.has(a)
          ? { project: here, area: a as Area }
          : null
    if (place) places.unshift(place)
  }
  return { body: lines.join('\n').trimEnd(), places }
}
