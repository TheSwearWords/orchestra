// The link between popMenu (shared.ts) and the one menu drawn on screen (ContextMenu.tsx).
// Kept in its own file so ContextMenu.tsx exports only a component.
import type { MenuItem } from './shared'

export interface OpenMenu {
  items: MenuItem[]
  x: number
  y: number
  done: () => void
}

let show: ((m: OpenMenu | null) => void) | null = null

/** ContextMenuHost registers here while it's mounted. */
export function setMenuHost(host: ((m: OpenMenu | null) => void) | null): void {
  show = host
}

/** Opens the menu at a screen point; resolves once it closes, after any choice has run. */
export function openMenu(items: MenuItem[], x: number, y: number): Promise<void> {
  return new Promise((done) => {
    if (!show) return done() // no host mounted (a preview window): nothing to show
    show({ items, x, y, done })
  })
}
