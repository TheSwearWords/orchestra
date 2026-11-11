// The Orchestrator's face, wherever it appears (the bar, the session dock): a glowing sphere
// whose colour says what is happening. Plain CSS (the `face-orb` class in nocturne.css), so it
// costs nothing while the board moves.
import type { FaceState } from './faceState'

const WORDS: Record<FaceState, string> = {
  idle: 'waiting',
  listening: 'listening',
  sent: 'got your message',
  thinking: 'thinking',
  working: 'agents are working',
  needs: 'needs you',
  done: 'done',
  error: 'something failed'
}

export function OrchestratorFace({
  size,
  state
}: {
  size: number
  state: FaceState
}): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={`Orchestrator: ${WORDS[state]}`}
      data-state={state}
      className="face-orb block shrink-0 rounded-full bg-brand"
      style={{ width: size, height: size }}
    />
  )
}
