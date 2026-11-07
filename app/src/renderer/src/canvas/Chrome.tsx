// Floating chrome (brand spec §5.2): sharp white chips that sit above the board.
import { Icon } from '../components/Icon'
import { AREAS, TOP_BAR, chip, type Area } from './shared'
import { clampZoom, type Camera, type Rect } from './camera'

export type Step = { label: string; onClick?: () => void }

/** Every screen's frame: the breadcrumb across the top (with the screen's own controls on its
 * right), the pages bottom left and the minimap bottom right. The Orchestrator bar and the
 * back button belong to the whole window, so App draws them. */
export function Shell({
  crumbs,
  right,
  pages,
  minimap,
  children
}: {
  crumbs: Step[]
  right?: React.ReactNode
  pages?: React.ReactNode
  minimap?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <header
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 border-b border-chip-line bg-chip pr-2 pl-2 shadow-float"
        style={{ height: TOP_BAR }}
      >
        <Breadcrumb steps={crumbs} />
        <div className="flex items-center gap-2">{right}</div>
      </header>
      {pages && <div className="absolute bottom-3.5 left-3.5 z-20">{pages}</div>}
      {minimap && <div className="absolute right-3.5 bottom-3.5 z-20">{minimap}</div>}
      {children}
    </>
  )
}

/** A control inside the top bar: a hairline box, not a floating chip. */
export const barButton =
  'serif-on flex h-9 items-center border border-chip-line px-3.5 type-label-s text-link hover:bg-selected'

/** Where you are, as steps; clicking an earlier step zooms back out to it. */
export function Breadcrumb({ steps }: { steps: Step[] }): React.JSX.Element {
  return (
    <nav aria-label="Where you are" className="flex min-w-0 items-center gap-3 text-link">
      <span className="flex size-8 items-center justify-center rounded-full bg-brand text-on-brand">
        <Icon name="logo-mark" size={20} />
      </span>
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <span key={i} className="flex items-center gap-3">
            {i > 0 && <span className="font-mono text-[13px] text-link/35">/</span>}
            {last ? (
              <span aria-current="location" className="type-heading-m whitespace-nowrap">
                {s.label}
              </span>
            ) : (
              <button
                onClick={s.onClick}
                className="serif-on min-h-8 type-label-s whitespace-nowrap text-dim hover:text-link"
              >
                {s.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

/** I / II / III: the current area is a blue cell with its name; the others only a numeral. */
export function AreaSwitch({
  current,
  onGo
}: {
  current: Area | null
  onGo: (a: Area) => void
}): React.JSX.Element {
  return (
    <div role="tablist" aria-label="Movements" className={`${chip} items-stretch`}>
      {AREAS.map((a) => {
        const on = a.id === current
        return (
          <button
            key={a.id}
            role="tab"
            aria-selected={on}
            title={`${a.numeral} · ${a.name} (${AREAS.indexOf(a) + 1})`}
            onClick={() => onGo(a.id)}
            className={`flex min-w-[46px] items-center justify-center gap-2 px-3 transition-colors duration-200 ease-(--ease) ${
              on ? 'bg-poster-dots' : 'hover:bg-selected'
            } ${AREAS.indexOf(a) > 0 ? 'border-l border-chip-line' : ''}`}
          >
            <span className="font-display text-[15px] font-extrabold italic">{a.numeral}</span>
            {on && <span className="type-label-serif-l">{a.name}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** − 64% +, zooming about the viewport centre. */
export function ZoomChip({
  camera,
  viewport,
  onZoom,
  note
}: {
  camera: Camera
  viewport: { w: number; h: number }
  onZoom: (c: Camera) => void
  note?: string
}): React.JSX.Element {
  const by = (f: number): void => {
    const z = clampZoom(camera.z * f)
    const cx = camera.x + viewport.w / 2 / camera.z
    const cy = camera.y + viewport.h / 2 / camera.z
    onZoom({ x: cx - viewport.w / 2 / z, y: cy - viewport.h / 2 / z, z })
  }
  const btn = 'flex h-full w-9 items-center justify-center hover:bg-selected'
  return (
    <div className="flex h-9 items-stretch border border-chip-line type-caption text-link">
      <button aria-label="Zoom out" className={btn} onClick={() => by(1 / 1.25)}>
        −
      </button>
      <span className="flex min-w-12 items-center justify-center tabular-nums">
        {Math.round(camera.z * 100)}%{note && <span className="text-dim"> · {note}</span>}
      </span>
      <button aria-label="Zoom in" className={btn} onClick={() => by(1.25)}>
        +
      </button>
    </div>
  )
}

/** The canvas in miniature: blocks for what's on it, a box for your view. Click or drag to move. */
export function Minimap({
  label,
  blocks,
  camera,
  viewport,
  onMove,
  compact
}: {
  label: string
  blocks: (Rect & { on?: boolean; name?: string })[]
  camera: Camera
  viewport: { w: number; h: number }
  onMove: (c: Camera) => void
  compact?: boolean // one chip high, label beside the map, for the top row
}): React.JSX.Element | null {
  if (blocks.length === 0) return null
  const view = {
    x: camera.x,
    y: camera.y,
    w: viewport.w / camera.z,
    h: viewport.h / camera.z
  }
  // bounds: everything on the board plus where you are
  const all = [...blocks, view]
  const x0 = Math.min(...all.map((b) => b.x))
  const y0 = Math.min(...all.map((b) => b.y))
  const x1 = Math.max(...all.map((b) => b.x + b.w))
  const y1 = Math.max(...all.map((b) => b.y + b.h))
  const W = compact ? 84 : 132
  const k = Math.min(W / (x1 - x0), (compact ? 26 : 96) / (y1 - y0))
  const H = (y1 - y0) * k
  const box = (r: Rect): React.CSSProperties => ({
    left: (r.x - x0) * k,
    top: (r.y - y0) * k,
    width: r.w * k,
    height: r.h * k
  })

  function point(e: React.PointerEvent<HTMLDivElement>): void {
    const r = e.currentTarget.getBoundingClientRect()
    const wx = x0 + (e.clientX - r.left) / k
    const wy = y0 + (e.clientY - r.top) / k
    onMove({ ...camera, x: wx - view.w / 2, y: wy - view.h / 2 })
  }

  return (
    <div
      className={`${chip} hidden items-stretch min-[900px]:flex ${compact ? '' : 'h-auto flex-col'}`}
    >
      <span
        className={`px-2.5 type-label-mono ${compact ? 'flex items-center border-r border-hair' : 'border-b border-hair py-1'}`}
      >
        {label}
      </span>
      <div className={compact ? 'flex items-center px-2.5' : 'p-2.5'}>
        <div
          className="relative cursor-pointer"
          style={{ width: W, height: H }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            point(e)
          }}
          onPointerMove={(e) => e.buttons === 1 && point(e)}
        >
          {blocks.map((b, i) => (
            <span
              key={i}
              className={`absolute ${b.on ? 'bg-brand text-on-brand' : 'bg-brand/20 text-link'}`}
              style={box(b)}
            >
              {b.name && (
                <span className="absolute top-0.5 left-1 font-mono text-[9px] leading-none">
                  {b.name}
                </span>
              )}
            </span>
          ))}
          <span className="absolute border-[1.5px] border-brand" style={box(view)} />
        </div>
      </div>
    </div>
  )
}
