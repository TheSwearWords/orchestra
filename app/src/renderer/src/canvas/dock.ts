// What the session dock shows, as plain logic (the dock itself is SessionDock.tsx): one dot per
// deliverable agent, with its Instruments rolled into it.

export type DockStatus = 'needs-you' | 'error' | 'working' | 'done' | 'idle'

export interface DockAgent {
  id: string
  name: string
  status: DockStatus
}

// most urgent first: when a Musician and its Instruments differ, the first of these wins
const URGENCY: DockStatus[] = ['needs-you', 'error', 'working', 'done', 'idle']

const STATUS: Record<string, DockStatus> = {
  waiting: 'needs-you',
  error: 'error',
  working: 'working',
  done: 'done',
  stopped: 'idle'
}

/** An agent's saved status as the dock shows it. */
export function dockStatus(status: string | undefined): DockStatus {
  // shortcut: a status the dock doesn't know reads as idle; upgrade when one is added
  return (status && STATUS[status]) || 'idle'
}

/** A Musician is in the dock if it is selected in the project or has a state of its own or of
 * one of its Instruments (keys are `musician` or `musician--instrument`). */
export function dockAgents(
  musicians: { id: string; name: string }[],
  selected: string[],
  states: Record<string, { status: string }>
): DockAgent[] {
  const byMusician = new Map<string, DockStatus[]>()
  for (const [key, s] of Object.entries(states)) {
    const id = key.split('--')[0]
    byMusician.set(id, [...(byMusician.get(id) ?? []), dockStatus(s.status)])
  }
  return musicians
    .filter((m) => selected.includes(m.id) || byMusician.has(m.id))
    .map((m) => {
      const all = byMusician.get(m.id) ?? []
      return { id: m.id, name: m.name, status: URGENCY.find((u) => all.includes(u)) ?? 'idle' }
    })
}

export const STATUS_WORDS: Record<DockStatus, string> = {
  'needs-you': 'Waiting on you',
  error: 'Stopped on an error',
  working: 'Working',
  done: 'Done',
  idle: 'Idle'
}

/** What each Musician was last seen doing: its own latest log line, or one of its Instruments'. */
export function latestNotes(log: { agent: string; text: string }[]): Record<string, string> {
  const notes: Record<string, string> = {}
  for (const e of log) {
    const text = e.text.trim().split('\n')[0]
    if (text && e.agent !== 'orchestrator') notes[e.agent.split('--')[0]] = text
  }
  return notes
}
