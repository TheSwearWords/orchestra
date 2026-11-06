// C8 · The book: one project, its three areas side by side as pages of a spread. Clicking an
// area flies into its page, then opens the area's own artboard; Esc flies back out.
import { useEffect, useRef, useState } from 'react'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, type Rect } from './camera'
import { AREAS, chip, typing, type Area } from './shared'
import { AreaSwitch, Breadcrumb, Minimap, ZoomChip, type Step } from './Chrome'

const GAP = 160 // between areas, in world px

/** What an area needs to frame its board: the breadcrumb so far and the area switch. A preview
 * is the small live copy on the book's page, with no chrome. */
export interface Frame {
  crumbs: Step[]
  aside: React.ReactNode
  preview: boolean
}

interface Props {
  name: string
  area: Area | null // null: the whole book
  onArea: (a: Area | null) => void
  onStudio: () => void
  render: (a: Area, frame: Frame) => React.ReactNode
}

export function Book({ name, area, onArea, onStudio, render }: Props): React.JSX.Element {
  const cam = useCamera({ x: 0, y: 0, z: 1 })
  const { w, h } = cam.viewport
  const panels: Rect[] = AREAS.map((_, i) => ({ x: i * (w + GAP), y: 0, w, h }))
  const whole: Rect = { x: -GAP / 2, y: -GAP / 2, w: 3 * w + 2 * GAP + GAP, h: h + GAP }
  const page = (a: Area): ReturnType<typeof fit> => ({
    x: panels[AREAS.findIndex((x) => x.id === a)].x,
    y: 0,
    z: 1
  })
  const overview = (): ReturnType<typeof fit> => fit(whole, w, h, 40, 1)

  // the area whose board is open; it lags `area` while the camera flies in
  const [open, setOpen] = useState<Area | null>(area)
  const first = useRef(true)
  useEffect(() => {
    first.current = false
    cam.set(area ? page(area) : overview())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- where the book opens, once
  }, [])

  /** Moves between the book and its areas: flies into a page before its board opens, and
   * out from the page when a board closes. */
  function go(a: Area | null): void {
    onArea(a)
    if (a && open) return setOpen(a) // switching areas: straight to the other board
    if (a) return void cam.fly(page(a), 420).then(() => setOpen(a))
    if (!open) return
    cam.set(page(open))
    setOpen(null)
    void cam.fly(overview())
  }

  // a resized window refits the book view
  useEffect(() => {
    if (!first.current && !open) cam.set(overview())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit on size only
  }, [w, h])

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (typing(e)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (area) go(null)
        else onStudio()
      }
      const n = ['1', '2', '3'].indexOf(e.key)
      if (n >= 0) go(AREAS[n].id)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  const base: Step[] = [
    { label: 'Studio', onClick: onStudio },
    { label: name, onClick: () => go(null) }
  ]
  const current = AREAS.find((a) => a.id === open)
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0" style={{ visibility: open ? 'hidden' : 'visible' }}>
        <Canvas
          cam={cam}
          onBackground={() => go(null)}
          chrome={
            <>
              <div className="absolute top-3.5 left-3.5 flex gap-2.5">
                <Breadcrumb steps={[base[0], { label: name }]} />
                <AreaSwitch current={area} onGo={go} />
              </div>
              <div className="absolute top-3.5 right-3.5">
                <ZoomChip
                  camera={cam.camera}
                  viewport={cam.viewport}
                  onZoom={(c) => void cam.fly(c, 200)}
                  note="whole book"
                />
              </div>
              <p className="pointer-events-none absolute bottom-5 left-5 font-mono text-[12px] text-dim">
                Click an area to fly in · 1 / 2 / 3 jump straight there · Esc closes the book
              </p>
              <div className="absolute right-3.5 bottom-3.5">
                <Minimap
                  label="Book"
                  blocks={panels}
                  camera={cam.camera}
                  viewport={cam.viewport}
                  onMove={cam.set}
                />
              </div>
            </>
          }
        >
          {/* the spine, down the left of the spread */}
          <span
            aria-hidden
            className="absolute bg-brand"
            style={{ left: -GAP / 2 - 24, top: -GAP / 2, width: 24, height: h + GAP }}
          />
          {AREAS.map((a, i) => {
            const p = panels[i]
            return (
              <section
                key={a.id}
                aria-label={`${a.numeral} ${a.name}`}
                className="absolute overflow-hidden border border-card-line shadow-card"
                style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
              >
                {/* a live, low-detail copy of the area's board; only one is mounted at a time */}
                <div inert className="pointer-events-none absolute inset-0">
                  {!open && render(a.id, { crumbs: [], aside: null, preview: true })}
                </div>
                <button
                  onClick={() => go(a.id)}
                  aria-label={`Open ${a.numeral} ${a.name}`}
                  className="group absolute inset-0 flex items-start p-16 transition-colors duration-200 ease-(--ease) hover:bg-selected"
                >
                  <span
                    className={`${chip} h-auto gap-4 px-8 py-4 ${a.id === 'create' ? 'bg-poster-dots' : ''}`}
                    style={{
                      transform: `scale(${Math.min(1.5, 1 / Math.max(cam.camera.z, 0.25))})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    <span className="font-display text-[28px] font-extrabold italic">
                      {a.numeral}
                    </span>
                    <span className="type-display-l">{a.name}</span>
                  </span>
                </button>
              </section>
            )
          })}
        </Canvas>
      </div>

      {open && current && (
        <div key={open} className="absolute inset-0">
          {render(open, {
            crumbs: [...base, { label: `${current.numeral} ${current.name}` }],
            aside: <AreaSwitch current={open} onGo={go} />,
            preview: false
          })}
        </div>
      )}
    </div>
  )
}
