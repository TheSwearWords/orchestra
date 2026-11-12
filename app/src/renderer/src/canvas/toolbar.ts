// The tools an area offers for making new windows, like Figma's toolbar. The area that is open
// registers them; the Orchestrator bar draws them in a row under its text box.
import { useEffect, useSyncExternalStore } from 'react'

export interface Tool {
  id: string
  label: string // what it makes, in plain words
  icon: string // a bundled Remix icon name
  run: () => void
}

let tools: Tool[] = []
const listeners = new Set<() => void>()

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** The open area's tools, for the bar. */
export function useTools(): Tool[] {
  return useSyncExternalStore(subscribe, () => tools)
}

/** Offers these tools while the calling screen is mounted (and `on`). */
export function useToolbar(list: Tool[], on = true): void {
  // the list is rebuilt on every render, so it is compared by what it offers; callers keep each
  // tool's action current themselves (Research reads its actions through a ref)
  const key = on ? list.map((t) => t.id).join('|') : ''
  const latest = list
  useEffect(() => {
    if (!key) return undefined
    tools = latest
    listeners.forEach((l) => l())
    return () => {
      if (tools === latest) tools = []
      listeners.forEach((l) => l())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-register when the set changes
  }, [key])
}
