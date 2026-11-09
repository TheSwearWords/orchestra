import { useEffect, useRef, useState } from 'react'
import { MAX_ZOOM, wheelCamera, zoomAt, type Rect } from './camera'
import { fitBelow, typing } from './shared'
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
  content?: () => { all: Rect; selected?: Rect } // gives this board the zoom shortcuts
  onMarquee?: (r: Rect) => void // dragging empty board draws a selection box instead of panning
  className?: string
}

/** The artboard, with Figma's controls: the wheel pans (shift for sideways), ctrl+wheel or a
 * pinch zooms at the pointer, the middle button or Space+drag pans. Dragging empty space draws
 * a selection box on boards that have selection, and pans on those that don't. Keys: + and - zoom, ctrl or shift+0 is 100%,
 * shift+1 fits everything, shift+2 fits the selection. */
export function Canvas({
  cam,
  children,
  chrome,
  scrollable,
  onBackground,
  onContextMenu,
  onPress,
  content,
  onMarquee,
  className = ''
}: Props): React.JSX.Element {
  const { camera, set, fly, viewport, ref } = cam
  const live = useRef(camera)
  useEffect(() => {
    live.current = camera
  }, [camera])
  const [panning, setPanning] = useState(false)
  const space = useRef(false)
  const [hand, setHand] = useState(false) // Space held: the cursor says the board will pan
  const [box, setBox] = useState<Rect | null>(null) // the selection box being drawn, on screen

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (e.code === 'Space' && !t.closest('input, textarea, [contenteditable=true]')) {
        space.current = true
        setHand(true)
      }
    }
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        space.current = false
        setHand(false)
      }
    }
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    return () => {
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    if (!content) return
    const key = (e: KeyboardEvent): void => {
      if (typing(e)) return
      const zoom = (f: number): void =>
        void fly(zoomAt(live.current, f, viewport.w / 2, viewport.h / 2), 200)
      const code = e.code
      if (code === 'Equal' || code === 'NumpadAdd') zoom(2)
      else if (code === 'Minus' || code === 'NumpadSubtract') zoom(1 / 2)
      else if (code === 'Digit0' && (e.ctrlKey || e.metaKey || e.shiftKey)) zoom(1 / live.current.z)
      else if (code === 'Digit1' && e.shiftKey) void fly(fitBelow(content().all, MAX_ZOOM), 200)
      else if (code === 'Digit2' && e.shiftKey) {
        const r = content().selected
        if (r) void fly(fitBelow(r, MAX_ZOOM), 200)
      } else return
      e.preventDefault()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [content, fly, viewport])

  // wheel is attached natively: React's listener is passive, so it can't stop the page zooming
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const wheel = (e: WheelEvent): void => {
      // over something that can still scroll that way, the wheel scrolls it; otherwise it moves
      // the board
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
      set(wheelCamera(live.current, e, e.clientX - box.left, e.clientY - box.top))
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [ref, scrollable, set])

  function pointerDown(e: React.PointerEvent): void {
    const onBoard = e.target === e.currentTarget || (e.target as HTMLElement).dataset.board
    if (e.button === 0 && onBoard) onPress?.()
    if (e.button === 0 && onBoard && !space.current && onMarquee) {
      e.preventDefault()
      const root = e.currentTarget as HTMLElement
      root.setPointerCapture(e.pointerId)
      const at = root.getBoundingClientRect()
      const sx = e.clientX - at.left
      const sy = e.clientY - at.top
      const move = (m: PointerEvent): void => {
        const mx = m.clientX - at.left
        const my = m.clientY - at.top
        const r = {
          x: Math.min(sx, mx),
          y: Math.min(sy, my),
          w: Math.abs(mx - sx),
          h: Math.abs(my - sy)
        }
        setBox(r)
        const { x, y, z } = live.current
        onMarquee({ x: x + r.x / z, y: y + r.y / z, w: r.w / z, h: r.h / z })
      }
      const up = (): void => {
        setBox(null)
        root.removeEventListener('pointermove', move)
        root.removeEventListener('pointerup', up)
        root.removeEventListener('pointercancel', up)
      }
      root.addEventListener('pointermove', move)
      root.addEventListener('pointerup', up)
      root.addEventListener('pointercancel', up)
      return
    }
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
      onMouseDown={(e) => e.button === 1 && e.preventDefault()} // no autoscroll on middle click
      onDoubleClick={(e) => e.target === e.currentTarget && onBackground?.(e)}
      onContextMenu={(e) => {
        if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.board) return
        e.preventDefault()
        onContextMenu?.(e)
      }}
      className={`bg-dots relative h-full w-full touch-none overflow-hidden select-none ${panning ? 'cursor-grabbing' : hand ? 'cursor-grab' : ''} ${className}`}
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
      {box && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 border border-brand bg-brand/10"
          style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
        />
      )}
      {chrome}
    </div>
  )
}
