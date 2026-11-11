// The Orchestrator's face, wherever it appears (the bar, the session dock): the live liquid
// bead from liquid.ts, or a flat orb in the state's colour when WebGL2 isn't there.
import { useEffect, useRef, useState } from 'react'
import { BLEED, Liquid, type FaceState } from './liquid'

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
// the flat fallback's light, from the same set the rest of the app uses
const FLAT: Partial<Record<FaceState, string>> = {
  needs: 'orb-peach',
  done: 'orb-green',
  thinking: 'orb-lilac'
}

export function OrchestratorFace({
  size,
  state
}: {
  size: number
  state: FaceState
}): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null)
  const liquid = useRef<Liquid | null>(null)
  const [flat, setFlat] = useState(false)
  const first = useRef(state)

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return undefined
    const lost = (): void => setFlat(true)
    try {
      liquid.current = new Liquid(cv, size, first.current)
    } catch {
      // no WebGL2, or the shader would not build: the flat orb stands in
      lost()
      return undefined
    }
    cv.addEventListener('webglcontextlost', lost)
    return () => {
      cv.removeEventListener('webglcontextlost', lost)
      liquid.current?.dispose()
      liquid.current = null
    }
  }, [size])

  useEffect(() => liquid.current?.setState(state), [state])

  const bleed = (size * (BLEED - 1)) / 2
  return (
    <span
      role="img"
      aria-label={`Orchestrator: ${WORDS[state]}`}
      className="relative block shrink-0"
      style={{ width: size, height: size }}
    >
      {flat ? (
        <span
          className={`orb ${FLAT[state] ?? 'orb-blue'} absolute inset-0 bg-brand ${state === 'error' ? 'grayscale' : ''}`}
        />
      ) : (
        <canvas
          ref={canvas}
          aria-hidden
          className="pointer-events-none absolute max-w-none"
          style={{ width: size * BLEED, height: size * BLEED, left: -bleed, top: -bleed }}
        />
      )}
    </span>
  )
}
