// Floating chrome: the frosted pieces that sit above the board.
import { Icon } from '../components/Icon'
import { AREAS, TOP_BAR, chip, type Area } from './shared'
import { clampZoom, type Camera, type Rect } from './camera'
import { MODE_ICON } from './tabList'

/** Every screen's frame: the header (with the screen's own controls on its right) and the
 * minimap bottom right. The area switch is the window's, so App draws it. The Orchestrator bar and the
 * back button belong to the whole window, so App draws them. */
export function Shell({
  right,
  corner,
  minimap,
  children
}: {
  right?: React.ReactNode
  corner?: React.ReactNode // bottom left: the Studio's title
  minimap?: React.ReactNode
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <>
      <header
        className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-chip pr-2 pl-2 shadow-float glass"
        style={{ height: TOP_BAR }}
      >
        {/* App draws Home and the tabs over this side (Tabs.tsx) */}
        <span />
        <div className="flex items-center gap-2">{right}</div>
      </header>
      {corner && <div className="absolute bottom-3.5 left-3.5 z-20">{corner}</div>}
      {minimap && (
        <div className="absolute bottom-3.5 z-20" style={{ right: 14 }}>
          {minimap}
        </div>
      )}
      {children}
    </>
  )
}

/** A control inside the top bar: a hairline box, not a floating chip. */
export const barButton =
  'serif-on flex h-9 items-center border border-chip-line px-3.5 type-label-s text-link hover:bg-selected'

/** The area switch: a notch hanging from the header's bottom edge, with the book and its three
 * areas as icons. The one you are on is a chalk pill that also names it. */
export function AreaSwitch({
  current,
  onGo
}: {
  current: Area | null
  onGo: (a: Area | null) => void
}): React.JSX.Element {
  const slots: { id: Area | null; label: string; key?: number }[] = [
    { id: null, label: 'The whole book' },
    ...AREAS.map((a, i) => ({ id: a.id, label: `${a.numeral} · ${a.name}`, key: i + 1 }))
  ]
  return (
    <div
      role="tablist"
      aria-label="Areas"
      className="notch-down glass relative flex items-center gap-1 px-2 pt-1 pb-1.5"
    >
      {slots.map((s) => {
        const on = s.id === current
        return (
          <button
            key={s.id ?? 'book'}
            role="tab"
            aria-selected={on}
            aria-label={s.label}
            title={s.key ? `${s.label} (${s.key})` : s.label}
            onClick={() => onGo(s.id)}
            className={`flex h-[30px] min-w-[30px] items-center justify-center rounded-full px-[7px] duration-300 ${
              on ? 'bg-inverse text-inverse' : 'text-dim hover:bg-selected hover:text-fg'
            }`}
          >
            <Icon name={MODE_ICON[s.id ?? 'book']} size={16} />
            {/* every slot carries its label; only the current one is open, so the pill grows
                and shrinks as you move instead of jumping */}
            <span
              aria-hidden={!on}
              className="grid transition-[grid-template-columns,opacity] duration-300 ease-(--ease)"
              style={{ gridTemplateColumns: on ? '1fr' : '0fr', opacity: on ? 1 : 0 }}
            >
              <span className="overflow-hidden type-body-s font-medium whitespace-nowrap">
                <span className="pr-1.5 pl-2">{s.label}</span>
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** The button for making something new, a pill standing just above the minimap. */
export function NewCard({
  title,
  hint,
  onClick
}: {
  title: string
  hint: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      title={hint}
      className="glass absolute right-3.5 bottom-[166px] z-10 flex h-10 items-center gap-2 rounded-full border border-chip-line bg-chip pr-4 pl-3 type-label-m text-link shadow-float"
    >
      <Icon name="add-line" size={16} />
      {title}
    </button>
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
    <div className="flex h-9 items-stretch overflow-hidden rounded-full border border-chip-line type-log-s text-dim">
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
      className={`${chip} glass hidden items-stretch min-[900px]:flex ${compact ? '' : 'h-auto flex-col'}`}
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
              className={`absolute rounded-xs ${b.on ? 'bg-fg/45 text-inverse' : 'bg-fg/18 text-link'}`}
              style={box(b)}
            >
              {b.name && (
                <span className="absolute top-0.5 left-1 font-mono text-[9px] leading-none">
                  {b.name}
                </span>
              )}
            </span>
          ))}
          <span className="absolute rounded-xs border-[1.5px] border-focus" style={box(view)} />
        </div>
      </div>
    </div>
  )
}
