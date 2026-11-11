// First-time setup as a lesson in the artboard (Figma Mockups → Onboarding, O1–O6): a welcome
// modal, then you right-click to add a window for each thing Orchestra needs. Each window is
// wired to its row in Open the studio, docked on the right: dashed until it's connected, solid
// after. Windows show the real steps for connecting, and Connect only unlocks once it's true.
import { useEffect, useRef, useState } from 'react'
import type { MachineCheck, Setup as SetupData } from '../../../preload'
import { PROVIDERS, type ProviderId } from '../../../main/providers'
import { ACCOUNTS, GITHUB, GRAPHIFY, RECIPES, type SetupStep } from '../../../main/recipes'
import { Ascii } from '../components/Ascii'
import { Board, type CardSpec } from './Board'
import { Port } from './Port'
import { barButton } from './Chrome'
import { DOCK_TOP, STUDIO, type MenuItem } from './shared'

const SLOTS = [
  { id: 'name', label: 'Your name', row: 'Name', required: true },
  { id: 'provider', label: 'Provider', row: 'Provider', required: true },
  { id: 'workspace', label: 'Workspace folder', row: 'Workspace folder', required: true },
  { id: 'tools', label: 'Tools you use', row: 'Tools', required: false },
  { id: 'memory', label: 'Knowledge graph', row: 'Knowledge graph', required: false },
  { id: 'github', label: 'GitHub', row: 'GitHub', required: false }
] as const
type Slot = (typeof SLOTS)[number]['id']

export const TOOLS = [
  ['figma', 'Figma'],
  ['blender', 'Blender'],
  ['notion', 'Notion'],
  ['elevenlabs', 'ElevenLabs'],
  ['google-drive', 'Google Drive'],
  ['illustrator', 'Illustrator'],
  ['photoshop', 'Photoshop'],
  ['after-effects', 'After Effects'],
  ['fusion', 'Fusion'],
  ['rhino', 'Rhino'],
  ['spline', 'Spline']
] as const
const recipe = (tool: string): (typeof RECIPES)[number] | undefined =>
  RECIPES.find((r) => r.id === tool)
const toolName = (tool: string): string => TOOLS.find(([t]) => t === tool)?.[1] ?? tool

// the floating panel, with a fixed height per row so a wire can find its row
const DOCK_W = 380
const DOCK_HEAD = 88
const ROW_H = 52
const portOf = (slot: string): number =>
  DOCK_TOP + DOCK_HEAD + SLOTS.findIndex((s) => s.id === slot) * ROW_H + ROW_H / 2
// the board's opening view: the room left of the dock, so windows don't start behind it
const START = { x: 0, y: 0, w: 900 + DOCK_W, h: 640 }

const spot = (i: number): { x: number; y: number } => ({
  x: (i % 2) * 528,
  y: Math.floor(i / 2) * 528
})

export const primary =
  'serif-on h-10 bg-brand px-4 type-label-m text-on-brand hover:bg-inverse disabled:bg-placeholder disabled:text-on-brand'
const secondary =
  'serif-on h-10 border-[1.5px] border-brand px-4 type-label-m text-link hover:bg-brand hover:text-on-brand'
export const small =
  'serif-on h-8 shrink-0 border border-chip-line px-2.5 type-label-s text-link hover:bg-selected'
export const input =
  'w-full border-0 border-b-2 border-brand bg-transparent pb-2 type-body-l text-link outline-none placeholder:text-placeholder'
const choice = (on: boolean): string =>
  `flex flex-col items-start gap-0.5 p-2.5 text-left disabled:opacity-50 ${
    on ? 'serif-on bg-brand text-on-brand' : 'bg-card text-link enabled:hover:bg-selected'
  }`

export const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

