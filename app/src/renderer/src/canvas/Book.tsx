// C8 · The book: one project, its three areas side by side on one board. Zoomed out it is the
// project's front page; each area flies in to full size and works as before.
import { useEffect, useRef } from 'react'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, type Rect } from './camera'
import { AREAS, chip, typing, type Area } from './board'
import { AreaSwitch, Breadcrumb, Minimap, ZoomChip } from './Chrome'

const GAP = 160 // between areas, in world px
const CHROME_TOP = 74 // the breadcrumb row: 14 inset + 46 chip + 14

interface Props {
  name: string
  area: Area | null // null: the whole book
  onArea: (a: Area | null) => void
  onStudio: () => void
  render: (a: Area) => React.ReactNode
}

export function Book({ name, area, onArea, onStudio, render }: Props): React.JSX.Element {
  const cam = useCamera({ x: 0, y: 0, z: 1 })
  const { w, h } = cam.viewport
  const panels: Rect[] = AREAS.map((_, i) => ({ x: i * (w + GAP), y: 0, w, h }))
  const whole: Rect = { x: -GAP / 2, y: -GAP / 2, w: 3 * w + 2 * GAP + GAP, h: h + GAP }
  const target = (a: Area | null): ReturnType<typeof fit> =>
    a ? { x: panels[AREAS.findIndex((x) => x.id === a)].x, y: 0, z: 1 } : fit(whole, w, h, 40, 1)

  // first frame lands without travel; after that, moving between levels flies
  const first = useRef(true)
  const size = useRef({ w, h })
  useEffect(() => {
    const resized = size.current.w !== w || size.current.h !== h
    size.current = { w, h }
    if (first.current || resized) {
      first.current = false
      cam.set(target(area))
    } else void cam.fly(target(area))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target follows area and size
  }, [area, w, h])

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

  const current = AREAS.find((a) => a.id === area)
  return (
    <Canvas
      cam={cam}
      scrollable="[data-area-live]"
      onBackground={() => onArea(null)}
      chrome={
        <>
          <div className="absolute top-3.5 left-3.5 flex gap-2.5">
            <Breadcrumb
              steps={[
                { label: 'Studio', onClick: onStudio },
                { label: name, onClick: () => onArea(null) },
                ...(current ? [{ label: `${current.numeral} ${current.name}` }] : [])
              ]}
            />
            <AreaSwitch current={area} onGo={onArea} />
          </div>
          <div className="absolute top-3.5 right-3.5 flex items-start gap-2.5">
            {/* inside an area the minimap moves up here, so it never covers the area's own
                bottom bar (Create's Continue); shortcut: back to the corner once areas are boards */}
            {area && (
              <Minimap
                compact
                label={`${current!.numeral} · ${current!.name}`}
                blocks={panels.map((p, i) => ({ ...p, on: AREAS[i].id === area }))}
                camera={cam.camera}
                viewport={cam.viewport}
                onMove={cam.set}
              />
            )}
            <ZoomChip
              camera={cam.camera}
              viewport={cam.viewport}
              onZoom={(c) => void cam.fly(c, 200)}
              note={area ? undefined : 'whole book'}
            />
          </div>
          {!area && (
            <p className="pointer-events-none absolute bottom-5 left-5 font-mono text-[12px] text-dim">
              Click an area to fly in · 1 / 2 / 3 jump straight there · Esc closes the book
            </p>
          )}
          {!area && (
            <div className="absolute right-3.5 bottom-3.5">
              <Minimap
                label="Book"
                blocks={panels}
                camera={cam.camera}
                viewport={cam.viewport}
                onMove={cam.set}
              />
            </div>
          )}
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
        const live = a.id === area
        const p = panels[i]
        return (
          <section
            key={a.id}
            aria-label={`${a.numeral} ${a.name}`}
            {...(live ? { 'data-area-live': '' } : {})}
            className="absolute flex flex-col overflow-hidden border border-card-line bg-card shadow-card"
            style={{ left: p.x, top: p.y, width: p.w, height: p.h }}
          >
            <div
              inert={!live}
              className="flex min-h-0 flex-1 flex-col"
              style={{ paddingTop: CHROME_TOP }}
            >
              {render(a.id)}
            </div>
            {!live && (
              <button
                onClick={() => onArea(a.id)}
                aria-label={`Open ${a.numeral} ${a.name}`}
                className="group absolute inset-0 flex items-start p-16 transition-colors duration-200 ease-(--ease) hover:bg-selected"
              >
                <span
                  className={`${chip} h-auto gap-4 px-8 py-4 ${a.id === 'create' ? 'bg-poster-dots' : ''}`}
                  style={{
                    transform: `scale(${Math.min(2.2, 1 / Math.max(cam.camera.z, 0.25))})`,
                    transformOrigin: 'top left'
                  }}
                >
                  <span className="font-display text-[28px] font-extrabold italic">
                    {a.numeral}
                  </span>
                  <span className="type-display-l">{a.name}</span>
                </span>
              </button>
            )}
          </section>
        )
      })}
    </Canvas>
  )
}
