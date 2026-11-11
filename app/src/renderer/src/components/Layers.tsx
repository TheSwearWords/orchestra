// The layers panel on Create: every deliverable and what belongs to it, like Figma's layers.
// Double-click flies to it; the eye hides or shows it; Only hides the others so you can focus.
import { useState } from 'react'
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
  const row = 'flex h-8 items-center gap-1.5 pr-1 hover:bg-selected'
  const small =
    'flex h-6 shrink-0 items-center justify-center px-1 type-caption text-link hover:bg-card'
  return (
    <section
      aria-label="Layers"
      className="absolute z-20 flex w-60 flex-col border border-chip-line bg-card text-link shadow-float"
      style={{
        top,
        left: 14,
        maxHeight: `calc(100% - ${top + 120}px)`
      }}
    >
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-hair pr-1 pl-3">
        <span className="type-label-s">Layers</span>
        <span className="flex items-center gap-1">
          {hidden.length > 0 && (
            <button onClick={() => onHidden([])} className={small}>
              Show all
            </button>
          )}
          <button
            onClick={() => setClosed(!closed)}
            aria-expanded={!closed}
            aria-label={closed ? 'Show layers' : 'Collapse layers'}
            className={`${small} w-6`}
          >
            <Icon
              name="arrow-down-s-line"
              size={14}
              className={closed ? '-rotate-90' : undefined}
            />
          </button>
        </span>
      </header>
      {!closed && (
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
      )}
    </section>
  )
}
