// The app's own right-click menu, in place of the system one: icons, headings and hints, in
// the Nocturne look. It is viewport chrome, drawn once in App and opened through popMenu
// (shared.ts), so it never sits on a board and costs nothing while it's closed.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import type { MenuItem } from './shared'
import { setMenuHost, type OpenMenu as Open } from './menuStore'

const usable = (it: MenuItem): boolean =>
  !it.separator && !it.heading && !!it.run && it.enabled !== false
const EDGE = 8 // kept clear of the window's edges

export function ContextMenuHost(): React.JSX.Element | null {
  const [menu, setMenu] = useState<Open | null>(null)
  const [active, setActive] = useState(-1)
  const [at, setAt] = useState<{ left: number; top: number; origin: string } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuHost((m) => {
      setMenu((old) => {
        old?.done() // a new right-click replaces the open menu
        return m
      })
      setActive(-1)
      setAt(null)
    })
    return () => setMenuHost(null)
  }, [])

  const close = (): void =>
    setMenu((m) => {
      m?.done()
      return null
    })
  const choose = (it: MenuItem): void => {
    if (!usable(it)) return
    setMenu(null)
    it.run?.()
    menu?.done()
  }

  // placed beside the pointer, flipped back inside the window when it would run off an edge
  useLayoutEffect(() => {
    if (!menu || !box.current) return
    const { width, height } = box.current.getBoundingClientRect()
    const right = menu.x + width + EDGE > innerWidth
    const below = menu.y + height + EDGE > innerHeight
    setAt({
      left: Math.max(EDGE, right ? menu.x - width : menu.x),
      top: Math.max(EDGE, below ? menu.y - height : menu.y),
      origin: `${below ? 'bottom' : 'top'} ${right ? 'right' : 'left'}`
    })
    box.current.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const outside = (e: Event): void => {
      if (!box.current?.contains(e.target as Node)) close()
    }
    addEventListener('pointerdown', outside, true)
    addEventListener('wheel', close, true)
    addEventListener('resize', close)
    addEventListener('blur', close)
    return () => {
      removeEventListener('pointerdown', outside, true)
      removeEventListener('wheel', close, true)
      removeEventListener('resize', close)
      removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu) return null
  const step = (from: number, by: number): number => {
    const n = menu.items.length
    for (let i = 1; i <= n; i++) {
      const j = (((from + by * i) % n) + n) % n
      if (usable(menu.items[j])) return j
    }
    return -1
  }
  const key = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') setActive((a) => step(a < 0 ? -1 : a, 1))
    else if (e.key === 'ArrowUp') setActive((a) => step(a < 0 ? 0 : a, -1))
    else if (e.key === 'Home') setActive(step(-1, 1))
    else if (e.key === 'End') setActive(step(0, -1))
    else if ((e.key === 'Enter' || e.key === ' ') && active >= 0) choose(menu.items[active])
    else if (e.key === 'Escape' || e.key === 'Tab') close()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  return createPortal(
    <div
      ref={box}
      role="menu"
      tabIndex={-1}
      onKeyDown={key}
      onContextMenu={(e) => e.preventDefault()}
      className="glass menu-in fixed z-[1000] flex max-w-80 min-w-56 flex-col rounded-[14px] border border-hair bg-card p-1.5 text-fg outline-none"
      style={{
        left: at?.left ?? menu.x,
        top: at?.top ?? menu.y,
        transformOrigin: at?.origin,
        visibility: at ? 'visible' : 'hidden' // measured first, then shown in place
      }}
    >
      {menu.items.map((it, i) =>
        it.separator ? (
          <span key={i} role="separator" className="mx-2 my-1 h-px bg-hair" />
        ) : it.heading ? (
          <span
            key={i}
            className="flex items-center gap-2 truncate px-2.5 pt-1.5 pb-1 type-label-mono text-dim"
          >
            {it.icon && <Icon name={it.icon} size={13} />}
            {it.label}
          </span>
        ) : (
          <button
            key={i}
            role="menuitem"
            tabIndex={-1}
            disabled={!usable(it)}
            onPointerEnter={() => setActive(usable(it) ? i : -1)}
            onClick={() => choose(it)}
            className={`flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-left type-body-s ${
              !usable(it)
                ? 'text-placeholder'
                : it.danger
                  ? `text-danger-fg ${active === i ? 'bg-danger-subtle' : ''}`
                  : active === i
                    ? 'bg-selected'
                    : ''
            }`}
          >
            <span className="flex w-4 shrink-0 justify-center text-dim">
              {it.icon && <Icon name={it.icon} size={15} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <span className="shrink-0 type-caption text-dim">{it.hint}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  )
}