/** One instruction: what to do, the command if there is one, and the way to do it from here. */
export function StepRow({
  n,
  step,
  after
}: {
  n: number
  step: SetupStep
  after: () => void // the step ran: look again at what's connected
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')
  async function go(): Promise<void> {
    setNote('')
    if (step.how === 'open') return window.api.openSetupStep(step.id)
    const r = await window.api.runSetupStep(step.id)
    setNote(r.ok ? (step.how === 'run' ? 'Done' : 'Opened a terminal') : r.out)
    after()
  }
  const action = { run: 'Run', terminal: 'Open terminal', open: 'Open page', manual: '' }[step.how]
  return (
    <li className="flex flex-col gap-1.5">
      <p className="flex gap-2 type-body-s text-link">
        <span className="font-mono text-[12px] leading-5">{n}</span>
        <span>{step.text}</span>
      </p>
      {step.cmd && (
        <div className="ml-5 flex items-stretch border border-hair">
          <code className="min-w-0 flex-1 px-2 py-1.5 font-mono text-[12px] break-all text-link">
            {step.cmd}
          </code>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(step.cmd!)
              setCopied(true)
            }}
            className="shrink-0 border-l border-hair px-2.5 type-label-s text-link hover:bg-selected"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}
      {action && (
        <div className="ml-5 flex items-center gap-3">
          <button onClick={() => void go()} className={small}>
            {action}
          </button>
          {note && <span className="min-w-0 type-caption break-words text-link">{note}</span>}
        </div>
      )}
    </li>
  )
}

type ProviderCard = { p?: ProviderId; how?: 'sub' | 'key'; key: string; err: string }
const NEW_PROVIDER: ProviderCard = { key: '', err: '' }

