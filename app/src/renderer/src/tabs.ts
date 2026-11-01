// Open projects as tabs, shown in one pane or two side by side. Pure functions over a small
// state object, so the rules (what a pane shows after a close, when a split ends) are tested.

export interface Tabs {
  open: string[] // project ids, in tab order
  panes: string[] // the project each pane shows: one pane, or two when split
  focus: number // the pane that tab clicks go to
}

export const EMPTY: Tabs = { open: [], panes: [], focus: 0 }

const shown = (t: Tabs): string | undefined => t.panes[t.focus]

/** Opens a project as a tab (or finds its tab) and shows it in the focused pane. */
export function openTab(t: Tabs, id: string): Tabs {
  const open = t.open.includes(id) ? t.open : [...t.open, id]
  if (t.panes.length === 0) return { open, panes: [id], focus: 0 }
  const panes = t.panes.map((p, i) => (i === t.focus ? id : p))
  // the same project in both panes adds nothing; collapse to one
  if (panes.length === 2 && panes[0] === panes[1]) return { open, panes: [id], focus: 0 }
  return { open, panes, focus: t.focus }
}

/** Shows a project in the other pane, splitting if needed, and focuses it. */
export function openToSide(t: Tabs, id: string): Tabs {
  const open = t.open.includes(id) ? t.open : [...t.open, id]
  if (t.panes.length === 0) return { open, panes: [id], focus: 0 }
  if (t.panes.length === 1) {
    return t.panes[0] === id ? { ...t, open } : { open, panes: [t.panes[0], id], focus: 1 }
  }
  return openTab({ ...t, open, focus: 1 - t.focus }, id)
}

/** Moves a tab to where another tab is: after it when moving right, before it when moving left. */
export function moveTab(t: Tabs, id: string, onto: string): Tabs {
  const from = t.open.indexOf(id)
  const to = t.open.indexOf(onto)
  if (from === -1 || to === -1 || from === to) return t
  const open = t.open.filter((o) => o !== id)
  // after removing the moved tab, index `to` is just past the other tab when moving right,
  // and right on it when moving left
  open.splice(to, 0, id)
  return { ...t, open }
}

/** Ends the split, keeping the given pane. */
export function unsplit(t: Tabs, keep: number): Tabs {
  if (t.panes.length !== 2) return t
  return { ...t, panes: [t.panes[keep]], focus: 0 }
}

/** Closes a tab. A pane that showed it moves to a neighbouring tab, or closes if none is free. */
export function closeTab(t: Tabs, id: string): Tabs {
  const at = t.open.indexOf(id)
  if (at === -1) return t
  const open = t.open.filter((o) => o !== id)
  let panes = [...t.panes]
  let focus = t.focus
  for (let i = 0; i < panes.length; i++) {
    if (panes[i] !== id) continue
    const taken = panes.filter((_, j) => j !== i)
    // prefer the tab that slid into its place, then the one before it
    const next = [open[at], open[at - 1], ...open].find((o) => o && !taken.includes(o))
    if (next) panes[i] = next
    else {
      panes = taken
      focus = 0
    }
  }
  return { open, panes, focus: Math.min(focus, Math.max(panes.length - 1, 0)) }
}

/** Drops projects that no longer exist (deleted, maybe in another window). */
export function prune(t: Tabs, exists: (id: string) => boolean): Tabs {
  return t.open.filter((id) => !exists(id)).reduce(closeTab, t)
}

export const focused = shown
