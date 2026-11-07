// Slash commands in the Orchestrator bar: type "/" and pick where to go or what to open.
// Pure matching, so it is tested in node; App decides which commands exist where you are.

export interface Command {
  id: string // what you type after the slash, e.g. "agents"
  label: string
  hint: string
}

/** The commands a "/…" draft could mean: the ones starting with it first, then any whose name
 * or label contains it. Anything that isn't a slash command matches nothing. */
export function matchCommands<T extends Command>(text: string, all: T[]): T[] {
  const m = /^\/(\S*)$/.exec(text.trim())
  if (!m) return []
  const q = m[1].toLowerCase()
  const starts = all.filter((c) => c.id.startsWith(q))
  const rest = all.filter(
    (c) => !starts.includes(c) && (c.id.includes(q) || c.label.toLowerCase().includes(q))
  )
  return [...starts, ...rest]
}
