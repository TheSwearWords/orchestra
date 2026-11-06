import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { reducedMotion } from './shared'
import { ease, lerpCamera, type Camera } from './camera'

/** A camera you can set directly (pan, zoom) or fly (eased, 550ms by default). */
export function useCamera(initial: Camera): {
  camera: Camera
  set: (c: Camera) => void
  fly: (to: Camera, ms?: number) => Promise<void>
  viewport: { w: number; h: number }
  ref: React.RefObject<HTMLDivElement | null>
} {
  const [camera, setCamera] = useState(initial)
  const current = useRef(initial)
  const frame = useRef(0)
  const ref = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: innerWidth, h: innerHeight })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) =>
      setViewport({ w: e.contentRect.width, h: e.contentRect.height })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const set = useCallback((c: Camera) => {
    cancelAnimationFrame(frame.current)
    current.current = c
    setCamera(c)
  }, [])

  const fly = useCallback(
    (to: Camera, ms = 550) =>
      new Promise<void>((done) => {
        cancelAnimationFrame(frame.current)
        const from = current.current
        const box = ref.current?.getBoundingClientRect()
        const w = box?.width ?? innerWidth
        const h = box?.height ?? innerHeight
        // reduced motion: no camera travel, the view just changes
        if (reducedMotion() || ms <= 0) {
          current.current = to
          setCamera(to)
          return done()
        }
        const start = performance.now()
        const step = (now: number): void => {
          const t = Math.min(1, (now - start) / ms)
          const c = t === 1 ? to : lerpCamera(from, to, ease(t), w, h)
          current.current = c
          setCamera(c)
          if (t < 1) frame.current = requestAnimationFrame(step)
          else done()
        }
        frame.current = requestAnimationFrame(step)
      }),
    []
  )

  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  return { camera, set, fly, viewport, ref }
}
