// C8 · The book: one project, its three areas side by side as pages of a spread. Choosing an
// area flies into its page, then opens the area's artboard; leaving flies back out. The area
// comes from App (so back and forward can move it); the book only plays the camera.
import { useEffect, useRef, useState } from 'react'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, type Rect } from './camera'
import { AREAS, chip, typing, type Area } from './shared'
import { AreaSwitch, Minimap, PageTurn, SIDE, Shell, ZoomChip, type Step } from './Chrome'

const GAP = 160 // between areas, in world px

/** What an area needs to frame its board: the breadcrumb so far and the pages switch. A preview
 * is the small live copy on the book's page, with no chrome. */
export interface Frame {
  crumbs: Step[]
  pages: React.ReactNode
  preview: boolean
  go?: (a: Area) => void // to another area of the book
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
  const overview = (): ReturnType<typeof fit> => fit(whole, w, h - 150, 40, 1)

  // the area whose board is showing; it lags `area` while the camera flies in
  const [open, setOpen] = useState<Area | null>(area)
  const [seen, setSeen] = useState(area)
  const [leaving, setLeaving] = useState<Area | null>(null) // the board last closed
  if (seen !== area) {
    // the area changed (here, or by back/forward): switch boards at once, or start the flight
    setSeen(area)
    if (area && open) setOpen(area)
    if (!area && open) {
      setLeaving(open)
      setOpen(null)
    }
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      cam.set(area ? page(area) : overview())
      return
    }
    if (area && !open) {
      let live = true
      void cam.fly(page(area), 420).then(() => live && setOpen(area))
      return () => {
        live = false
      }
    }
    if (!area && leaving) {
      // leaving a board: start on its page, then fly out to the whole book
      cam.set(page(leaving))
      void cam.fly(overview())
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the chosen area only
  }, [area])

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (typing(e)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (area) onArea(null)
        else onStudio()
      }
      const n = ['1', '2', '3'].indexOf(e.key)
      if (n >= 0) onArea(AREAS[n].id)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [area, onArea, onStudio])

  const base: Step[] = [
    { label: 'Studio', onClick: onStudio },
    { label: name, onClick: () => onArea(null) }
  ]
  const current = AREAS.find((a) => a.id === open)
  const pages = (on: Area | null): React.ReactNode => <AreaSwitch current={on} onGo={onArea} />
  return (
    <div
      className="relative h-full w-full"
      style={open ? ({ '--side': `${SIDE}px` } as React.CSSProperties) : undefined}
    >
      <div className="absolute inset-0" style={{ visibility: open ? 'hidden' : 'visible' }}>
        <Canvas
          cam={cam}
          content={open ? undefined : () => ({ all: whole })}
          onBackground={() => onArea(null)}
          chrome={
            <Shell
              crumbs={[base[0], { label: name }]}
              right={
                <ZoomChip
                  camera={cam.camera}
                  viewport={cam.viewport}
                  onZoom={(c) => void cam.fly(c, 200)}
                  note="whole book"
                />
              }
              pages={pages(area)}
              minimap={
                <Minimap
                  label="Book"
                  blocks={panels.map((p, i) => ({ ...p, name: AREAS[i].numeral }))}
                  camera={cam.camera}
                  viewport={cam.viewport}
                  onMove={cam.set}
                />
              }
            />
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
                {/* a live, low-detail copy of the area's board; only while no board is open */}
                <div inert className="pointer-events-none absolute inset-0">
                  {!open && render(a.id, { crumbs: [], pages: null, preview: true })}
                </div>
                <button
                  onClick={() => onArea(a.id)}
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
            pages: pages(open),
            preview: false,
            go: onArea
          })}
        </div>
      )}
      {open && (
        <>
          <PageTurn side="left" to={AREAS[AREAS.indexOf(current!) - 1]} onGo={onArea} />
          <PageTurn side="right" to={AREAS[AREAS.indexOf(current!) + 1]} onGo={onArea} />
        </>
      )}
    </div>
  )
}
