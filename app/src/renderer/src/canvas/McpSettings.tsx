// The MCPs window on the Studio desk: every tool Orchestra knows, its real state on this machine,
// and the steps to connect it or sign in again.
import { useEffect, useRef, useState } from 'react'
import type { MachineCheck } from '../../../preload'
import { RECIPES } from '../../../main/recipes'
import { small, StepRow, TOOLS } from './Setup'
import { mcpState, type McpState } from './stage'

const LOOK: Record<McpState, { pill: string; note: string; tone: string; act: string }> = {
  connected: { pill: 'Connected', note: 'Agents can use it.', tone: 'ok', act: '' },
  auth: { pill: 'Sign in again', note: 'Its sign-in has expired.', tone: 'bad', act: 'Sign in' },
  failed: {
    pill: 'Error',
    note: 'It’s added, but it isn’t responding.',
    tone: 'bad',
    act: 'Reconnect'
  },
  missing: { pill: 'Not connected', note: '', tone: 'off', act: 'Connect' }
}
const PILL: Record<string, string> = {
  ok: 'bg-success-subtle text-success-fg',
  bad: 'bg-signal-subtle text-signal-fg',
  off: 'border border-dashed border-wire text-link'
}

function McpRow({
  id,
  name,
  state,
  check
}: {
  id: string
  name: string
  state: McpState | null
  check: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const recipe = RECIPES.find((r) => r.id === id)
  const look = state && LOOK[state]
  // signing in again is only the last part of connecting
  const auth = recipe?.steps.filter((s) => s.id.endsWith('-auth')) ?? []
  const steps = state === 'auth' && auth.length ? auth : (recipe?.steps ?? [])
  const note = !look ? 'Checking…' : recipe || state !== 'missing' ? look.note : 'No connector yet.'
  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-start justify-between gap-4">
        <span>
          <span className="block type-body-m-strong text-link">{name}</span>
          {note && <span className="type-caption text-dim">{note}</span>}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 type-label-s ${PILL[look?.tone ?? 'off']}`}
        >
          {look?.pill ?? 'Checking'}
        </span>
      </div>
      {recipe && look?.act && !open && (
        <button onClick={() => setOpen(true)} className={`${small} self-start`}>
          {look.act}
        </button>
      )}
      {recipe && look?.act && open && (
        <ol className="flex flex-col gap-3 border-t border-hair pt-3">
          {steps.map((s, i) => (
            <StepRow key={s.id} n={i + 1} step={s} after={check} />
          ))}
        </ol>
      )}
    </li>
  )
}

export function McpSettings(): React.JSX.Element {
  const [machine, setMachine] = useState<MachineCheck | null>(null)
  const latest = useRef(0) // an older check finishing late mustn't overwrite a newer one
  function check(): void {
    const run = ++latest.current
    setMachine(null)
    void window.api.checkSetup().then((m) => {
      if (run === latest.current) setMachine(m)
    })
  }
  useEffect(check, [])
  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="type-label-mono text-link">App MCPs</h3>
        <button onClick={check} disabled={!machine} className={small}>
          {machine ? 'Check again' : 'Checking…'}
        </button>
      </div>
      <ul className="mt-2 divide-y divide-hair">
        {TOOLS.map(([id, name]) => (
          <McpRow
            key={id}
            id={id}
            name={name}
            state={machine ? mcpState(id, machine.mcp) : null}
            check={check}
          />
        ))}
      </ul>
    </div>
  )
}
