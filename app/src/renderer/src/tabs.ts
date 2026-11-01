// Open projects as tabs. Splitting two tabs makes a group: the pair shows side by side whenever
// one of them is clicked, and any other tab shows alone, leaving the group as it was. Pure
// functions over a small state object, so these rules are tested.

export interface Tabs {
  open: string[] // project ids, in tab order
  panes: string[] // what's on screen: one project, or a group's two side by side
  focus: number // the pane that tab clicks and typing go to
  pairs?: [string, string][] // split groups, left then right; a tab is in at most one
}

export const EMPTY: Tabs = { open: [], panes: [], focus: 0, pairs: [] }

/** The split groups. State saved before groups existed counts an on-screen split as one. */
export function pairsOf(t: Tabs): [string, string][] {
  return t.pairs ?? (t.panes.length === 2 ? [[t.panes[0], t.panes[1]]] : [])
}

const groupOf = (t: Tabs, id: string): [string, string] | undefined =>
  pairsOf(t).find((p) => p.includes(id))

/** Opens a project as a tab (or finds its tab) and shows it: with its group if it has one,
 * otherwise alone. Showing a lone tab never breaks up a group. */
export function openTab(t: Tabs, id: string): Tabs {
  const open = t.open.includes(id) ? t.open : [...t.open, id]
  const pairs = pairsOf(t)
  const group = groupOf(t, id)
  return group
    ? { open, panes: [...group], focus: group.indexOf(id), pairs }
    : { open, panes: [id], focus: 0, pairs }
}

/** Splits a tab beside the one on screen, making them a group; the new tab gets the focus.
 * Either tab leaves any group it was in. */
export function openToSide(t: Tabs, id: string): Tabs {
  const current = t.panes[t.focus]
  if (!current || current === id) return openTab(t, id)
  const open = t.open.includes(id) ? t.open : [...t.open, id]
  const pairs = pairsOf(t).filter((p) => !p.includes(current) && !p.includes(id))
  const pair: [string, string] = [current, id]
  return { open, panes: [...pair], focus: 1, pairs: [...pairs, pair] }
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

/** Ends the group on screen, keeping the given pane's tab. */
export function unsplit(t: Tabs, keep: number): Tabs {
  if (t.panes.length !== 2) return t
  const [a, b] = t.panes
  const pairs = pairsOf(t).filter((p) => !(p.includes(a) && p.includes(b)))
  return { ...t, panes: [t.panes[keep]], focus: 0, pairs }
}

/** Ends the group a tab is in, on screen or not. If the group was showing, that tab stays. */
export function ungroup(t: Tabs, id: string): Tabs {
  const group = groupOf(t, id)
  if (!group) return t
  const pairs = pairsOf(t).filter((p) => p !== group)
  const showing = t.panes.length === 2 && group.every((g) => t.panes.includes(g))
  return showing ? { ...t, panes: [id], focus: 0, pairs } : { ...t, pairs }
}

/** Closes a tab. Its group ends; if it was on screen, its partner stays alone, or a lone tab
 * gives way to the tab that slid into its place (or the one before it). */
export function closeTab(t: Tabs, id: string): Tabs {
  const at = t.open.indexOf(id)
  if (at === -1) return t
  const open = t.open.filter((o) => o !== id)
  const pairs = pairsOf(t).filter((p) => !p.includes(id))
  const rest: Tabs = { ...t, open, pairs }
  if (!t.panes.includes(id)) return rest
  if (t.panes.length === 2) return { ...rest, panes: t.panes.filter((p) => p !== id), focus: 0 }
  const next = open[at] ?? open[at - 1]
  return next ? openTab(rest, next) : { ...rest, panes: [], focus: 0 }
}

/** Drops projects that no longer exist (deleted, maybe in another window). */
export function prune(t: Tabs, exists: (id: string) => boolean): Tabs {
  return t.open.filter((id) => !exists(id)).reduce(closeTab, t)
}

export const focused = (t: Tabs): string | undefined => t.panes[t.focus]
