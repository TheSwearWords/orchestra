// The browser panel: a web page beside the board, opened by clicking any web link in the app.
// The page itself is drawn by Electron (main/browser.ts) over this panel's body, so the board
// never carries it and stays smooth. Viewport chrome, drawn once in App.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PageState } from '../../../preload'
import { Icon } from '../components/Icon'
import { DOCK_TOP, TOP_BAR } from './shared'

const button =
  'flex size-8 shrink-0 items-center justify-center rounded-full text-link hover:bg-selected disabled:text-placeholder disabled:hover:bg-transparent'

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function BrowserPanel(): React.JSX.Element | null {
  const [asked, setAsked] = useState<string | null>(null) // the page asked for; null: closed
  const [page, setPage] = useState<PageState | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const settled = useRef(false) // the entrance has finished, so the body is where it will stay
  const panel = useRef<HTMLElement>(null)
  // where it was dragged to; null: its home, top right under the header
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null)
  // kept whole inside the window, below the header
  const keep = (x: number, y: number, w: number, h: number): { x: number; y: number } => ({
    x: Math.min(Math.max(0, x), innerWidth - w),
    y: Math.min(Math.max(TOP_BAR, y), innerHeight - h)
  })

  useEffect(
    () =>
      window.api.onPageRequest((url) => {
        setAsked(url)
        void window.api.openPage(url)
      }),
    []
  )
  useEffect(() => window.api.onPageState(setPage), [])

  // the page follows the body: after the entrance, and whenever the window or panel resizes
  const place = (): void => {
    const el = body.current
    if (!el || !settled.current) return
    const r = el.getBoundingClientRect()
    void window.api.placePage({ x: r.left, y: r.top, width: r.width, height: r.height })
  }
  useLayoutEffect(place, [pos])
  useEffect(() => {
    if (!asked || !body.current) return
    const ro = new ResizeObserver(place)
    ro.observe(body.current)
    // a smaller window pulls a dragged panel back inside it
    const fit = (): void => {
      const r = panel.current?.getBoundingClientRect()
      if (r) setPos((p) => p && keep(p.x, p.y, r.width, r.height))
      place()
    }
    addEventListener('resize', fit)
    return () => {
      ro.disconnect()
      removeEventListener('resize', fit)
    }
  }, [asked])

  if (!asked) return null
  const close = (): void => {
    settled.current = false
    setAsked(null)
    setPage(null)
    void window.api.closePage()
  }
  const url = page?.url || asked

  return (
    <aside
      ref={panel}
      aria-label="Browser"
      onAnimationEnd={() => {
        settled.current = true
        place()
      }}
      className="glass panel-in fixed z-40 flex flex-col overflow-hidden rounded-[14px] border border-hair bg-card"
      // the page is 16:9 and large: most of the window's width, but never taller than the space
      // between the header and the Orchestrator bar (84px) less the panel's own header (48px)
      style={{
        ...(pos ? { left: pos.x, top: pos.y } : { top: DOCK_TOP, right: 52 }),
        width: `min(78vw, 1600px, calc((100vh - ${DOCK_TOP + 84 + 48}px) * 16 / 9))`
      }}
    >
      {/* drag the header to move the panel; double-click it to send the panel home */}
      <header
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button') || !panel.current) return
          const r = panel.current.getBoundingClientRect()
          drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = drag.current
          if (d) setPos(keep(e.clientX - d.dx, e.clientY - d.dy, d.w, d.h))
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onDoubleClick={(e) => !(e.target as HTMLElement).closest('button') && setPos(null)}
        title="Drag to move. Double-click to put it back."
        className="flex h-12 shrink-0 cursor-grab touch-none items-center gap-1 border-b border-hair px-2 select-none active:cursor-grabbing"
      >
        <button
          onClick={() => void window.api.stepPage('back')}
          disabled={!page?.back}
          aria-label="Back"
          title="Back"
          className={button}
        >
          <Icon name="arrow-left-s-line" size={18} />
        </button>
        <button
          onClick={() => void window.api.stepPage('forward')}
          disabled={!page?.forward}
          aria-label="Forward"
          title="Forward"
          className={button}
        >
          <Icon name="arrow-right-s-line" size={18} />
        </button>
        <span className="flex min-w-0 flex-1 flex-col px-2" title={url}>
          <span className="truncate type-body-s font-medium text-fg">
            {page?.loading && !page.title ? 'Loading…' : page?.title || hostOf(url)}
          </span>
          <span className="truncate font-mono text-[11px] text-dim">{hostOf(url)}</span>
        </span>
        <button
          onClick={() => void window.api.stepPage('reload')}
          className="h-8 shrink-0 rounded-full px-3 type-label-s text-link hover:bg-selected"
        >
          {page?.loading ? 'Loading' : 'Reload'}
        </button>
        <button
          onClick={() => void window.api.stepPage('external')}
          aria-label="Open in my browser"
          title="Open in my browser"
          className={button}
        >
          <Icon name="arrow-right-up-line" size={16} />
        </button>
        <button onClick={close} aria-label="Close the browser" title="Close" className={button}>
          <Icon name="close-line" size={16} />
        </button>
      </header>
      {/* the page is drawn over this; until it has loaded, this is what shows */}
      <div ref={body} className="flex aspect-video w-full items-center justify-center bg-canvas">
        <span className="type-body-s text-dim">Opening {hostOf(url)}…</span>
      </div>
    </aside>
  )
}
