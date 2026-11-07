import { useEffect, useRef, useState } from 'react'
import { zoomAt } from './camera'
import type { useCamera } from './useCamera'

/** Screen spacing of the dot grid: the 24px grid scaled, doubled or halved to stay readable. */
function dotSpacing(z: number): number {
  let s = 24 * z
  while (s < 14) s *= 2
  while (s > 48) s /= 2
  return s
}

interface Props {
  cam: ReturnType<typeof useCamera>
  children: React.ReactNode // the world, in world coordinates
  chrome?: React.ReactNode // floats above, in screen coordinates
  // wheel over an element matching this selector scrolls it natively instead of zooming
  scrollable?: string
  onBackground?: (e: React.MouseEvent) => void // double-click or context menu on empty board
  onContextMenu?: (e: React.MouseEvent) => void
  onPress?: () => void // a left press on empty board, e.g. to clear a selection
  className?: string
}

/** The artboard: an infinite dot grid you pan by dragging empty space (or with the middle
 * button, or holding Space) and zoom with the wheel or a pinch. */
export function Canvas({
  cam,
  children,
  chrome,
  scrollable,
  onBackground,
  onContextMenu,
  onPress,
  className = ''
}: Props): React.JSX.Element {
  const { camera, set, ref } = cam
  const live = useRef(camera)
  useEffect(() => {
    live.current = camera
  }, [camera])
  const [panning, setPanning] = useState(false)
  const space = useRef(false)

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (e.code === 'Space' && !t.closest('input, textarea, [contenteditable=true]'))
        space.current = true
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') space.current = false
    }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
    }
  }, [])

  // wheel is attached natively: React's listener is passive, so it can't stop the page zooming
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent): void => {
      // over something that can still scroll that way, the wheel scrolls it; otherwise it zooms
      if (!e.ctrlKey && scrollable) {
        for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
          if (!n.matches(scrollable)) continue
          const room =
            e.deltaY < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1
          if (n.scrollHeight > n.clientHeight && room) return
        }
      }
      e.preventDefault()
      const box = el.getBoundingClientRect()
      // pinch and ctrl+wheel send small deltas; a mouse wheel sends ~100 a notch
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      set(zoomAt(live.current, factor, e.clientX - box.left, e.clientY - box.top))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [ref, scrollable, set])

  function pointerDown(e: React.PointerEvent): void {
    const onBoard = e.target === e.currentTarget || (e.target as HTMLElement).dataset.board
    if (e.button === 0 && onBoard) onPress?.()
    if (!(e.button === 1 || (e.button === 0 && (onBoard || space.current)))) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, cam: live.current }
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    setPanning(true)
    const move = (m: PointerEvent): void =>
      set({
        ...start.cam,
        x: start.cam.x - (m.clientX - start.x) / start.cam.z,
        y: start.cam.y - (m.clientY - start.y) / start.cam.z
      })
    const up = (): void => {
      setPanning(false)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const s = dotSpacing(camera.z)
  return (
    <div
      ref={ref}
      onPointerDown={pointerDown}
      onDoubleClick={(e) => e.target === e.currentTarget && onBackground?.(e)}
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.board) return
        e.preventDefault()
        onContextMenu?.(e)
      }}
      className={`bg-dots relative h-full w-full touch-none overflow-hidden select-none ${panning ? 'cursor-grabbing' : ''} ${className}`}
      style={{
        backgroundSize: `${s}px ${s}px`,
        backgroundPosition: `${-camera.x * camera.z}px ${-camera.y * camera.z}px`
      }}
    >
      <div
        data-board
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${-camera.x * camera.z}px, ${-camera.y * camera.z}px) scale(${camera.z})`
        }}
      >
        {children}
      </div>
      {chrome}
    </div>
  )
}
