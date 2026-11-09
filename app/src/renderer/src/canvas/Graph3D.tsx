import { useEffect, useMemo, useRef, useState } from 'react'
import { label, type Graph } from './graphview'
import { findClusters, layout3d, project } from './graphspace'
import { reducedMotion } from './shared'

const TAGS = 6 // clusters named at once, biggest first
const NEIGHBOURS = 12 // named around the one you point at
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The whole knowledge graph as a turning 3D cloud, filling its positioned parent. Clusters are
 * shaded and the biggest carry a tag; pointing at a node isolates what it links to. Drag to spin;
 * click a node to trace it. `highlight` is an id prefix: those nodes stay lit. */
export function Graph3D({
  graph,
  focus,
  onPick,
  highlight
}: {
  graph: Graph
  focus?: string
  onPick?: (id: string) => void
  highlight?: string
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [flat, setFlat] = useState(false) // the 2D view
  const [frozen, setFrozen] = useState(false)
  const points = useMemo(() => layout3d(graph, 120, flat), [graph, flat])
  const view = useRef({ yaw: 0.6, pitch: -0.25, held: false, zoom: 1, px: 0, py: 0 })
  const [size, setSize] = useState({ w: 656, h: 440 })
  const [hover, setHover] = useState<string | null>(null)
  const names = useMemo(() => new Map(graph.nodes.map((n) => [n.id, label(n)])), [graph])
  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points])
  const edges = useMemo(
    () =>
      graph.links
        .map((l) => [byId.get(l.source), byId.get(l.target)] as const)
        .filter(([a, b]) => a && b),
    [graph, byId]
  )
  const groups = useMemo(() => findClusters(graph, points), [graph, points])
  const linked = useMemo(() => {
    const m = new Map<string, Set<string>>()
    const add = (a: string, b: string): void =>
      void (m.get(a) ?? m.set(a, new Set()).get(a)!).add(b)
    for (const [a, b] of edges) {
      add(a!.id, b!.id)
      add(b!.id, a!.id)
    }
    return m
  }, [edges])
  const radius = Math.min(size.w, size.h) * 0.43
  const screen = (): { id: string; sx: number; sy: number; r: number }[] =>
    points.map((p) => {
      const v = view.current
      const s = project(
        p,
        flat ? 0 : v.yaw,
        flat ? 0 : v.pitch,
        size.w / 2 + v.px,
        size.h / 2 + v.py,
        radius * v.zoom
      )
      return { id: p.id, sx: s.sx, sy: s.sy, r: (2.5 + Math.min(p.degree, 16) * 0.45) * s.scale }
    })
  const live = useRef({ focus, hover, highlight, flat, frozen })
  useEffect(() => {
    live.current = { focus, hover, highlight, flat, frozen }
  }, [focus, hover, highlight, flat, frozen])

  // measured in layout px, which the board's zoom doesn't change
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect
      if (w > 0 && h > 0) setSize({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const { w, h } = size
    const ratio = devicePixelRatio || 1
    el.width = w * ratio
    el.height = h * ratio
    ctx.scale(ratio, ratio)
    const css = getComputedStyle(el)
    const read = (v: string, or: string): string => css.getPropertyValue(v).trim() || or
    const brand = read('--color-brand', css.color)
    const ink = read('--color-inverse', brand)
    const paper = read('--color-card', 'white')
    const mono = read('--font-mono', 'monospace')
    const sans = read('--font-sans', 'sans-serif')
    const onBrand = read('--color-on-brand', 'white')
    // shades of the one brand colour, so clusters differ without bringing in new hues
    const shades = [
      brand,
      ink,
      `color-mix(in srgb, ${brand} 55%, white)`,
      `color-mix(in srgb, ${brand} 60%, black)`,
      `color-mix(in srgb, ${brand} 30%, white)`
    ]
    const shade = (id: string): string => {
      const i = groups.of.get(id)
      return i === undefined ? brand : shades[i % shades.length]
    }
    let frame = 0
    const draw = (): void => {
      frame = requestAnimationFrame(draw)
      // the Studio stays mounted, hidden, while a book is open
      if (getComputedStyle(el).visibility === 'hidden') return
      const { yaw, pitch, held } = view.current
      const { flat: plane, frozen: still } = live.current
      if (!held && !still && !plane && !reducedMotion()) view.current.yaw = yaw + 0.0007
      const at = (p: { x: number; y: number; z: number }): ReturnType<typeof project> =>
        project(
          p,
          plane ? 0 : view.current.yaw,
          plane ? 0 : pitch,
          w / 2 + view.current.px,
          h / 2 + view.current.py,
          radius * view.current.zoom
        )
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = brand
      ctx.lineWidth = 0.6
      const { focus: f, hover: over, highlight: lit } = live.current
      const near = over ? (linked.get(over) ?? new Set<string>()) : null
      const filtering = !!over || !!lit
      const active = (id: string): boolean =>
        over ? id === over || near!.has(id) : lit ? id.startsWith(lit) : true
      const strokeEdges = (alpha: number, want: boolean): void => {
        ctx.globalAlpha = alpha
        ctx.beginPath()
        for (const [a, b] of edges) {
          const on = over ? a!.id === over || b!.id === over : !!lit && a!.id.startsWith(lit)
          if (on !== want) continue
          const s = at(a!)
          const t = at(b!)
          ctx.moveTo(s.sx, s.sy)
          ctx.lineTo(t.sx, t.sy)
        }
        ctx.stroke()
      }
      strokeEdges(filtering ? 0.05 : 0.16, false)
      if (filtering) strokeEdges(0.6, true)
      // far points first, so near ones sit on top
      const order = points.map((p) => ({ p, s: at(p) })).sort((u, v) => v.s.depth - u.s.depth)
      for (const { p, s } of order) {
        const on = p.id === f || p.id === over
        const fade = 0.35 + 0.65 * ((1 - s.depth) / 2)
        ctx.globalAlpha = on ? 1 : filtering ? (active(p.id) ? 1 : fade * 0.12) : fade
        ctx.fillStyle = on ? ink : shade(p.id)
        const r =
          (2.5 + Math.min(p.degree, 16) * 0.45) *
          s.scale *
          (on || (filtering && active(p.id)) ? 1.5 : 1)
        ctx.beginPath()
        ctx.arc(s.sx, s.sy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      // words last, nearest and most important first, skipping any that would land on another
      const taken: { x: number; y: number; w: number; h: number }[] = []
      const write = (
        text: string,
        x: number,
        y: number,
        font: string,
        alpha: number,
        fill: string
      ): void => {
        ctx.font = font
        const width = ctx.measureText(text).width
        const b = { x: x - width / 2 - 3, y: y - 9, w: width + 6, h: 18 }
        if (b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h) return
        if (
          taken.some(
            (t) => b.x < t.x + t.w && t.x < b.x + b.w && b.y < t.y + t.h && t.y < b.y + b.h
          )
        )
          return
        taken.push(b)
        ctx.globalAlpha = alpha
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.lineWidth = 3.5
        ctx.strokeStyle = paper
        ctx.strokeText(text, x, y)
        ctx.fillStyle = fill
        ctx.fillText(text, x, y)
      }
      const nodeLabel = (id: string, bold: boolean): void => {
        const p = byId.get(id)
        if (!p) return
        const s = at(p)
        write(
          clip(names.get(id) ?? id, bold ? 40 : 24),
          s.sx,
          s.sy - 12 * s.scale - 4,
          `${bold ? '600 ' : ''}11px ${mono}`,
          over ? 1 : 0.35 + 0.65 * ((1 - s.depth) / 2),
          ink
        )
      }
      if (over) {
        nodeLabel(over, true)
        ;[...near!]
          .sort((a, b) => (byId.get(b)?.degree ?? 0) - (byId.get(a)?.degree ?? 0))
          .slice(0, NEIGHBOURS)
          .forEach((id) => nodeLabel(id, false))
      } else {
        for (const c of groups.clusters.slice(0, TAGS)) {
          if (lit && !c.ids.some((id) => id.startsWith(lit))) continue
          const s = at(c)
          const text = clip(c.name, 26).toUpperCase()
          ctx.font = `600 10px ${sans}`
          const width = ctx.measureText(text).width + 12
          const b = { x: s.sx - width / 2, y: s.sy - 9, w: width, h: 18 }
          if (b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h) continue
          if (
            taken.some(
              (t) => b.x < t.x + t.w && t.x < b.x + b.w && b.y < t.y + t.h && t.y < b.y + b.h
            )
          )
            continue
          taken.push(b)
          ctx.globalAlpha = 1
          ctx.fillStyle = brand
          ctx.fillRect(b.x, b.y, b.w, b.h)
          ctx.fillStyle = onBrand
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, s.sx, s.sy + 0.5)
        }
      }
      ctx.globalAlpha = 1
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [points, edges, size, radius, groups, linked, names, byId])

  const zoomBy = (factor: number): void => {
    const v = view.current
    const zoom = Math.max(0.4, Math.min(6, v.zoom * factor))
    v.px *= zoom / v.zoom
    v.py *= zoom / v.zoom
    v.zoom = zoom
  }

  const local = (
    e: { clientX: number; clientY: number },
    el: Element
  ): { x: number; y: number } => {
    const r = el.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * size.w,
      y: ((e.clientY - r.top) / r.height) * size.h
    }
  }
  const nearest = (x: number, y: number): string | null => {
    let best: string | null = null
    let dist = 12
    for (const s of screen()) {
      const d = Math.hypot(s.sx - x, s.sy - y) - s.r
      if (d < dist) {
        dist = d
        best = s.id
      }
    }
    return best
  }

  return (
    <div ref={box} className="absolute inset-0">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Knowledge graph: ${points.length} things and how they link`}
        className={`absolute inset-0 size-full text-link ${hover ? 'cursor-pointer' : 'cursor-grab'}`}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          const start = { x: e.clientX, y: e.clientY, ...view.current }
          const scale = size.w / e.currentTarget.getBoundingClientRect().width
          let moved = false
          const el = e.currentTarget
          view.current.held = true
          const move = (m: PointerEvent): void => {
            if (Math.hypot(m.clientX - start.x, m.clientY - start.y) > 3) moved = true
            if (flat) {
              view.current.px = start.px + (m.clientX - start.x) * scale
              view.current.py = start.py + (m.clientY - start.y) * scale
              return
            }
            view.current.yaw = start.yaw + (m.clientX - start.x) * 0.008
            view.current.pitch = Math.max(
              -1.4,
              Math.min(1.4, start.pitch + (m.clientY - start.y) * 0.008)
            )
          }
          const up = (u: PointerEvent): void => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerup', up)
            view.current.held = false
            if (moved) return
            const { x, y } = local(u, el)
            const hit = nearest(x, y)
            if (hit) onPick?.(hit)
          }
          el.addEventListener('pointermove', move)
          el.addEventListener('pointerup', up)
        }}
        onPointerMove={(e) => {
          if (view.current.held) return
          const { x, y } = local(e, e.currentTarget)
          setHover(nearest(x, y))
        }}
        onPointerLeave={() => setHover(null)}
      />
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div className="flex border border-chip-line bg-card">
          {[
            [false, '3D'],
            [true, '2D']
          ].map(([value, name]) => (
            <button
              key={String(name)}
              aria-pressed={flat === value}
              onClick={() => {
                setFlat(value as boolean)
                Object.assign(view.current, { zoom: 1, px: 0, py: 0 })
              }}
              className={`h-8 px-2.5 type-label-s ${flat === value ? 'bg-brand text-on-brand' : 'text-link hover:bg-selected'}`}
            >
              {name}
            </button>
          ))}
        </div>
        {!flat && (
          <button
            onClick={() => setFrozen(!frozen)}
            aria-pressed={frozen}
            className="h-8 border border-chip-line bg-card px-2.5 type-label-s text-link hover:bg-selected"
          >
            {frozen ? 'Play' : 'Freeze'}
          </button>
        )}
        <div className="flex border border-chip-line bg-card text-link">
          <button
            aria-label="Zoom the graph out"
            onClick={() => zoomBy(1 / 1.3)}
            className="size-8 hover:bg-selected"
          >
            −
          </button>
          <button
            aria-label="Zoom the graph in"
            onClick={() => zoomBy(1.3)}
            className="size-8 border-l border-chip-line hover:bg-selected"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