export function Setup({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [started, setStarted] = useState(false)
  const [home, setHome] = useState<string | null>(null)
  const [folder, setFolder] = useState('')
  const [machine, setMachine] = useState<MachineCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [open, setOpen] = useState<{ id: string; x: number; y: number }[]>([])
  const [wired, setWired] = useState<string[]>([])
  const [name, setName] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const [prov, setProv] = useState<Record<string, ProviderCard>>({})
  const [pending, setPending] = useState<string>() // a Connect that's still being checked
  const [finishError, setFinishError] = useState('')
  const [focus, setFocus] = useState<string>()
  // what each window's Connect button would do, so dragging its wire can do the same
  const gate = useRef<Record<string, () => void>>({})

  function check(): void {
    setChecking(true)
    void window.api
      .checkSetup()
      .then(setMachine)
      .finally(() => setChecking(false))
  }
  useEffect(() => {
    void window.api.loadSetup().then(({ setup, home: h }) => {
      setHome(h)
      setFolder(h)
      setName(setup.name)
    })
    check()
  }, [])

  const isWired = (id: string): boolean => wired.includes(id)
  const isProvider = (id: string): boolean => id.startsWith('provider-')
  const done: Record<Slot, boolean> = {
    name: isWired('name'),
    provider: wired.some(isProvider),
    workspace: isWired('workspace'),
    tools: isWired('tools'),
    memory: isWired('memory'),
    github: isWired('github')
  }
  const missing = SLOTS.filter((s) => s.required && !done[s.id])

  const wire = (id: string, on: boolean): void =>
    setWired((w) => (on ? [...w.filter((x) => x !== id), id] : w.filter((x) => x !== id)))
  function add(id: string, at?: { x: number; y: number }): void {
    if (open.some((c) => c.id === id)) return setFocus(id)
    setOpen((o) => [...o, { id, ...(at ?? spot(o.length)) }])
    setFocus(id) // always show the window you just opened
  }
  function addProvider(at?: { x: number; y: number }): void {
    let n = 1
    while (open.some((c) => c.id === `provider-${n}`)) n++
    add(`provider-${n}`, at)
  }
  function close(id: string): void {
    const c = prov[id]
    if (c?.p && c.how === 'key' && isWired(id)) void window.api.forgetKey(c.p)
    const gone = (x: string): boolean => x === id || (id === 'tools' && x.startsWith('mcp-'))
    setOpen((o) => o.filter((x) => !gone(x.id)))
    setWired((w) => w.filter((x) => !gone(x)))
    if (id === 'tools') setTools([])
  }
  function toggleTool(tool: string): void {
    const on = tools.includes(tool)
    setTools((t) => (on ? t.filter((x) => x !== tool) : [...t, tool]))
    if (!recipe(tool)) return
    if (on) return close(`mcp-${tool}`)
    // its steps open beside the Tools window; the board moves it clear of anything in the way
    const parent = open.find((c) => c.id === 'tools')
    add(`mcp-${tool}`, parent ? { x: parent.x + 528, y: parent.y } : undefined)
  }
  function menu(at: { x: number; y: number }): MenuItem[] {
    return SLOTS.map((s) =>
      s.id === 'provider'
        ? { label: 'Provider', run: () => addProvider(at) }
        : {
            label: s.label,
            run: open.some((c) => c.id === s.id) ? undefined : () => add(s.id, at)
          }
    )
  }
  function openRow(slot: Slot): void {
    if (slot !== 'provider') return add(slot)
    const first = open.find((c) => isProvider(c.id))
    if (first) setFocus(first.id)
    else addProvider()
  }
  function skip(): void {
    const ids = ['name', 'workspace', 'tools', 'memory', 'github']
    if (!open.some((c) => isProvider(c.id))) ids.splice(1, 0, 'provider-1')
    setOpen((o) => [
      ...o,
      ...ids
        .filter((id) => !o.some((c) => c.id === id))
        .map((id, i) => ({ id, ...spot(o.length + i) }))
    ])
    setFocus('name')
  }
  async function finish(): Promise<void> {
    setFinishError('')
    try {
      // a different folder restarts the app in it, so nothing after this runs in that case
      await window.api.finishSetup({
        done: true,
        name,
        providers: wired
          .filter(isProvider)
          .map((w) => prov[w]?.p)
          .filter((p): p is ProviderId => !!p),
        tools: done.tools ? tools : [],
        workspace: folder,
        memory: done.memory,
        github: done.github
      } satisfies SetupData)
      onDone()
    } catch (err) {
      setFinishError(reason(err))
    }
  }

  /** A window's last row: what it needs before it can connect, then Connect / Disconnect. */
  const connect = (
    id: string,
    ready: boolean,
    why: string,
    actions?: { on: () => Promise<void>; off: () => void }
  ): React.JSX.Element => {
    gate.current[id] = () => {
      if (!ready || isWired(id) || pending === id) return
      if (!actions) return wire(id, true)
      setPending(id)
      void actions.on().finally(() => setPending(undefined))
    }
    return (
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hair px-4 py-3">
        <span className="type-caption text-link opacity-70">
          {isWired(id) ? 'Connected' : ready ? '' : why}
        </span>
        {isWired(id) ? (
          <button
            onClick={() => {
              actions?.off()
              wire(id, false)
            }}
            className={secondary}
          >
            Disconnect
          </button>
        ) : (
          <button
            disabled={!ready || pending === id}
            onClick={() => {
              if (!actions) return wire(id, true)
              setPending(id)
              void actions.on().finally(() => setPending(undefined))
            }}
            className={primary}
          >
            {pending === id ? 'Checking…' : 'Connect'}
          </button>
        )}
      </div>
    )
  }
  const line = (k: string, v: React.ReactNode): React.JSX.Element => (
    <div className="flex justify-between gap-3 type-body-s text-link">
      <span>{k}</span>
      <span className="font-mono text-[12px] opacity-80">{v}</span>
    </div>
  )
  const steps = (list: SetupStep[]): React.ReactNode =>
    list.length > 0 && (
      <ol className="flex flex-col gap-3">
        {list.map((s, i) => (
          <StepRow key={s.id} n={i + 1} step={s} after={check} />
        ))}
      </ol>
    )
  const again = (
    <button onClick={check} disabled={checking} className={`${small} self-start`}>
      {checking ? 'Checking…' : 'Check again'}
    </button>
  )

  function providerBody(id: string): React.ReactNode {
    const c = prov[id] ?? NEW_PROVIDER
    const patch = (p: Partial<ProviderCard>): void =>
      setProv((all) => ({ ...all, [id]: { ...(all[id] ?? NEW_PROVIDER), ...p } }))
    const locked = isWired(id)
    const taken = Object.entries(prov)
      .filter(([k]) => k !== id)
      .map(([, v]) => v.p)
    const a = c.p && ACCOUNTS[c.p]
    const cli = c.p && machine?.clis[c.p]
    const signedIn = c.p === 'anthropic' ? !!machine?.claude.loggedIn : !!cli
    const todo: SetupStep[] = a && !signedIn ? (cli ? [a.login] : [a.install, a.login]) : []
    return (
      <>
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <p className="type-heading-m text-link">Which provider?</p>
            <div className="grid grid-cols-3 gap-px border border-hair bg-hair">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={c.p === p.id}
                  disabled={locked || taken.includes(p.id)}
                  onClick={() => patch({ p: p.id, how: undefined, err: '' })}
                  className={choice(c.p === p.id)}
                >
                  <span className="type-label-s">{ACCOUNTS[p.id].brand}</span>
                </button>
              ))}
            </div>
          </div>
          {a && (
            <div className="flex flex-col gap-2">
              <p className="type-label-m text-link">How do you pay for it?</p>
              <div className="grid grid-cols-2 gap-px border border-hair bg-hair">
                {(
                  [
                    ['sub', a.subscription, 'Sign in with your account'],
                    ['key', 'API key', 'Pay per use with a key']
                  ] as const
                ).map(([how, label, what]) => (
                  <button
                    key={how}
                    aria-pressed={c.how === how}
                    disabled={locked}
                    onClick={() => patch({ how, err: '' })}
                    className={choice(c.how === how)}
                  >
                    <span className="type-label-s">{label}</span>
                    <span className="font-mono text-[10px] opacity-70">{what}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {a && c.how === 'sub' && (
            <div className="flex flex-col gap-3">
              {line(
                c.p === 'anthropic' ? 'Claude Code' : `${a.brand} CLI`,
                !machine
                  ? 'Checking…'
                  : c.p === 'anthropic'
                    ? signedIn
                      ? `Signed in${machine.claude.plan ? ` · ${machine.claude.plan}` : ''}`
                      : 'Not signed in'
                    : cli
                      ? 'Installed'
                      : 'Not found'
              )}
              {steps(todo)}
              {!signedIn && again}
              {c.p !== 'anthropic' && cli && (
                <p className="type-caption text-link opacity-70">
                  Orchestra can see the tool, but can&apos;t tell whether you&apos;re signed in.
                </p>
              )}
            </div>
          )}
          {a && c.how === 'key' && !locked && (
            <div className="flex flex-col gap-3">
              {steps([a.getKey])}
              <input
                type="password"
                aria-label={`${a.brand} API key`}
                autoComplete="off"
                value={c.key}
                onChange={(e) => patch({ key: e.target.value, err: '' })}
                placeholder="Paste your API key"
                className={input}
              />
              {c.err && (
                <p role="alert" className="type-body-s text-signal-fg">
                  {c.err}
                </p>
              )}
              <p className="type-caption text-link opacity-70">
                Orchestra tests it with {a.brand}, then stores it encrypted on this computer, never
                in your workspace.
                {c.p === 'anthropic' && ' Agents will bill to this key, not your subscription.'}
              </p>
            </div>
          )}
          {a && c.p !== 'anthropic' && c.how && (
            <p className="type-caption text-link opacity-70">
              Agents only run on Claude so far. This is saved for when {a.brand} is supported.
            </p>
          )}
        </div>
        {c.how === 'key' && c.p
          ? connect(id, !!c.key.trim(), 'Paste your key first', {
              on: async () => {
                try {
                  await window.api.saveKey(c.p!, c.key)
                  patch({ key: '' })
                  wire(id, true)
                } catch (err) {
                  patch({ err: reason(err) })
                }
              },
              off: () => void window.api.forgetKey(c.p!)
            })
          : connect(
              id,
              !!c.how && signedIn,
              !c.p ? 'Pick a provider' : !c.how ? 'Pick how you pay' : 'Sign in first'
            )}
      </>
    )
  }

  function mcpBody(id: string): React.ReactNode {
    const r = recipe(id.slice(4))!
    const st = machine?.mcp[r.mcp]
    const ok = st === 'connected' || (r.local && !!st)
    return (
      <>
        <div className="flex flex-col gap-3 p-4">
          {line(
            'Claude Code',
            !machine
              ? 'Checking…'
              : ok
                ? 'Connected'
                : st === 'auth'
                  ? 'Added, needs sign-in'
                  : st === 'failed'
                    ? 'Added, not responding'
                    : 'Not added yet'
          )}
          {!ok && steps(r.steps)}
          {!ok && again}
        </div>
        {connect(id, !!ok, 'Finish the steps first')}
      </>
    )
  }

  function body(id: string): React.ReactNode {
    if (isProvider(id)) return providerBody(id)
    if (id.startsWith('mcp-')) return mcpBody(id)
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
              className={input}
            />
            <p className="type-caption text-link opacity-70">
              Used in greetings and on your covers. You can change it any time.
            </p>
          </div>
          {connect('name', !!name.trim(), 'Type a name first')}
        </>
      )
    if (id === 'workspace')
      return (
        <>
          <div className="flex flex-col gap-3 p-4">
            <p className="type-heading-m text-link">Where should your work live?</p>
            <div className="flex items-stretch border border-hair">
              <code className="min-w-0 flex-1 px-2 py-2 font-mono text-[12px] break-all text-link">
                {folder}
              </code>
              <button
                disabled={isWired('workspace')}
                onClick={() =>
                  void window.api.pickFolder(folder).then((f) => f !== null && setFolder(f))
                }
                className="shrink-0 border-l border-hair px-3 type-label-s text-link enabled:hover:bg-selected disabled:opacity-50"
              >
                Choose folder…
              </button>
            </div>
            <p className="type-caption text-link opacity-70">
              Your projects and agents go here, in plain files you can open yourself.
              {folder !== home &&
                ' Orchestra restarts in this folder when you finish, and projects in the old folder stay there.'}
            </p>
          </div>
          {connect('workspace', !!folder, 'Choose a folder')}
        </>
      )
    if (id === 'tools')
      return (
        <>
          <div className="flex flex-col gap-3 p-4">
            <p className="type-heading-m text-link">Which apps do you design in?</p>
            <div className="grid grid-cols-3 gap-px border border-hair bg-hair">
              {TOOLS.map(([tid, label]) => (
                <button
                  key={tid}
                  aria-pressed={tools.includes(tid)}
                  onClick={() => toggleTool(tid)}
                  className={choice(tools.includes(tid))}
                >
                  <span className="type-label-s">{label}</span>
                  <span className="font-mono text-[10px] opacity-70">
                    {recipe(tid) ? 'has MCP' : 'no MCP yet'}
                  </span>
                </button>
              ))}
            </div>
            <p className="type-caption text-link opacity-70">
              Apps with an MCP open their own window with the steps to connect them.
            </p>
          </div>
          {connect('tools', tools.length > 0, 'Optional: pick any')}
        </>
      )
    if (id === 'memory')
      return (
        <>
          <div className="flex flex-col gap-3 p-4">
            {line('Graphify', !machine ? 'Checking…' : machine.graphify ? 'Found' : 'Not found')}
            <p className="type-caption text-link opacity-70">
              Optional. Graphify maps each project so agents can find what came before. It runs on
              your Claude subscription.
            </p>
            {machine && !machine.graphify && (
              <>
                {steps([GRAPHIFY])}
                {again}
              </>
            )}
          </div>
          {connect('memory', !!machine?.graphify, 'Install Graphify first')}
        </>
      )
    const gh = machine?.gh
    const ghTodo = !gh
      ? []
      : gh.loggedIn
        ? []
        : gh.installed
          ? [GITHUB.login]
          : Object.values(GITHUB)
    return (
      <>
        <div className="flex flex-col gap-3 p-4">
          {line(
            'GitHub',
            !gh
              ? 'Checking…'
              : gh.loggedIn
                ? `Signed in${gh.user ? ` as ${gh.user}` : ''}`
                : gh.installed
                  ? 'Not signed in'
                  : 'Not installed'
          )}
          <p className="type-caption text-link opacity-70">
            Optional. For updates, and for keeping your own fork of Orchestra.
          </p>
          {steps(ghTodo)}
          {gh && !gh.loggedIn && again}
        </div>
        {connect('github', !!gh?.loggedIn, 'Sign in first')}
      </>
    )
  }

  const title = (id: string): string => {
    if (id.startsWith('mcp-')) return `${toolName(id.slice(4))} · MCP`
    if (isProvider(id)) {
      const p = prov[id]?.p
      return p ? `Provider · ${ACCOUNTS[p].brand}` : 'Provider'
    }
    return SLOTS.find((s) => s.id === id)?.label ?? id
  }

  const cards: CardSpec[] = open.map((c) => ({
    id: c.id,
    title: title(c.id),
    count: isWired(c.id) ? '✓' : undefined,
    x: c.x,
    y: c.y,
    w: c.id === 'tools' ? 400 : 380,
    body: (
      <div
        data-in={c.id === 'tools' ? 'tools' : undefined}
        className="relative flex min-h-40 flex-col"
      >
        {!isWired(c.id) && <Port out={c.id} side="right" hint="Drag to its row to connect" />}
        {body(c.id)}
      </div>
    ),
    onClose: () => close(c.id),
    ...(c.id.startsWith('mcp-')
      ? { link: 'tools' }
      : { port: portOf(isProvider(c.id) ? 'provider' : c.id) }),
    solid: isWired(c.id)
  }))

  const ready = missing.length === 0
  const dock = (
    <div
      className={`flex flex-col border border-chip-line shadow-float ${
        ready ? 'bg-brand text-on-brand' : 'bg-card text-link'
      }`}
    >
      <header
        className="flex shrink-0 flex-col justify-center gap-1 border-b border-hair px-5"
        style={{ height: DOCK_HEAD }}
      >
        <h2 className="type-heading-m">Open the studio</h2>
        <p className="type-body-s opacity-80">
          {ready
            ? 'Everything required is connected.'
            : `${missing.length} required ${missing.length === 1 ? 'item' : 'items'} left.`}
        </p>
      </header>
      <ul className="shrink-0">
        {SLOTS.map((s) => (
          <li key={s.id} className="border-b border-hair">
            <button
              data-in={s.id}
              onClick={() => openRow(s.id)}
              title={`Open ${s.label}`}
              className={`flex w-full items-center gap-3 px-5 text-left ${
                done[s.id]
                  ? 'bg-brand text-on-brand hover:bg-inverse'
                  : ready
                    ? 'hover:bg-inverse'
                    : 'hover:bg-selected'
              }`}
              style={{ height: ROW_H - 1 }}
            >
              <span className="w-4 font-mono text-[14px]">{done[s.id] ? '✓' : '○'}</span>
              <span className="flex-1 type-body-m">{s.row}</span>
              <span className="font-mono text-[11px] uppercase opacity-70">
                {s.required ? 'required' : 'optional'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 p-5">
        {finishError && (
          <p role="alert" className="bg-signal-subtle px-3 py-2 type-body-s text-signal-fg">
            {finishError}
          </p>
        )}
        <button
          disabled={!ready}
          onClick={() => void finish()}
          className={
            ready
              ? 'serif-on h-12 bg-card type-label-m text-link hover:bg-selected'
              : `${primary} h-12`
          }
        >
          Open the studio
        </button>
        <p className="type-caption opacity-80">You can change any of this later.</p>
      </div>
    </div>
  )

  const hint = !open.length
    ? 'Right-click anywhere on the board to add a window'
    : !done.name
      ? 'Type your name, then Connect: the dashed wire turns solid'
      : !done.provider
        ? 'Right-click again to add a provider. Add as many as you have'
        : !done.workspace
          ? 'Last one required: the workspace folder. Or click its row on the right'
          : 'All set. Open the studio, or add tools, the knowledge graph or GitHub'

  if (home === null) return <div className="bg-dots h-full" />
  return (
    <div className="h-full">
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
        worldRect={START}
        dock={{ width: DOCK_W, node: dock }}
        onPick={(from, to) => {
          const target = from.startsWith('mcp-') ? 'tools' : isProvider(from) ? 'provider' : from
          if (to === target) gate.current[from]?.()
        }}
        focus={focus}
        addMenu={menu}
        top={
          <p className="glass rounded-full border border-chip-line bg-chip px-4 py-2 type-label-s text-link shadow-float">
            {hint}
          </p>
        }
      />
      {!started && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/40 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="flex w-full max-w-[640px] flex-col gap-5 border border-chip-line bg-card p-10 text-link shadow-lift animate-[rise-in_240ms_var(--ease)_both]"
          >
            <Ascii name="violin" fit="contain" className="relative h-52 w-full text-brand" />
            <h1 id="welcome-title" className="type-display-l">
              Welcome to Orchestra.
            </h1>
            <p className="type-body-l">
              Everything in Orchestra is a window on a board, joined to others by wires. Setup works
              the same way: right-click the board to add a window for each item on the right, fill
              it in, and connect it. A dashed wire isn&apos;t connected yet. A solid one is.
            </p>
            <button
              autoFocus
              onClick={() => setStarted(true)}
              className={`${primary} h-14 self-start px-8`}
            >
              Get started with setup
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
