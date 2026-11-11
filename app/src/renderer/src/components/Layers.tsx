// The layers panel on Create: every deliverable and what belongs to it, like Figma's layers.
// Double-click flies to it; the eye hides or shows it; Only hides the others so you can focus.
import { useLayoutEffect, useRef, useState } from 'react'
import { KindMark, type CardKind } from '../canvas/kinds'
import { Icon } from './Icon'

export interface Layer {
  id: string // the deliverable
  name: string
  members: { id: string; title: string; kind?: CardKind }[]
}

function Eye({ off }: { off: boolean }): React.JSX.Element {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
      <path strokeWidth="1.3" d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="2" strokeWidth="1.3" />
      {off && <path strokeWidth="1.3" d="M2.5 13.5l11-11" />}
    </svg>
  )
}

export function Layers({
  layers,
  hidden,
  top,
  onHidden,
  onFly
}: {
  layers: Layer[]
  hidden: string[]
  top: number // from the window's top edge, clear of Back
  onHidden: (ids: string[]) => void
  onFly: (target: string) => void // a window's id, or "group:<deliverable>"
}): React.JSX.Element {
  const [closed, setClosed] = useState(false)
  const [open, setOpen] = useState<string[]>([])
  // Closed, the panel is exactly as wide as its title and chevron. The width is measured and
  // written straight to the element (not through React state) so it can ease between the two.
  const panel = useRef<HTMLElement>(null)
  const title = useRef<HTMLSpanElement>(null)
  const controls = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = panel.current
    if (!el) return
    const hug =
      (title.current?.offsetWidth ?? 0) + (controls.current?.offsetWidth ?? 0) + 28 + 10 + 2
    el.style.width = `${closed ? hug : 240}px`
  }, [closed, hidden.length])
  const row = 'flex h-8 items-center gap-1.5 pr-1 hover:bg-selected'
  const small =
    'flex h-6 shrink-0 items-center justify-center px-1 type-caption text-link hover:bg-card'
  return (
    <section
      ref={panel}
      aria-label="Layers"
      // closed, the whole panel is the button that opens it
      onClick={() => closed && setClosed(false)}
      className={`absolute z-20 flex flex-col overflow-hidden border border-chip-line bg-card text-link shadow-float transition-[width] duration-300 ease-(--ease) ${
        closed ? 'cursor-pointer' : ''
      }`}
      style={{
        top,
        left: 14,
        maxHeight: `calc(100% - ${top + 120}px)`
      }}
    >
      <header
        // open, anywhere on the header minimises the panel (closed, the whole panel opens it)
        onClick={() => !closed && setClosed(true)}
        className={`flex h-9 shrink-0 items-center justify-between border-b transition-colors duration-300 ${
          closed
            ? 'gap-2.5 border-transparent px-3.5'
            : 'cursor-pointer gap-3 border-hair pr-1 pl-3'
        }`}
      >
        <span ref={title} className="type-label-s">
          Layers
        </span>
        <span ref={controls} className="flex items-center gap-1">
          {hidden.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation() // don't open the panel
                onHidden([])
              }}
              className={small}
            >
              Show all
            </button>
          )}
          <button
            onClick={() => setClosed(!closed)}
            aria-expanded={!closed}
            aria-label={closed ? 'Show layers' : 'Collapse layers'}
            className={`${small} ${closed ? 'w-3.5 px-0' : 'w-6'}`}
          >
            <Icon
              name="arrow-down-s-line"
              size={14}
              className={closed ? '-rotate-90' : undefined}
            />
          </button>
        </span>
      </header>
      {/* the list stays mounted so it can ease shut: its row height runs from 0 to 1 */}
      <div
        inert={closed}
        className="grid min-h-0 w-0 min-w-full transition-[grid-template-rows,opacity] duration-300 ease-(--ease)" // w-0 + min-w-full: the list does not widen the closed panel
        style={{ gridTemplateRows: closed ? '0fr' : '1fr', opacity: closed ? 0 : 1 }}
      >
        <ul className="min-h-0 overflow-y-auto py-1">
          <li>
            <div className={`${row} pl-7`} onDoubleClick={() => onFly('orchestrator')}>
              <KindMark kind="orchestrator" />
              <span className="min-w-0 flex-1 truncate type-body-s">Orchestrator</span>
            </div>
          </li>
          {layers.map((l) => {
            const off = hidden.includes(l.id)
            const expanded = open.includes(l.id)
            return (
              <li key={l.id}>
                <div className={`group ${row} ${off ? 'opacity-45' : ''}`}>
                  <button
                    onClick={() =>
                      setOpen((o) => (expanded ? o.filter((x) => x !== l.id) : [...o, l.id]))
                    }
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${l.name}`}
                    className="flex size-6 shrink-0 items-center justify-center"
                  >
                    <Icon
                      name="arrow-down-s-line"
                      size={14}
                      className={expanded ? undefined : '-rotate-90'}
                    />
                  </button>
                  <span
                    onDoubleClick={() => {
                      if (off) onHidden(hidden.filter((x) => x !== l.id))
                      onFly(`group:${l.id}`)
                    }}
                    title="Double-click to go there"
                    className="min-w-0 flex-1 cursor-default truncate type-body-s select-none"
                  >
                    {l.name}
                  </span>
                  <button
                    onClick={() => onHidden(layers.map((x) => x.id).filter((x) => x !== l.id))}
                    title={`Show only ${l.name}`}
                    className={`${small} opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                  >
                    Only
                  </button>
                  <button
                    onClick={() =>
                      onHidden(off ? hidden.filter((x) => x !== l.id) : [...hidden, l.id])
                    }
                    aria-pressed={off}
                    aria-label={`${off ? 'Show' : 'Hide'} ${l.name}`}
                    title={off ? 'Show' : 'Hide'}
                    className={`${small} w-6`}
                  >
                    <Eye off={off} />
                  </button>
                </div>
                {expanded && (
                  <ul>
                    {l.members.map((m) => (
                      <li key={m.id}>
                        <div
                          className={`${row} pl-9 ${off ? 'opacity-45' : ''}`}
                          onDoubleClick={() => {
                            if (off) onHidden(hidden.filter((x) => x !== l.id))
                            onFly(m.id)
                          }}
                          title="Double-click to go there"
                        >
                          {m.kind && <KindMark kind={m.kind} />}
                          <span className="min-w-0 flex-1 truncate type-caption select-none">
                            {m.title}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
