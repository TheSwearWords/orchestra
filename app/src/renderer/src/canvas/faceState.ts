// Which state the Orchestrator's face is in. The bar and the session dock each know part of the
// story (typing, sending, answering; agents working, things waiting on you), so they report
// what they know here and every face reads the same answer.
import { useSyncExternalStore } from 'react'

export type FaceState =
  'idle' | 'listening' | 'sent' | 'thinking' | 'working' | 'needs' | 'done' | 'error'

export interface Signals {
  typing: boolean // the bar has a message being written
  sentAt: number // when the last message was sent
  busy: boolean // the Orchestrator is answering
  error: boolean // the bar is showing a failure
  working: number // Musicians working
  needs: number // things waiting on the user
  doneAt: number // when a Musician last finished
}

export const SENT_MS = 1600
export const DONE_MS = 3000

/** The one state to show, most pressing first. */
export function pickFace(s: Signals, now: number): FaceState {
  if (s.error) return 'error'
  if (s.needs > 0) return 'needs'
  if (now - s.sentAt < SENT_MS) return 'sent'
  if (s.working > 0) return 'working'
  if (s.busy) return 'thinking'
  if (now - s.doneAt < DONE_MS) return 'done'
  if (s.typing) return 'listening'
  return 'idle'
}

let signals: Signals = {
  typing: false,
  sentAt: 0,
  busy: false,
  error: false,
  working: 0,
  needs: 0,
  doneAt: 0
}
const listeners = new Set<() => void>()
const tell = (): void => listeners.forEach((l) => l())

/** Report what changed. Sent and Done end on their own, so the faces are told again then. */
export function signal(part: Partial<Signals>): void {
  signals = { ...signals, ...part }
  tell()
  if (part.sentAt) setTimeout(tell, SENT_MS + 20)
  if (part.doneAt) setTimeout(tell, DONE_MS + 20)
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useFaceState(): FaceState {
  return useSyncExternalStore(subscribe, () => pickFace(signals, Date.now()))
}
