// Right-click a deliverable to edit it: what it is, what it needs first, and what it connects to.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Instrument, MachineCheck, Musician } from '../../../preload'
import { RECIPES } from '../../../main/recipes'
import { StepRow } from '../canvas/Setup'
import { mcpLabel, mcpState, mcpsOf, toolsFor, type McpState } from '../canvas/stage'

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const STATE: Record<McpState, string> = {
  connected: 'Connected',
  auth: 'Needs signing in again',
  failed: 'Not working',
  missing: 'Not connected'
}

export function DeliverableEditor({
  musician: m,
  foundations,
  machine,
  onRecheck,
  onClose,
  onSaved
}: {
  musician: Musician
  foundations: Instrument[]
  machine: MachineCheck | null
  onRecheck: () => void
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(m.name)
  const [what, setWhat] = useState(m.deliverable)
  const [needs, setNeeds] = useState(m.prerequisites)
  const [mcps, setMcps] = useState(mcpsOf(m.tools))
  const [error, setError] = useState('')
  const options = [...new Set([...RECIPES.map((r) => r.id), ...mcpsOf(m.tools)])]
  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  async function save(): Promise<void> {
    setError('')
    try {
      await window.api.editAgent('musician', m.id, 'name', name)
      await window.api.editAgent('musician', m.id, 'description', what)
      await window.api.setAgentList(m.id, 'prerequisites', needs)
      await window.api.setAgentList(m.id, 'tools', toolsFor(mcps, m.tools))
      dispatchEvent(new Event('orchestra:agents-changed'))
      onSaved()
    } catch (err) {
      setError(reason(err))
    }
  }

  const label = 'type-label-s text-dim'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${m.name}`}
        className="flex max-h-[88vh] w-full max-w-[640px] flex-col border border-chip-line bg-card text-link shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
      >
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-8">
          <h2 className="type-heading-m">Edit deliverable</h2>
          <label className="flex flex-col gap-2">
            <span className={label}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-0 border-b-2 border-brand bg-transparent pb-1.5 type-body-l outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={label}>What it is</span>
            <textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              className="field-sizing-content min-h-20 resize-none border border-card-line bg-transparent p-3 type-body-m outline-none focus:border-brand"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className={label}>What it requires</span>
            <div className="flex flex-wrap gap-1.5">
              {foundations.map((f) => (
                <button
                  key={f.id}
                  aria-pressed={needs.includes(f.id)}
                  onClick={() => setNeeds(toggle(needs, f.id))}
                  title={f.job}
                  className={`border px-2.5 py-1 type-label-s ${
                    needs.includes(f.id)
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-card-line hover:bg-selected'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className={label}>Connections (MCP)</span>
            <ul className="flex flex-col divide-y divide-hair border border-card-line">
              {options.map((id) => {
                const on = mcps.includes(id)
                const state = machine ? mcpState(id, machine.mcp) : null
                const bad = on && state && state !== 'connected'
                const recipe = RECIPES.find((r) => r.id === id)
                return (
                  <li key={id} className="flex flex-col gap-3 p-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setMcps(toggle(mcps, id))}
                        className="size-4 accent-brand"
                      />
                      <span className="flex-1 type-body-m">{mcpLabel(id)}</span>
                      {on && (
                        <span className={`type-caption ${bad ? 'text-signal-fg' : 'text-dim'}`}>
                          {state ? STATE[state] : 'Checking…'}
                        </span>
                      )}
                    </label>
                    {bad && recipe && (
                      <ol className="flex flex-col gap-3 pl-7">
                        {recipe.steps.map((s, i) => (
                          <StepRow key={s.id} n={i + 1} step={s} after={onRecheck} />
                        ))}
                      </ol>
                    )}
                  </li>
                )
              })}
            </ul>
            {mcps.length === 0 && (
              <p className="type-caption text-dim">
                No connections: this deliverable is made entirely in files.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="type-body-s text-signal-fg">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-hair p-4">
          <button
            onClick={onClose}
            className="serif-on h-10 border-[1.5px] border-brand px-4 type-label-m hover:bg-selected"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            className="serif-on h-10 bg-brand px-4 type-label-m text-on-brand hover:bg-inverse"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
