// First-time setup as a lesson in the artboard (Figma Mockups → Onboarding, O1–O6): you
// right-click to add a card for each thing Orchestra needs, fill it in and Connect it, and a wire
// joins it to Open the studio. That card lists what's required; clicking one of its rows opens
// that card for you, and Skip the tour opens them all.
import { useEffect, useState } from 'react'
import type { ProviderStatus, Setup as SetupData } from '../../../preload'
import { PROVIDERS } from '../../../main/providers'
import { Ascii } from '../components/Ascii'
import { Board, type CardSpec } from './Board'
import { barButton } from './Chrome'
import { STUDIO, type MenuItem } from './shared'

const SLOTS = [
  { id: 'name', label: 'Your name', row: 'Name', required: true },
  { id: 'provider', label: 'Provider', row: 'Provider', required: true },
  { id: 'workspace', label: 'Workspace folder', row: 'Workspace folder', required: true },
  { id: 'tools', label: 'Tools you use', row: 'Tools', required: false },
  { id: 'memory', label: 'Memory · Obsidian', row: 'Memory', required: false },
  { id: 'github', label: 'GitHub', row: 'GitHub', required: false }
] as const
type Slot = (typeof SLOTS)[number]['id']

const BRAND: Record<string, string> = { anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini' }

// shortcut: Tools only records which apps you use; upgrade to a setup card per MCP (O5) when
// the Ensemble's MCP connections land.
const TOOLS = [
  ['figma', 'Figma', true],
  ['blender', 'Blender', true],
  ['notion', 'Notion', true],
  ['elevenlabs', 'ElevenLabs', true],
  ['google-drive', 'Google Drive', true],
  ['illustrator', 'Illustrator', false],
  ['photoshop', 'Photoshop', false],
  ['after-effects', 'After Effects', false],
  ['fusion', 'Fusion', false],
  ['rhino', 'Rhino', false],
  ['spline', 'Spline', false]
] as const

const FINISH = { x: 1720, y: 40, w: 340 }
// where cards go when a row or Skip opens them: a two-column grid between the hero and Finish
const spot = (i: number): { x: number; y: number } => ({
  x: 800 + (i % 2) * 440,
  y: 40 + Math.floor(i / 2) * 320
})
const HERO = { x: 0, y: 40, w: 720, h: 560 }

const primary =
  'serif-on h-10 bg-brand px-4 type-label-m text-on-brand hover:bg-inverse disabled:bg-placeholder disabled:text-on-brand'
const secondary =
  'serif-on h-10 border-[1.5px] border-brand px-4 type-label-m text-link hover:bg-brand hover:text-on-brand'
const field =
  'w-full border-0 border-b-2 border-brand bg-transparent pb-2 type-heading-m text-link outline-none placeholder:text-placeholder'

type Env = { home: string; gh: boolean; obsidian: boolean }

export function Setup({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [env, setEnv] = useState<Env | null>(null)
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [open, setOpen] = useState<{ id: string; x: number; y: number }[]>([])
  const [wired, setWired] = useState<string[]>([])
  const [name, setName] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const [focus, setFocus] = useState<string>()

  const check = (): void => void window.api.providerStatus().then(setStatus)
  useEffect(() => {
    void window.api.loadSetup().then(({ setup, ...e }) => {
      setEnv(e)
      setName(setup.name)
      setTools(setup.tools)
    })
    check()
  }, [])

  const isWired = (id: string): boolean => wired.includes(id)
  const providerWired = wired.some((w) => w.startsWith('provider-'))
  const done: Record<Slot, boolean> = {
    name: isWired('name'),
    provider: providerWired,
    workspace: isWired('workspace'),
    tools: isWired('tools'),
    memory: isWired('memory'),
    github: isWired('github')
  }
  const missing = SLOTS.filter((s) => s.required && !done[s.id])

  const wire = (id: string, on: boolean): void =>
    setWired((w) => (on ? [...w, id] : w.filter((x) => x !== id)))
  function add(id: string, at?: { x: number; y: number }): void {
    if (open.some((c) => c.id === id)) return setFocus(id)
    const i = open.length
    setOpen((o) => [...o, { id, ...(at ?? spot(i)) }])
    if (!at) setFocus(id) // opened from a row or Skip: fly to it
  }
  const close = (id: string): void => {
    setOpen((o) => o.filter((c) => c.id !== id))
    wire(id, false)
  }
  function menu(at: { x: number; y: number }): MenuItem[] {
    const item = (id: string, label: string): MenuItem => ({
      label,
      run: open.some((c) => c.id === id) ? undefined : () => add(id, at)
    })
    return [
      ...SLOTS.filter((s) => s.id !== 'provider').map((s) => item(s.id, s.label)),
      { label: '', separator: true },
      ...PROVIDERS.map((p) => item(`provider-${p.id}`, `Provider · ${BRAND[p.id]}`))
    ]
  }
  function skip(): void {
    const ids = ['name', 'provider-anthropic', 'workspace', 'tools', 'memory', 'github']
    setOpen((o) => [
      ...o,
      ...ids
        .filter((id) => !o.some((c) => c.id === id))
        .map((id, i) => ({ id, ...spot(o.length + i) }))
    ])
    setFocus('name')
  }
  async function finish(): Promise<void> {
    await window.api.saveSetup({
      done: true,
      name,
      providers: wired.filter((w) => w.startsWith('provider-')).map((w) => w.slice(9)),
      tools: done.tools ? tools : [],
      workspace: env?.home ?? '',
      memory: done.memory,
      github: done.github
    } satisfies SetupData)
    onDone()
  }

  /** A card's last row: what it needs before it can connect, then Connect / Disconnect. */
  const connect = (id: string, ready: boolean, why: string): React.JSX.Element => (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-hair px-4 py-3">
      <span className="type-caption text-link opacity-70">
        {isWired(id) ? 'Connected' : ready ? '' : why}
      </span>
      {isWired(id) ? (
        <button onClick={() => wire(id, false)} className={secondary}>
          Disconnect
        </button>
      ) : (
        <button disabled={!ready} onClick={() => wire(id, true)} className={primary}>
          Connect
        </button>
      )}
    </div>
  )
  const line = (k: string, v: React.ReactNode): React.JSX.Element => (
    <div className="flex justify-between gap-3 type-body-s text-link">
      <span>{k}</span>
      <span className="font-mono text-[12px] opacity-80">{v}</span>
    </div>
  )

  function body(id: string): React.ReactNode {
    if (id === 'name')
      return (
        <>
          <div className="flex flex-col gap-3 p-4">
            <label htmlFor="setup-name" className="type-heading-m text-link">
              What should we call you?
            </label>
            <input
              id="setup-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                wire('name', false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && wire('name', true)}
              placeholder="Your name"
              className={field}
            />
            <p className="type-caption text-link opacity-70">
              Used in greetings and on your covers. You can change it any time.
            </p>
          </div>
          {connect('name', !!name.trim(), 'Type a name first')}
        </>
      )
    if (id.startsWith('provider-')) {
      const p = PROVIDERS.find((x) => `provider-${x.id}` === id)!
      const s = status?.[p.id]
      return (
        <>
          <div className="flex flex-col gap-2 p-4">
            <p className="type-heading-m text-link">{BRAND[p.id]}</p>
            {line(
              `${p.cli} CLI or key`,
              s ? (s.connected ? `found · ${s.via}` : 'not found') : '…'
            )}
            {line('Runs agents', p.id === 'anthropic' ? 'yes' : 'not yet')}
            {!s?.connected && (
              <>
                <p className="type-caption text-link opacity-70">{p.connectHint}</p>
                <button onClick={check} className={`${secondary} self-start`}>
                  Check again
                </button>
              </>
            )}
          </div>
          {connect(id, !!s?.connected, 'Sign in first')}
        </>
      )
    }
    if (id === 'workspace')
      return (
        <>
          <div className="flex flex-col gap-2 p-4">
            <p className="type-heading-m text-link">Where everything lives</p>
            <p className="font-mono text-[12px] break-all text-link">{env?.home}</p>
            <p className="type-caption text-link opacity-70">
              Projects, the agent library and memory. It&apos;s also your Obsidian vault.
            </p>
          </div>
          {/* shortcut: the folder is fixed by ORCHESTRA_HOME; upgrade to a folder picker once
              the data root can move without a restart */}
          {connect('workspace', !!env, '')}
        </>
      )
    if (id === 'tools')
      return (
        <>
          <div className="flex flex-col gap-3 p-4">
            <p className="type-heading-m text-link">Which apps do you design in?</p>
            <div className="grid grid-cols-3 gap-px border border-hair bg-hair">
              {TOOLS.map(([tid, label, mcp]) => {
                const on = tools.includes(tid)
                return (
                  <button
                    key={tid}
                    aria-pressed={on}
                    onClick={() => setTools((t) => (on ? t.filter((x) => x !== tid) : [...t, tid]))}
                    className={`flex flex-col items-start gap-0.5 p-2 text-left ${
                      on ? 'serif-on bg-brand text-on-brand' : 'bg-card text-link hover:bg-selected'
                    }`}
                  >
                    <span className="type-label-s">{label}</span>
                    <span className="font-mono text-[10px] opacity-70">
                      {mcp ? 'has MCP' : 'no MCP yet'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          {connect('tools', tools.length > 0, 'Optional: pick any')}
        </>
      )
    if (id === 'memory')
      return (
        <>
          <div className="flex flex-col gap-2 p-4">
            {line('Obsidian', env?.obsidian ? 'found' : 'not found')}
            {line('Vault', 'the workspace folder')}
            {!env?.obsidian && (
              <p className="type-caption text-link opacity-70">
                Optional. Orchestra keeps its memory either way; Obsidian lets you browse it.
              </p>
            )}
          </div>
          {connect('memory', true, 'Optional')}
        </>
      )
    return (
      <>
        <div className="flex flex-col gap-2 p-4">
          {line('GitHub CLI', env?.gh ? 'found' : 'not found')}
          <p className="type-caption text-link opacity-70">
            Optional. For updates, and for keeping your own fork of Orchestra.
          </p>
        </div>
        {connect('github', !!env?.gh, 'Install gh first')}
      </>
    )
  }

  const title = (id: string): string =>
    id.startsWith('provider-')
      ? `Provider · ${BRAND[id.slice(9)]}`
      : (SLOTS.find((s) => s.id === id)?.label ?? id)

  const ready = missing.length === 0
  const cards: CardSpec[] = [
    ...open.map((c) => ({
      id: c.id,
      title: title(c.id),
      count: isWired(c.id) ? '✓' : undefined,
      x: c.x,
      y: c.y,
      w: c.id === 'tools' ? 400 : 360,
      body: <div className="flex min-h-40 flex-col">{body(c.id)}</div>,
      onClose: () => close(c.id),
      link: isWired(c.id) ? 'finish' : undefined
    })),
    {
      id: 'finish',
      title: 'Open the studio',
      ...FINISH,
      tone: ready ? 'blue' : 'paper',
      body: (
        <div className={`flex flex-col ${ready ? 'text-on-brand' : 'text-link'}`}>
          <ul>
            {SLOTS.map((s) => (
              <li key={s.id} className="border-b border-hair last:border-b-0">
                <button
                  onClick={() => add(s.id === 'provider' ? 'provider-anthropic' : s.id)}
                  title={`Open ${s.label}`}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left ${
                    ready ? 'hover:bg-inverse' : 'hover:bg-selected'
                  }`}
                >
                  <span className="w-4 font-mono text-[12px]">{done[s.id] ? '✓' : '○'}</span>
                  <span className="flex-1 type-body-s">{s.row}</span>
                  <span className="font-mono text-[10px] uppercase opacity-70">
                    {s.required ? 'required' : 'optional'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 p-4">
            <button
              disabled={!ready}
              onClick={() => void finish()}
              className={
                ready
                  ? 'serif-on h-11 bg-card type-label-m text-link hover:bg-selected'
                  : `${primary} h-11`
              }
            >
              Open the studio
            </button>
            <p className="type-caption opacity-80">
              {ready
                ? 'Saves your setup. You can change any of it later.'
                : `${missing.length} required ${missing.length === 1 ? 'card' : 'cards'} left.`}
            </p>
          </div>
        </div>
      )
    }
  ]

  const hint = !open.length
    ? 'Right-click anywhere on the board to add a card'
    : !done.name
      ? 'Type your name, then Connect: a wire joins it to Open the studio'
      : !done.provider
        ? 'Right-click again to add a provider. Add as many as you have'
        : !done.workspace
          ? 'Last one required: the workspace folder. Or click its row on the right'
          : 'All set. Open the studio, or add tools, memory or GitHub'

  const hero = (
    <div
      className="absolute flex flex-col justify-end gap-5 text-link"
      style={{ left: HERO.x, top: HERO.y, width: HERO.w, height: HERO.h }}
    >
      <Ascii name="violin" fit="contain" className="relative h-64 w-full text-brand" />
      <h1 className="type-display-xl">Welcome to Orchestra.</h1>
      <p className="max-w-[44ch] type-body-l">
        This board is your setup. Everything in Orchestra works like this: cards on a board, joined
        by wires. Add a card for each thing on the right, connect it, and you&apos;re in.
      </p>
    </div>
  )

  if (!env) return <div className="bg-dots h-full" />
  return (
    <Board
      project={STUDIO}
      board="setup"
      label="Setup"
      crumbs={[
        { label: 'Orchestra' },
        { label: name.trim() && done.name ? `Hi, ${name.trim()}` : 'Setup' }
      ]}
      right={
        <button onClick={skip} className={barButton}>
          Skip the tour
        </button>
      }
      cards={cards}
      world={hero}
      worldRect={HERO}
      obstacles={[HERO]}
      focus={focus}
      addMenu={menu}
      top={<p className="bg-inverse px-3 py-2 type-label-s text-on-brand shadow-float">{hint}</p>}
    />
  )
}
