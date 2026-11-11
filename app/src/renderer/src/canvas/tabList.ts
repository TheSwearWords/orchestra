// The header's project tabs, as plain list logic (the strip itself is Tabs.tsx).
import type { Area } from './shared'

/** Where a project is open, as its tab's icon; `book` is the whole book. */
export const MODE_ICON: Record<Area | 'book', string> = {
  book: 'layout-grid-line',
  research: 'book-open-line',
  create: 'quill-pen-line',
  refine: 'medal-line'
}

export const DRAFT = ':draft' // the cover editor's temporary tab; no project id contains a colon

/** Opening a book adds its tab at the end; a book already open keeps its place. */
export function openTab(tabs: string[], id: string): string[] {
  return tabs.includes(id) ? tabs : [...tabs, id]
}

/** Closing a tab: what's left, and where to go if it was the one showing: the tab on its left,
 * else the first one remaining, else null for Home. */
export function closeTab(tabs: string[], id: string): { tabs: string[]; next: string | null } {
  const i = tabs.indexOf(id)
  const rest = tabs.filter((t) => t !== id)
  return { tabs: rest, next: rest[i - 1] ?? rest[0] ?? null }
}
