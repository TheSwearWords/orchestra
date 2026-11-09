// Settings → Providers: see what each provider is really connected through, and disconnect or
// reconnect it after first-time setup.
import { useEffect, useRef, useState } from 'react'
import type { MachineCheck, ProviderStatus } from '../../../preload'
import { PROVIDERS, providerLink, type ProviderInfo } from '../../../main/providers'
import { ACCOUNTS, SIGN_OUT, type SetupStep } from '../../../main/recipes'
import { input, primary, reason, small, StepRow } from './Setup'

function ProviderRow({
  p,
  via,
  savedKey,
  machine,
  check
}: {
  p: ProviderInfo
  via: string
  savedKey: boolean
  machine: MachineCheck | null
  check: () => void
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [sure, setSure] = useState(false)
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const a = ACCOUNTS[p.id]
  const cli = machine?.clis[p.id]
  const signedIn = !machine ? null : p.id === 'anthropic' ? machine.claude.loggedIn : !!cli
  const link = providerLink(p, via, savedKey, signedIn, machine?.claude.plan)
  const todo: SetupStep[] = signedIn ? [] : cli ? [a.login] : [a.install, a.login]

  async function act(fn: () => Promise<void>): Promise<void> {
    setBusy(true)
    setErr('')
    try {
      await fn()
      setKey('')
      setAdding(false)
      check()
    } catch (e) {
      setErr(reason(e))
    } finally {
      setBusy(false)
      setSure(false)
    }
  }
  async function disconnect(): Promise<void> {
    if (link.undo === 'key') return window.api.forgetKey(p.id)
    const r = await window.api.runSetupStep(SIGN_OUT.id)
    if (!r.ok) throw new Error(r.out || 'Claude Code wouldn’t sign out.')
  }

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-start justify-between gap-4">
        <span>
          <span className="block type-body-m-strong text-link">{p.name}</span>
          <span className="type-caption text-dim">{link.note}</span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 type-label-s ${link.connected ? 'bg-success-subtle text-success-fg' : 'border border-dashed border-wire text-link'}`}
        >
          {link.connected === null ? 'Checking' : link.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      {link.undo && (
        <div className="flex flex-col gap-2">
          {sure && (
            <p className="type-caption text-link">
              {link.undo === 'account'
                ? 'This signs Claude Code out on this whole computer, including outside Orchestra. '
                : 'This deletes the saved key. '}
              Agents that are working now will stop. Conversations are kept.
            </p>
          )}
          <button
            disabled={busy}
            onClick={() => (sure ? void act(disconnect) : setSure(true))}
            className={`${small} self-start`}
          >
            {busy ? 'Disconnecting…' : sure ? 'Yes, disconnect' : 'Disconnect'}
          </button>
        </div>
      )}
      {link.connected === false && !link.undo && !adding && (
        <button onClick={() => setAdding(true)} className={`${small} self-start`}>
          Connect
        </button>
      )}
      {adding && link.connected === false && (
        <div className="flex flex-col gap-3 border-t border-hair pt-3">
          <p className="type-label-m text-link">Sign in with your account</p>
          <ol className="flex flex-col gap-3">
            {todo.map((s, i) => (
              <StepRow key={s.id} n={i + 1} step={s} after={check} />
            ))}
          </ol>
          <button onClick={check} className={`${small} self-start`}>
            Check again
          </button>
          <p className="type-label-m text-link">Or use an API key</p>
          <ol>
            <StepRow n={1} step={a.getKey} after={check} />
          </ol>
          <input
            type="password"
            aria-label={`${p.name} API key`}
            autoComplete="off"
            value={key}
            onChange={(e) => {
              setKey(e.target.value)
              setErr('')
            }}
            placeholder="Paste your API key"
            className={input}
          />
          <button
            disabled={busy || !key.trim()}
            onClick={() => void act(() => window.api.saveKey(p.id, key))}
            className={`${primary} self-start`}
          >
            {busy ? 'Checking…' : 'Connect with this key'}
          </button>
        </div>
      )}
      {err && (
        <p role="alert" className="type-body-s break-words text-signal-fg">
          {err}
        </p>
      )}
    </li>
  )
}

export function ProviderSettings(): React.JSX.Element {
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [machine, setMachine] = useState<MachineCheck | null>(null)
  const latest = useRef(0) // an older check finishing late mustn't overwrite a newer one

  function check(): void {
    const run = ++latest.current
    setMachine(null)
    void Promise.all([window.api.providerStatus(), window.api.savedKeys()]).then(([st, keys]) => {
      if (run !== latest.current) return
      setStatus(st)
      setSaved(keys)
    })
    void window.api.checkSetup().then((m) => {
      if (run === latest.current) setMachine(m)
    })
  }
  useEffect(check, [])

  return (
    <>
      <h3 className="type-label-mono text-link">Providers</h3>
      {status && (
        <ul className="mt-2 divide-y divide-hair">
          {PROVIDERS.map((p) => (
            <ProviderRow
              key={p.id}
              p={p}
              via={status[p.id].via}
              savedKey={saved.includes(p.id)}
              machine={machine}
              check={check}
            />
          ))}
        </ul>
      )}
    </>
  )
}
