import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type {
  AgentState,
  ChatInfo,
  ChatMessage,
  CreateState,
  LogEntry,
  Musician,
  Ask,
  Output,
  Proposal,
  Previews,
  MachineCheck
} from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { NewCard } from '../canvas/Chrome'
import { Board, type CardSpec } from '../canvas/Board'
import { Wire } from '../canvas/Wire'
import type { Frame } from '../canvas/Book'
import {
  GENERAL,
  STUDIO,
  TOP_BAR,
  pendingFocus,
  popMenu,
  type AgentFileRef,
  type MenuItem
} from '../canvas/shared'
import { AgentFile } from './Agents'
import {
  LANE,
  LOCK_R,
  PREREQ,
  prereqSpots,
  SEAT,
  ORCH_CAP,
  ORCH_W,
  WINDOW_W,
  filesFor,
  outputPaths,
  mcpLabel,
  mcpState,
  mcpsOf,
  seatColumns,
  windowX
} from '../canvas/stage'
import { splitDecision, waitingOnUser, type Decision } from '../decide'
import { splitSuggestion } from '../suggest'
import { OpenQuestion } from './OpenQuestion'
import { splitGoTo, type Place } from '../goto'
import { OrchestratorFace } from '../canvas/OrchestratorFace'
import type { FaceState } from '../canvas/faceState'
import { Icon } from './Icon'
import { DeliverableEditor } from './DeliverableEditor'
import { DocWindow } from './DocWindow'
import { PrereqTags } from './PrereqTags'
import { Layers, type Layer } from './Layers'
import { PROVIDERS, provider } from '../../../main/providers'
import { OptionPreview } from './OptionPreview'
import { PreviewWindow } from './PreviewWindow'
import { Markdown } from './Research'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'
// a seat's light, from the Nocturne gradient set; picked by category so a family shares one
const SEAT_ORB = ['orb-peach', 'orb-pink', 'orb-green', 'orb-lilac', 'orb-blue']
const outlineButton =
  'flex h-9 shrink-0 items-center gap-2 border border-line-strong bg-canvas px-4 type-label-m transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.97]'

/** II · Create, one artboard. First you choose: every deliverable sits in one row, chosen ones
 * turn blue and wire down to the Deliverables circle and up to the foundations they need on
 * the Prerequisites ring. Hovering the circle with something chosen makes it Confirm. Once
 * confirmed, each chosen deliverable opens its own window in a row under the circle: its
 * chat, agents and files. Before that, nothing opens. */
export function Create({ project, frame }: { project: string; frame: Frame }): React.JSX.Element {
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [outputsRead, setOutputsRead] = useState(false)
  const [previews, setPreviews] = useState<Previews>({})
  const [agents, setAgents] = useState<Record<string, AgentState>>({})
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})
  const [asks, setAsks] = useState<Record<string, Ask>>({})
  const [general, setGeneral] = useState<ChatMessage[]>([]) // the Orchestrator's chat
  const [error, setError] = useState('')
  const [hover, setHover] = useState<string | null>(null) // a foundation pointed at
  // agent files opened as windows, each wired to the card it was opened from
  const [files, setFiles] = useState<{ ref: AgentFileRef; from: string }[]>([])
  // where a card added by right-click first appears (until it's dragged and saved)
  const [dropped, setDropped] = useState<Record<string, { x: number; y: number }>>({})
  // shortcut: confirmed is per viewer (localStorage); move it into deliverables.md if it
  // should follow the project to other machines
  const [lockedRaw, setLockedRaw] = useState(() => remembered(`confirmed:${project}`))
  // a card to bring into view: one just opened, or one the Needs you list points at
  const [focus, setFocus] = useState<string | undefined>(() => takeFocus(project))
  const [editing, setEditing] = useState<string | null>(null) // the deliverable being edited
  const [openDocs, setOpenDocs] = useState<string[]>([]) // prerequisites open as windows
  const [spawn, setSpawn] = useState<{ windows: { id: string; dx: number; dy: number }[] }>()
  const openDoc = useRef<(id: string) => void>(() => {})
  useEffect(() => {
    // double-clicking a prerequisite inside a deliverable's window
    const open = (e: Event): void => openDoc.current((e as CustomEvent<string>).detail)
    addEventListener('orchestra:open-doc', open)
    return () => removeEventListener('orchestra:open-doc', open)
  }, [])
  const [machine, setMachine] = useState<MachineCheck | null>(null) // what's really connected
  const lastCheck = useRef(0)
  function recheck(force = true): void {
    if (!force && Date.now() - lastCheck.current < 60_000) return
    lastCheck.current = Date.now()
    void window.api.checkSetup().then(setMachine, () => {})
  }
  useEffect(() => {
    if (frame.preview) return
    recheck()
    const look = (): void => recheck(false)
    addEventListener('focus', look)
    return () => removeEventListener('focus', look)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, per screen
  }, [frame.preview])
  const [hiddenLayers, setHiddenLayers] = useState(() => remembered(`hidden:${project}`))
  // Where you have moved the Deliverables stage and the Research group to, per project, and the
  // move in progress while a label is being dragged
  const [groupOff, setGroupOff] = useState(() => loadGroupOff(project))
  const [groupDrag, setGroupDrag] = useState<{
    g: 'stage' | 'research'
    dx: number
    dy: number
  } | null>(null)
  function dropGroup(g: 'stage' | 'research', dx: number, dy: number): void {
    setGroupDrag(null)
    const snapTo = (v: number): number => Math.round(v / 24) * 24
    setGroupOff((all) => {
      const next = { ...all, [g]: { x: snapTo(all[g].x + dx), y: snapTo(all[g].y + dy) } }
      saveGroupOff(project, next)
      return next
    })
  }
  function hideLayers(ids: string[]): void {
    setHiddenLayers(ids)
    remember(`hidden:${project}`, ids)
  }
  useEffect(() => {
    const look = (): void => {
      const card = takeFocus(project)
      if (card) setFocus(card)
    }
    addEventListener('orchestra:focus', look)
    return () => removeEventListener('orchestra:focus', look)
  }, [project])

  useEffect(() => {
    const load = (): void => void window.api.loadCreate(project).then(setPlan)
    load()
    // an agent file saved: names, jobs and crews come from the library
    addEventListener('orchestra:agents-changed', load)
    return () => removeEventListener('orchestra:agents-changed', load)
  }, [project])
  useEffect(() => {
    const load = (): void => {
      void window.api.listChats(project).then(setChats, () => {})
      void window.api.listOutputs(project).then(
        (o) => {
          setOutputs(o)
          setOutputsRead(true)
        },
        () => {}
      )
      void window.api.listPreviews(project).then(setPreviews, () => {})
      void window.api.agentStates(project).then(setAgents, () => {})
      void window.api.listProposals(project).then(setProposals, () => {})
      void window.api.listAsks(project).then(setAsks, () => {})
    }
    load()
    void window.api.loadChat(project, GENERAL).then(
      (c) => setGeneral(c.messages),
      () => {}
    )
    return window.api.onChatEvent((e) => {
      if (e.project !== project) return
      if (e.chat === GENERAL && e.kind === 'message') setGeneral((m) => [...m, e.message])
      if (e.kind !== 'live' && e.kind !== 'log') load()
    })
  }, [project, plan?.selected])

  if (!plan) return <div className="bg-dots h-full" />

  /** Locks in what's on and not yet locked. It only ever adds: nothing locked in comes back out. */
  function lockIn(): void {
    const fresh = plan!.selected.filter((id) => !lockedIn.includes(id))
    if (!fresh.length) return
    const next = [...lockedIn, ...fresh]
    setLockedRaw(next)
    remember(`confirmed:${project}`, next)
    setFocus('orchestrator')
    // the Orchestrator takes it from here: it asks which deliverable to start with
    const names = fresh.map((id) => musician(id)?.name ?? id).join(', ')
    void window.api
      .sendChat(
        project,
        GENERAL,
        confirmed
          ? `I have added to my deliverables: ${names}. Walk me through these too.`
          : `I have confirmed my deliverables: ${names}. Walk me through making them.`
      )
      .catch((e) => setError(reason(e)))
  }
  async function choose(ids: string[]): Promise<void> {
    setError('')
    try {
      const saved = await window.api.saveDeliverables(project, ids)
      setPlan({ ...plan!, selected: saved })
    } catch (e) {
      setError(reason(e))
    }
  }
  /** Once it's locked in, or work has started on it, a deliverable stays on. */
  const startedOn = (id: string): boolean =>
    lockedIn.includes(id) ||
    !!chats.find((x) => x.id === id)?.count ||
    Object.keys(agents).some((k) => k === id || k.startsWith(`${id}--`))
  async function seatMenu(id: string): Promise<void> {
    const chosen = plan!.selected.includes(id)
    const locked = startedOn(id)
    const c = await window.api.menu([
      {
        id: 'toggle',
        label: locked ? 'Locked in' : chosen ? 'Turn off' : 'Turn on',
        enabled: !locked
      },
      { id: 'edit', label: 'Edit deliverable…' },
      ...(lockedIn.includes(id) ? [{ id: 'instrument', label: 'Add an Instrument' }] : [])
    ])
    if (c === 'instrument') return void addInstrument(id)
    if (c === 'edit') return setEditing(id)
    if (c === 'toggle') seat(id)
  }
  /** A seat click turns the deliverable on or off, until work on it has started. */
  function seat(id: string): void {
    if (startedOn(id)) return
    const on = plan!.selected.includes(id)
    void choose(on ? plan!.selected.filter((s) => s !== id) : [...plan!.selected, id])
  }

  const instCard = (m: string, i: string): string => `inst--${m}--${i}`
  /** A blank Instrument in a deliverable's crew: its card appears (where you right-clicked,
   * else under the deliverable) with its file open beside it, to name it and give it a job. */
  async function addInstrument(m: string, at?: { x: number; y: number }): Promise<void> {
    setError('')
    try {
      const id = await window.api.newInstrument(m)
      if (at) setDropped((d) => ({ ...d, [instCard(m, id)]: at }))
      setPlan(await window.api.loadCreate(project))
      openFile({ role: 'instrument', id, name: 'New Instrument' }, instCard(m, id))
    } catch (e) {
      setError(reason(e))
    }
  }
  async function removeFromCrew(m: Musician, i: string): Promise<void> {
    setError('')
    try {
      await window.api.setCrew(
        m.id,
        m.instruments.filter((x) => x !== i)
      )
      setFiles((f) => f.filter((x) => x.from !== instCard(m.id, i)))
      setPlan(await window.api.loadCreate(project))
    } catch (e) {
      setError(reason(e))
    }
  }
  function openFile(ref: AgentFileRef, from: string): void {
    setFiles((f) => (f.some((x) => x.ref.id === ref.id) ? f : [...f, { ref, from }]))
    setFocus(`file-${ref.role}-${ref.id}`)
  }

  const seats = seatColumns(plan.musicians)
  const at = new Map(seats.map((s) => [s.id, s]))
  const musician = (id: string): Musician | undefined => plan.musicians.find((m) => m.id === id)
  const chosen = plan.selected.filter((id) => at.has(id))
  // ['1'] is how projects locked in before this was per-deliverable were remembered
  const lockedIn = lockedRaw.includes('1') ? plan.selected : lockedRaw
  const confirmed = lockedIn.length > 0
  const spawned = chosen.filter((id) => lockedIn.includes(id))
  const waitingToLock = chosen.filter((id) => !lockedIn.includes(id))
  const foundations = plan.instruments.filter((i) =>
    plan.musicians.some((m) => m.prerequisites.includes(i.id))
  )
  const lit = new Set(foundationOrder(plan.musicians, plan.instruments, chosen).map((i) => i.id))
  const lockY = Math.max(...seats.map((s) => s.y)) / 2 // the middle of the columns
  const spots = prereqSpots(foundations.length, lockY)
  const lockX = PREREQ.x + PREREQ.w / 2 + LANE + LOCK_R
  // the group around all of it, and the windows start clear of it
  const stageLeft = Math.min(...seats.map((s) => s.x)) - SEAT.w / 2 - 56
  const stageTop =
    Math.min(-SEAT.h / 2, lockY - LOCK_R, ...spots.map((s) => s.y - PREREQ.h / 2)) - 56
  const stageBottom =
    Math.max(lockY * 2 + SEAT.h / 2, lockY + LOCK_R, ...spots.map((s) => s.y + PREREQ.h / 2)) + 56
  const stageGroup = {
    x: stageLeft,
    y: stageTop,
    w: lockX + LOCK_R + 56 - stageLeft,
    h: stageBottom - stageTop
  }
  // the frame on the left: Lock in stands outside it, between it and the research
  const deliverablesRight = PREREQ.x + PREREQ.w / 2 + 56
  const deliverablesGroup = { ...stageGroup, w: deliverablesRight - stageLeft }
  const windowsY = stageGroup.y + stageGroup.h + 160
  // the stage and the research can each be moved; everything that hangs off them moves with them
  const moveOf = (g: 'stage' | 'research'): { x: number; y: number } => ({
    x: groupOff[g].x + (groupDrag?.g === g ? groupDrag.dx : 0),
    y: groupOff[g].y + (groupDrag?.g === g ? groupDrag.dy : 0)
  })
  const so = moveOf('stage')
  const ro = moveOf('research')
  const shifted = <T extends { x: number; y: number; bottom?: number }>(
    c: T,
    o: { x: number; y: number }
  ): T => ({
    ...c,
    x: c.x + o.x,
    y: c.y + o.y,
    ...(c.bottom === undefined ? {} : { bottom: c.bottom + o.y })
  })
  const spot = new Map(foundations.map((f, i) => [f.id, spots[i]]))
  // one that names no file can't be checked, so it never holds anything up (same in the conductor)
  const exists = (output: string): boolean => {
    const paths = outputPaths(output)
    return (
      !paths.length || paths.some((p) => outputs.some((o) => o.path === p || o.path.startsWith(p)))
    )
  }
  const needs = (id: string): ReturnType<typeof foundationOrder> =>
    foundationOrder(plan.musicians, plan.instruments, [id])
  const making = (id: string): boolean =>
    Object.entries(agents).some(([k, a]) => k.endsWith(`--${id}`) && a.status === 'working')

  const needsResearch =
    !frame.preview && outputsRead && !outputs.some((o) => /^research(\.md$|\/.*\.md$)/.test(o.path))
  // new deliverables and prerequisites are agents, so the Orchestrator proposes them for approval
  const ask = (text: string) => (): void => {
    dispatchEvent(new CustomEvent('orchestra:ask', { detail: text }))
  }
  /** The end of an agent's right-click menu: which model it runs on. */
  function modelItems(
    role: 'musician' | 'instrument',
    a?: { id: string; model: string; provider: string }
  ): MenuItem[] {
    if (!a) return []
    const p = provider(a.provider) ?? PROVIDERS[0]
    return [
      { label: '', separator: true },
      { label: `Model · ${p.name}` },
      ...p.models.map((m) => ({
        label: `${m.id === a.model ? '✓ ' : '    '}${m.name}`,
        run: () =>
          void window.api.editAgent(role, a.id, 'runsOn', `${p.id}/${m.id}`).then(
            () => dispatchEvent(new Event('orchestra:agents-changed')),
            (e) => setError(reason(e))
          )
      }))
    ]
  }
  const newItems: MenuItem[] = [
    { label: 'New deliverable', run: ask('I need a new deliverable: ') },
    { label: 'New prerequisite', run: ask('I need a new prerequisite: ') },
    ...(confirmed && spawned.length
      ? [
          { label: '', separator: true },
          ...spawned.map((d) => ({
            label: `New Instrument for ${musician(d)!.name}`,
            run: () => void addInstrument(d)
          }))
        ]
      : [])
  ]

  // the markdown files this project has made or is making, shown on the board to read
  const docs = [
    {
      id: 'research',
      name: 'Research',
      path: 'research.md',
      busy: false,
      link: 'orchestrator'
    },
    ...outputs
      .filter((o) => /^research\/.*\.md$/.test(o.path))
      .map((o) => ({
        id: `research-${o.path.slice(9, -3)}`,
        name: `Research · ${o.path.slice(9, -3)}`,
        path: o.path,
        busy: false,
        link: 'orchestrator'
      })),
    ...foundations
      .filter((f) => lit.has(f.id) || exists(f.output))
      .flatMap((f) => {
        const path = outputPaths(f.output).find((p) => p.endsWith('.md'))
        return path
          ? [
              {
                id: f.id,
                name: f.name,
                path,
                busy: making(f.id),
                link: 'orchestrator'
              }
            ]
          : []
      })
  ]
    .map((d) => ({ ...d, stamp: outputs.find((o) => o.path === d.path)?.modified }))
    .filter((d) => d.stamp || d.busy)

  /** A prerequisite's file: a window here if it's markdown, otherwise its own app. */
  function openPrereq(id: string): void {
    const doc = docs.find((d) => d.id === id)
    if (doc) {
      if (openDocs.includes(id)) return setFocus(`doc-${id}`)
      setOpenDocs((o) => [...o, id])
      return setSpawn({ windows: [{ id: `doc-${id}`, dx: 0, dy: 0 }] })
    }
    const f = foundations.find((x) => x.id === id)
    const file = f && outputs.find((o) => outputPaths(f.output).includes(o.path))
    if (file) void window.api.openOutput(project, file.path).catch(() => {})
  }
  openDoc.current = openPrereq

  // every chosen seat wires across to each foundation it needs, and those on to Lock in
  const wires = [
    ...chosen.flatMap((id) => {
      const s = at.get(id)!
      return musician(id)!
        .prerequisites.filter((f) => spot.has(f))
        .map((f) => ({
          key: `${id}-${f}`,
          x1: s.x + SEAT.w / 2,
          y1: s.y,
          x2: spot.get(f)!.x - PREREQ.w / 2,
          y2: spot.get(f)!.y,
          on: !hover || hover === f
        }))
    }),
    ...foundations
      .filter((f) => lit.has(f.id))
      .map((f) => ({
        key: `${f.id}-lock`,
        x1: spot.get(f.id)!.x + PREREQ.w / 2,
        y1: spot.get(f.id)!.y,
        x2: lockX - LOCK_R,
        y2: lockY,
        on: !hover || hover === f.id
      })),
    // with no prerequisites lit, the group itself still feeds Lock in
    ...(lit.size
      ? []
      : [
          {
            key: 'deliverables-lock',
            x1: deliverablesRight,
            y1: lockY,
            x2: lockX - LOCK_R,
            y2: lockY,
            on: false
          }
        ])
  ]

  const extent = { ...stageGroup, x: stageGroup.x + so.x, y: stageGroup.y + so.y }
  // what the windows must keep clear of
  const obstacles = [extent]
  const ready = chosen.length > 0
  /** What a deliverable's connections look like right now, for its seat. */
  const connection = (m: Musician): { text: string; bad: boolean } => {
    const needs = mcpsOf(m.tools)
    if (!needs.length) return { text: 'No connection needed', bad: false }
    if (!machine) return { text: needs.map(mcpLabel).join(', '), bad: false }
    const problem = needs.find((id) => mcpState(id, machine.mcp) !== 'connected')
    if (!problem) return { text: `${needs.map(mcpLabel).join(', ')} connected`, bad: false }
    const state = mcpState(problem, machine.mcp)
    return {
      text:
        mcpLabel(problem) +
        (state === 'auth'
          ? ': sign in again'
          : state === 'failed'
            ? ': not working'
            : ': not connected'),
      bad: true
    }
  }

  const world = (
    <div className="absolute top-0 left-0" style={{ transform: `translate(${so.x}px, ${so.y}px)` }}>
      <svg
        aria-hidden
        className="pointer-events-none absolute overflow-visible"
        style={{ left: 0, top: 0, width: 1, height: 1 }}
      >
        {wires.map((w) => (
          <Wire key={w.key} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} dim={!w.on} />
        ))}
      </svg>

      {/* the prerequisites, lit when a chosen deliverable needs one */}
      <p
        className="absolute text-center type-caption text-dim"
        style={{ left: PREREQ.x - 180, width: 360, top: spots[0]?.y - PREREQ.h / 2 - 28 }}
      >
        Prerequisites ·{' '}
        {lit.size ? `${lit.size} of ${foundations.length} needed` : 'built once, shared'}
        {' · double-click to open'}
      </p>
      {foundations.map((f, i) => {
        const on = lit.has(f.id)
        const state = !on ? '' : exists(f.output) ? 'Ready' : making(f.id) ? 'Making' : 'To make'
        return (
          <button
            key={f.id}
            onDoubleClick={() => openPrereq(f.id)}
            onPointerEnter={() => on && setHover(f.id)}
            onPointerLeave={() => setHover(null)}
            title={`${f.job}\n→ ${f.output}`}
            className={`absolute flex items-center justify-between gap-2 px-3 type-label-s whitespace-nowrap transition-colors duration-200 ${
              !on
                ? 'bg-card/50 text-placeholder'
                : state === 'Ready'
                  ? 'border border-success/75 bg-success-subtle text-fg'
                  : 'border border-card-line bg-card text-fg'
            }`}
            style={{
              left: spots[i].x - PREREQ.w / 2,
              top: spots[i].y - PREREQ.h / 2,
              width: PREREQ.w,
              height: PREREQ.h
            }}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${
                  !on ? 'bg-fg-disabled' : state === 'Ready' ? 'bg-success' : 'bg-agent'
                }`}
              />
              <span className="truncate">{f.name}</span>
            </span>
            {on && (
              <span className={`type-log-s ${state === 'Ready' ? 'text-success-fg' : 'text-dim'}`}>
                {state}
              </span>
            )}
          </button>
        )
      })}

      {seats.map((s) => {
        const m = musician(s.id)!
        const on = chosen.includes(m.id)
        const c = chats.find((x) => x.id === m.id)
        const locked = startedOn(m.id)
        const link = connection(m)
        // an approval waiting in its chat
        const needsYou = Object.values(proposals).some(
          (p) => p.chat === m.id && p.status === 'pending'
        )
        const status = !on
          ? 'Off'
          : !lockedIn.includes(m.id)
            ? 'On'
            : needsYou
              ? 'Needs you'
              : c?.busy
                ? 'Playing'
                : locked
                  ? 'Started'
                  : 'Not started'
        return (
          <button
            key={m.id}
            onClick={() => seat(m.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void seatMenu(m.id)
            }}
            aria-pressed={on}
            title={
              locked
                ? `${m.name} is locked on: work has started. Right-click to edit it.`
                : `${on ? 'Turn off' : 'Turn on'} ${m.name}: ${m.deliverable}`
            }
            className={`absolute flex flex-col items-center px-4 pt-5 pb-4 text-center transition-[background-color,color] duration-200 ease-(--ease) ${
              on
                ? 'seat-on'
                : 'border border-card-line bg-card text-link shadow-card hover:bg-selected'
            } ${locked ? 'cursor-default outline-2 outline-offset-4 outline-agent/45' : ''}`}
            style={{
              left: s.x - SEAT.w / 2,
              top: s.y - SEAT.h / 2,
              width: SEAT.w,
              height: SEAT.h
            }}
          >
            {needsYou && confirmed && (
              <span className="absolute -top-3 right-4 rounded-full bg-needs-you px-2.5 py-0.5 type-label-s text-on-needs-you">
                Needs you
              </span>
            )}
            <span
              className={`orb ${SEAT_ORB[m.category.length % SEAT_ORB.length]} flex size-9 shrink-0 items-center justify-center rounded-full ${on ? 'bg-white text-link' : 'bg-brand text-on-brand'}`}
            >
              <Icon name={m.icon} size={18} />
            </span>
            <span className="mt-3 type-heading-m leading-none">{m.name}</span>
            <span className={`mt-1.5 type-label-mono ${on ? 'text-poster-dim' : 'text-dim'}`}>
              {m.category}
            </span>
            <span
              className={`mt-2 rounded-full px-2.5 py-0.5 type-label-s ${
                !on ? 'border border-dashed border-wire' : 'bg-white text-link'
              }`}
            >
              {status}
            </span>
            <span
              className={`mt-auto w-full truncate px-1 py-0.5 type-caption ${
                link.bad ? 'bg-signal-subtle text-signal-fg' : on ? 'text-poster-dim' : 'text-dim'
              }`}
              title={link.text}
            >
              {link.text}
            </span>
          </button>
        )
      })}

      {/* lock in: opens the windows for what's on */}
      <button
        onClick={lockIn}
        disabled={waitingToLock.length === 0}
        title={
          !ready
            ? 'Turn on the deliverables this project needs'
            : waitingToLock.length
              ? 'Lock in the deliverables that are on'
              : 'Turn on another deliverable to add it'
        }
        className={`group absolute flex flex-col items-center justify-center gap-1 rounded-md px-4 text-center transition-colors duration-200 ease-(--ease) ${
          ready ? 'seat-on' : 'border border-card-line bg-card text-link shadow-card'
        }`}
        style={{
          left: lockX - LOCK_R,
          top: lockY - LOCK_R,
          width: LOCK_R * 2,
          height: LOCK_R * 2
        }}
      >
        <span className="type-accent">
          {waitingToLock.length
            ? confirmed
              ? `Add ${waitingToLock.length}`
              : 'Lock in'
            : confirmed
              ? 'Locked in'
              : 'Lock in'}
        </span>
        <span className={`type-label-mono ${ready ? 'text-poster-dim' : 'text-dim'}`}>
          {!ready ? 'Turn on your deliverables' : `${chosen.length} on`}
        </span>
      </button>
      {editing && musician(editing) && (
        <DeliverableEditor
          musician={musician(editing)!}
          foundations={foundations}
          machine={machine}
          onRecheck={() => recheck()}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  )

  // once confirmed: the Orchestrator's window under the circle, every deliverable's window
  // below it, and beside it the Action box, where its choices appear when it needs one; all
  // wired to the Orchestrator, because it is the only one you talk to
  const pending = (chat: string): boolean =>
    Object.values(proposals).some((p) => p.chat === chat && p.status === 'pending')
  // what the Orchestrator is waiting on, all in the Action box: approvals, its latest
  // unanswered question, deliverables it suggests, and the choices it put there
  const approvals = Object.values(proposals).filter((p) => p.status === 'pending')
  const lastSaid = general
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.role === 'orchestrator')
    .at(-1)
  const answered = lastSaid && general.slice(lastSaid.i + 1).some((m) => m.role === 'user')
  const generalBusy = !!chats.find((c) => c.id === GENERAL)?.busy
  const parsed =
    lastSaid && !answered
      ? splitSuggestion(lastSaid.m.text, new Set(plan.musicians.map((m) => m.id)))
      : null
  const question = parsed ? splitDecision(parsed.body).decision : null
  const suggested = (parsed?.ids ?? []).filter((id) => !plan.selected.includes(id))
  // only open choices: once picked, a choice leaves the box
  const asked = Object.values(asks)
    .filter((a) => a.status === 'open')
    .sort((a, b) => a.t.localeCompare(b.t))
  // questions each get a window of their own; this is what's left for the Action box
  const openEnded =
    question || suggested.length
      ? null
      : waitingOnUser(general, new Set(plan.musicians.map((m) => m.id)), plan.selected)
  const answerInChat = (text: string): Promise<boolean> =>
    window.api.sendChat(project, GENERAL, text).then(
      () => true,
      (e) => {
        setError(reason(e))
        return false
      }
    )
  const waiting =
    approvals.length + (question ? 1 : 0) + (suggested.length ? 1 : 0) + (openEnded ? 1 : 0)
  /** Whose group a question sits in: the deliverable it's about, or the one that needs it. */
  const askOwner = (about?: string): string | undefined =>
    about && spawned.includes(about)
      ? about
      : spawned.find((d) => about && musician(d)?.prerequisites.includes(about))
  const work: CardSpec[] = !confirmed
    ? []
    : [
        {
          id: 'orchestrator',
          kind: 'orchestrator' as const,
          auto: true,
          // starts straight below Lock in; you can move it, and its windows follow
          title: 'Orchestrator',
          count: chats.find((c) => c.id === GENERAL)?.busy ? 'thinking' : undefined,
          working: !!chats.find((c) => c.id === GENERAL)?.busy,
          x: lockX - ORCH_W / 2,
          y: windowsY,
          w: ORCH_W,
          tone: 'paper' as const,
          height: ORCH_CAP - 44, // under its 44px header
          needsYou: pending(GENERAL),
          body: (
            <ChatPanel
              project={project}
              chat={GENERAL}
              plan={plan}
              fill
              elsewhere
              onSelected={(ids) => {
                // a Musician approved in the chat is new to the library too, so reload it
                if (ids.every((x) => plan.musicians.some((m) => m.id === x)))
                  setPlan({ ...plan, selected: ids })
                else void window.api.loadCreate(project).then(setPlan)
              }}
            />
          )
        },
        ...asked.map((a): CardSpec => {
          const owner = askOwner(a.about)
          return {
            id: `ask-${a.id}`,
            kind: 'decision',
            auto: owner ? true : 'right',
            title: a.title,
            x: ORCH_W / 2 + 48,
            y: windowsY,
            w: ASK_W,
            link: owner ? `chat-${owner}` : 'orchestrator',
            needsYou: true,
            body: <AskWindow project={project} ask={a} onError={setError} />
          }
        }),
        {
          id: 'actions',
          kind: 'decision' as const,
          auto: 'right' as const,
          title: 'Action',
          count: waiting ? `${waiting} waiting` : undefined,
          x: ORCH_W / 2 + 48,
          y: windowsY,
          w: ASK_W,
          link: 'orchestrator',
          needsYou: waiting > 0,
          body: waiting ? (
            <div className="divide-y divide-hair">
              {approvals.map((p) => (
                <div key={p.id} className="p-5">
                  <Approval
                    p={p}
                    musicians={plan.musicians}
                    onDecide={async (yes) => {
                      setError('')
                      try {
                        await window.api.decideProposal(project, p.chat, p.id, yes)
                        if (yes && p.id.startsWith('musician:'))
                          setPlan(await window.api.loadCreate(project))
                      } catch (e) {
                        setError(reason(e))
                      }
                    }}
                  />
                </div>
              ))}
              {question && (
                <div className="p-5">
                  <DecisionCard decision={question} disabled={generalBusy} onPick={answerInChat} />
                </div>
              )}
              {openEnded && (
                <div className="p-5">
                  <OpenQuestion
                    key={openEnded.t}
                    question={openEnded.question}
                    disabled={generalBusy}
                    onSend={answerInChat}
                  />
                </div>
              )}
              {suggested.length > 0 && (
                <div className="p-5">
                  <Suggestion
                    items={plan.musicians.filter((m) => suggested.includes(m.id))}
                    added={false}
                    onAdd={() => choose([...plan.selected, ...suggested])}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="p-5 type-body-s text-dim">
              Nothing waiting on you. When the Orchestrator asks you something, it appears here.
            </p>
          )
        },
        ...spawned.map((id, i) => ({
          id: `chat-${id}`,
          kind: 'musician' as const,
          auto: true as const,
          title: musician(id)!.name,
          count: chats.find((c) => c.id === id)?.busy ? 'playing' : undefined,
          working: !!chats.find((c) => c.id === id)?.busy || agents[id]?.status === 'working',
          agent:
            agents[id]?.status === 'working'
              ? ('working' as const)
              : chats.find((c) => c.id === id)?.busy
                ? ('thinking' as const)
                : agents[id]?.status === 'error'
                  ? ('error' as const)
                  : undefined,
          x: windowX(i, spawned.length),
          y: windowsY + 960,
          w: WINDOW_W,
          link: 'orchestrator',
          solid: needs(id).every((f) => exists(f.output)),
          gate: needs(id).length > 0 && (
            <PrereqTags
              items={needs(id).map((f) => ({ id: f.id, name: f.name, ready: exists(f.output) }))}
              onOpen={openPrereq}
            />
          ),
          needsYou: pending(id),
          menu: [
            { label: 'Add an Instrument', run: () => void addInstrument(id) },
            {
              label: 'Open its file',
              run: () => openFile({ role: 'musician', id, name: musician(id)!.name }, `chat-${id}`)
            },
            ...modelItems('musician', musician(id))
          ],
          body: <ChatPanel project={project} chat={id} plan={plan} view="work" />
        })),
        // each deliverable's crew, one window per Instrument, under it and wired to it
        ...spawned.flatMap((id, i) => {
          const m = musician(id)!
          return m.instruments.map((iid, j): CardSpec => {
            const inst = plan.instruments.find((x) => x.id === iid)
            const card = instCard(id, iid)
            const state = agents[`${id}--${iid}`]
            const file: AgentFileRef = { role: 'instrument', id: iid, name: inst?.name ?? iid }
            return {
              id: card,
              kind: 'instrument' as const,
              // one you placed with a right-click stays where you put it
              auto: dropped[card] ? undefined : (true as const),
              title: inst?.name ?? iid,
              count: state ? STATUS[state.status].label : undefined,
              working: state?.status === 'working',
              agent:
                state?.status === 'done'
                  ? ('done' as const)
                  : state?.status === 'error'
                    ? ('error' as const)
                    : undefined,
              ...(dropped[card] ?? {
                x: windowX(i, spawned.length) + (j % 2) * (INST_W + 24),
                y: windowsY + 1800 + Math.floor(j / 2) * 300
              }),
              w: INST_W,
              link: `chat-${id}`,
              menu: [
                { label: 'Open its file', run: () => openFile(file, card) },
                { label: `Remove from ${m.name}`, run: () => void removeFromCrew(m, iid) },
                ...modelItems('instrument', inst)
              ],
              body: (
                <InstrumentCard
                  job={inst?.job}
                  output={inst?.output}
                  model={inst?.model}
                  missing={!inst}
                  onOpen={() => openFile(file, card)}
                />
              )
            }
          })
        }),
        // a place for the finished work, there from the start
        ...spawned
          .filter((id) => !previews[id]?.length)
          .map((id): CardSpec => ({
            id: `preview-${id}-empty`,
            kind: 'deliverable',
            auto: true,
            title: 'Preview',
            x: 0,
            y: windowsY + 2400,
            w: 360,
            link: `chat-${id}`,
            body: (
              <p className="flex aspect-[16/10] items-center justify-center p-6 text-center type-body-s text-dim">
                The finished work shows here. Click it to open the real thing.
              </p>
            )
          })),
        // finished work, under the deliverable it belongs to
        ...spawned.flatMap((id) =>
          (previews[id] ?? []).map((p): CardSpec => ({
            id: `preview-${id}-${p.label}`,
            kind: 'deliverable',
            auto: true,
            title: p.label,
            x: 0,
            y: windowsY + 2400,
            w: 360,
            link: `chat-${id}`,
            body: <PreviewWindow project={project} deliverable={id} preview={p} />
          }))
        ),
        // agent files opened from a card, beside it
        ...files.map(({ ref, from }): CardSpec => ({
          id: `file-${ref.role}-${ref.id}`,
          kind: 'file',
          auto: 'right',
          title: `${[...plan.instruments, ...plan.musicians].find((x) => x.id === ref.id)?.name ?? ref.name} · file`,
          x: 0,
          y: windowsY + 2600,
          w: 640,
          link: from,
          onClose: () => setFiles((f) => f.filter((x) => x.ref.id !== ref.id)),
          body: <AgentFile file={ref} />
        }))
      ]

  // the research sits to the right of the stage, there from the start
  const research = docs.filter((d) => d.id.startsWith('research'))
  const researchCards = research.map((d, i): CardSpec => ({
    id: `doc-${d.id}`,
    kind: 'file',
    title: d.name,
    count: d.path,
    x: stageGroup.x + stageGroup.w + 112 + i * 672,
    y: stageGroup.y,
    pin: true,
    bottom: stageBottom - 28, // its group's frame then ends level with the Deliverables frame
    w: 600,
    body: <DocWindow project={project} path={d.path} stamp={d.stamp} />
  }))
  const openedDocs = docs
    .filter((d) => openDocs.includes(d.id) && !d.id.startsWith('research'))
    .map((d): CardSpec => ({
      id: `doc-${d.id}`,
      kind: 'file',
      title: d.name,
      count: d.path,
      x: stageGroup.x,
      y: windowsY,
      w: 600,
      working: d.busy,
      onClose: () => setOpenDocs((o) => o.filter((x) => x !== d.id)),
      body: <DocWindow project={project} path={d.path} stamp={d.stamp} />
    }))
  const cards = [
    // the research rides along with the stage, and its own move comes on top of that
    ...researchCards.map((c) => shifted(c, { x: so.x + ro.x, y: so.y + ro.y })),
    ...openedDocs.map((c) => shifted(c, so)),
    ...work.map((c) => shifted(c, so))
  ]
  const byId = new Map(cards.map((c) => [c.id, c]))
  const ownerOf = (id: string): string | undefined => {
    for (let c = byId.get(id); c; c = c.link ? byId.get(c.link) : undefined)
      if (c.id.startsWith('chat-')) return c.id.slice(5)
    return undefined
  }
  const layers: Layer[] = confirmed
    ? [
        ...spawned.map((id) => ({
          id,
          name: musician(id)!.name,
          members: cards
            .filter((c) => ownerOf(c.id) === id)
            .map((c) => ({ id: c.id, title: c.title, kind: c.kind }))
        }))
      ]
    : []

  return (
    <Board
      project={project}
      board="create"
      label="II · Create"
      pages={frame.pages}
      preview={frame.preview}
      world={world}
      worldRect={extent}
      worldGroup={{
        name: 'Deliverables',
        rect: {
          ...deliverablesGroup,
          x: deliverablesGroup.x + so.x,
          y: deliverablesGroup.y + so.y
        },
        onDrag: (dx, dy) => setGroupDrag({ g: 'stage', dx, dy }),
        onDrop: (dx, dy) => dropGroup('stage', dx, dy)
      }}
      worldWire={
        confirmed ? { x: lockX + so.x, y: lockY + LOCK_R + so.y, to: 'orchestrator' } : undefined
      }
      worldFeeds={{
        x: lockX + LOCK_R + so.x,
        y: lockY + so.y,
        from: researchCards.map((c) => c.id)
      }}
      spawn={spawn}
      onSpawned={() => setSpawn(undefined)}
      obstacles={obstacles}
      focus={focus}
      onFocused={() => setFocus(undefined)}
      anchored={
        !needsResearch && (
          <>
            <NewCard
              title="New asset"
              hint="A deliverable, a prerequisite or an Instrument."
              onClick={() => void popMenu(newItems)}
            />
            {layers.length > 0 && (
              <Layers
                layers={layers}
                hidden={hiddenLayers}
                top={TOP_BAR + 74}
                onHidden={hideLayers}
                onFly={setFocus}
              />
            )}
          </>
        )
      }
      locked={
        needsResearch && (
          <div className="flex items-center gap-4 border border-chip-line bg-card py-2 pr-2 pl-4 shadow-float">
            <p className="type-body-s text-link">
              Research comes first. Interpret your references, and Create opens up.
            </p>
            <button
              onClick={() => frame.go?.('research')}
              className="serif-on h-9 shrink-0 bg-brand px-4 type-label-s text-on-brand hover:bg-inverse"
            >
              Go to Research
            </button>
          </div>
        )
      }
      addMenu={(at, sel): MenuItem[] => {
        if (!confirmed) return [{ label: 'Lock in your deliverables to add Instruments' }]
        // a deliverable's window, or one of its Instruments, selected: the menu is about it
        const id = /^chat-(.+)$/.exec(sel ?? '')?.[1] ?? /^inst--(.+?)--/.exec(sel ?? '')?.[1]
        const m = id && spawned.includes(id) ? musician(id) : undefined
        if (m)
          return [
            { label: `New Instrument for ${m.name}`, run: () => void addInstrument(m.id, at) },
            {
              label: `Open ${m.name}'s file`,
              run: () => openFile({ role: 'musician', id: m.id, name: m.name }, `chat-${m.id}`)
            }
          ]
        return spawned.map((d) => ({
          label: `New Instrument for ${musician(d)!.name}`,
          run: () => void addInstrument(d, at)
        }))
      }}
      top={
        error && (
          <p
            role="alert"
            className="border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
          >
            {error}
          </p>
        )
      }
      cards={cards}
      frames={[
        {
          id: 'research',
          name: 'Research',
          fixed: true,
          members: researchCards.map((c) => c.id),
          onDrag: (dx, dy) => setGroupDrag({ g: 'research', dx, dy }),
          onDrop: (dx, dy) => dropGroup('research', dx, dy)
        },
        ...layers.map((l) => ({
          id: `group:${l.id}`,
          name: l.name,
          members: l.members.map((m) => m.id)
        }))
      ]}
      hidden={layers
        .filter((l) => hiddenLayers.includes(l.id))
        .flatMap((l) => l.members.map((m) => m.id))}
    />
  )
}

type GroupOff = { stage: { x: number; y: number }; research: { x: number; y: number } }
/** Where the Deliverables stage and the Research group were last left (stored as strings). */
function loadGroupOff(project: string): GroupOff {
  const n = remembered(`group-off:${project}`).map((v) => Number(v) || 0)
  return { stage: { x: n[0] ?? 0, y: n[1] ?? 0 }, research: { x: n[2] ?? 0, y: n[3] ?? 0 } }
}
function saveGroupOff(project: string, o: GroupOff): void {
  remember(`group-off:${project}`, [o.stage.x, o.stage.y, o.research.x, o.research.y].map(String))
}

// Per-viewer memory (whether the stage is confirmed); storage can be unavailable, so it is
// guarded.
function remembered(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function remember(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // the app works the same without it
  }
}

const NO_PLAN: CreateState = { musicians: [], instruments: [], selected: [] }
// the Orchestrator's chat can run forever, so it alone scrolls: capped at 1920×3240's shape
const ASK_W = 432
const INST_W = 288 // two Instrument windows sit under each deliverable's

/** An Instrument's window under its deliverable: its one job, what it writes, its model. */
function InstrumentCard({
  job,
  output,
  model,
  missing,
  onOpen
}: {
  job?: string
  output?: string
  model?: string
  missing: boolean
  onOpen: () => void
}): React.JSX.Element {
  if (missing) return <p className="p-4 type-body-s text-signal-fg">Not in the library any more.</p>
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className={`type-body-s ${job ? 'text-link' : 'text-dim'}`}>
        {job || 'No job yet. Open its file to give it one.'}
      </p>
      {output && <p className="font-mono text-[11px] break-all text-dim">→ {output}</p>}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="type-caption text-dim">{model}</span>
        <button onClick={onOpen} className="type-label-s text-link hover:underline">
          Open its file
        </button>
      </div>
    </div>
  )
}

/** One choice in the Action box: the question, its options (with swatches when they are
 * colours), and a line to refine them. Picking answers it and it leaves the box; either way
 * the Orchestrator hears back. */
function AskWindow({
  project,
  ask,
  onError
}: {
  project: string
  ask: Ask
  onError: (e: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  async function answer(value: string, final: boolean): Promise<void> {
    if (!value.trim()) return
    setSending(true)
    try {
      await window.api.answerAsk(project, ask.id, value, final)
      setText('')
    } catch (e) {
      onError(reason(e))
    }
    setSending(false)
  }
  return (
    <div className="p-5">
      <p className="type-body-m text-fg">{ask.question}</p>
      <div className="mt-4 flex flex-col gap-2">
        {ask.options.map((o) => (
          <button
            key={o.label}
            disabled={sending}
            onClick={() => void answer(o.label, true)}
            className="flex flex-col gap-2 border border-card-line px-3 py-2.5 text-left text-link transition-colors duration-150 hover:border-brand hover:bg-selected"
          >
            <OptionPreview project={project} option={o} />
            <span className="type-label-m">{o.label}</span>
            {o.detail && <span className="type-caption text-dim">{o.detail}</span>}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void answer(text, false)
        }}
        className="mt-4"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          placeholder="Or type your own answer, then Enter"
          aria-label={`Refine ${ask.title}`}
          className="w-full border-0 border-b-2 border-brand bg-transparent py-1.5 type-body-s text-link outline-none placeholder:text-placeholder focus-visible:outline-none"
        />
      </form>
    </div>
  )
}

/** Where a question or approval used to sit in the chat: it's answered in the Action box. */
function ActionNote({ text, done }: { text: string; done: boolean }): React.JSX.Element {
  return (
    <p className="mt-3 flex items-center gap-2 type-caption text-dim">
      <span className={`size-2 rounded-full ${done ? 'border border-wire' : 'bg-needs-you'}`} />
      {done ? 'Answered in the Action box: ' : 'Waiting in the Action box: '}
      <span className="truncate text-link">{text}</span>
    </p>
  )
}

/** A card the Needs you list asked to show in this project, taken once. */
function takeFocus(project: string): string | undefined {
  const want = pendingFocus.current
  if (!want || want.project !== project) return undefined
  pendingFocus.current = null
  return want.card
}

/** One conversation with the Orchestrator, laid out as C7: the chat (or the agent channel),
 * then the agents' status and the files made, then the reply box. It is the card a seat opens
 * on the stage and the panel above the Orchestrator bar (which brings its own input, so
 * `composer` is off there). In the Studio there are no agents or files, only the chat. */
export function ChatPanel({
  project,
  chat,
  plan = NO_PLAN,
  composer = true,
  view = 'full',
  fill = false,
  elsewhere = false,
  projects = [],
  onGo,
  onSelected = () => {}
}: {
  project: string
  chat: string
  plan?: CreateState
  composer?: boolean
  // full: everything (a window on the board) · conversation: just the back-and-forth (the bar's
  // window) · agents: their status and what the Orchestrator says to them (beside the bar) ·
  // work: a deliverable's window, its agents and files, no talking (you talk to the Orchestrator)
  view?: 'full' | 'conversation' | 'agents' | 'work'
  fill?: boolean // fill a fixed-height window; the conversation scrolls inside it
  elsewhere?: boolean // its questions and approvals appear in the Action box instead
  projects?: { id: string; name: string }[] // for the cards a "Go to:" line makes
  onGo?: (place: Place) => void
  onSelected?: (ids: string[]) => void
}): React.JSX.Element {
  const studio = project === STUDIO
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [channel, setChannel] = useState(false) // the agent channel instead of the conversation
  const [agents, setAgents] = useState<Record<string, AgentState>>({})
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})

  useEffect(() => {
    window.api.loadChat(project, chat).then((c) => {
      setMessages(c.messages)
      setLog(c.log)
      setBusy(c.busy)
    })
    const loadProposals = (): void =>
      void (studio || window.api.listProposals(project).then(setProposals))
    loadProposals()
    const loadOutputs = (): void =>
      void (studio || window.api.listOutputs(project).then(setOutputs))
    loadOutputs()
    const loadAgents = (): void => void (studio || window.api.agentStates(project).then(setAgents))
    loadAgents()
    return window.api.onChatEvent((e) => {
      if (e.project === project && e.kind === 'agents') {
        loadAgents()
        loadOutputs() // an agent may have written files
      }
      if (e.project !== project || e.chat !== chat) return
      if (e.kind === 'live') setLive(e.text)
      if (e.kind === 'log') setLog((l) => [...l, e.entry])
      if (e.kind === 'message') {
        setMessages((m) => [...m, e.message])
        if (e.message.role === 'orchestrator') setLive('')
        if (e.message.role !== 'orchestrator') loadProposals() // a new card, or a decision
      }
      if (e.kind === 'busy') {
        setBusy(e.busy)
        if (!e.busy) {
          setLive('')
          loadOutputs() // a turn may have written files
        }
      }
      if (e.kind === 'error') setError(e.text)
    })
  }, [project, chat, studio])

  async function send(text: string): Promise<boolean> {
    setError('')
    try {
      await window.api.sendChat(project, chat, text)
      return true
    } catch (e) {
      setError(reason(e))
      return false
    }
  }
  const stop = (): void => void window.api.stopChat(project, chat).catch((e) => setError(reason(e)))

  async function add(ids: string[]): Promise<void> {
    setError('')
    try {
      onSelected(await window.api.saveDeliverables(project, [...plan.selected, ...ids]))
    } catch (e) {
      setError(reason(e))
    }
  }

  async function decide(id: string, approve: boolean): Promise<void> {
    setError('')
    try {
      await window.api.decideProposal(project, chat, id, approve)
      // an approved Musician joins the deliverables, with its own chat
      if (approve && id.startsWith('musician:'))
        onSelected((await window.api.loadCreate(project)).selected)
    } catch (e) {
      setError(reason(e))
    }
  }

  const focus = plan.musicians.find((m) => m.id === chat)
  // Musicians and Instruments busy on this chat's behalf
  const working = Object.values(agents).filter(
    (a) => a.chat === chat && a.status === 'working'
  ).length
  const files = focus ? filesFor(focus, plan.instruments, outputs) : outputs

  const status = (
    <section className="px-5 py-3">
      <h3 className="type-label-mono text-link">Agent status</h3>
      <div className="mt-2">
        <Score plan={plan} focus={focus?.id} busy={busy} outputs={outputs} agents={agents} />
      </div>
    </section>
  )
  const made = (
    <section className="border-t border-hair">
      <h3 className="px-5 pt-3 type-label-mono text-link">Created files · {files.length}</h3>
      <Files project={project} outputs={files} />
    </section>
  )

  if (view === 'work')
    return (
      <div className="flex flex-col">
        {focus && (
          <p className="border-b border-hair px-5 py-3 type-caption text-fg-2">
            {focus.deliverable}
          </p>
        )}
        {status}
        {made}
      </div>
    )
  if (view === 'agents')
    return (
      <div className="flex h-full min-h-0 flex-col">
        {!studio && <div className="shrink-0 border-b border-hair">{status}</div>}
        <h3 className="shrink-0 px-5 pt-3 type-label-mono text-link">To its agents</h3>
        <div className="flex min-h-0 flex-1 flex-col px-5">
          <AgentChannel log={log} busy={busy || working > 0} onStop={stop} plan={plan} />
        </div>
      </div>
    )

  const only = view === 'conversation'
  const scrolls = only || fill
  return (
    <div className={`flex flex-col ${scrolls ? 'h-full min-h-0' : ''}`}>
      {!only && (
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hair px-5 py-3">
          <p className="line-clamp-2 type-caption text-fg-2">
            {studio
              ? 'Every project, with the Orchestrator'
              : focus
                ? focus.deliverable
                : 'The whole project, with the Orchestrator'}
          </p>
          <div role="radiogroup" aria-label="View" className="flex shrink-0 border border-line">
            {(
              [
                [false, 'Conversation'],
                [true, 'Agent channel']
              ] as const
            ).map(([on, label]) => (
              <button
                key={label}
                role="radio"
                aria-checked={channel === on}
                onClick={() => setChannel(on)}
                className={`flex h-7 items-center px-2.5 transition-colors duration-150 ${channel === on ? 'bg-selected type-current-s text-link' : 'type-label-s text-fg-2 hover:text-link'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`flex flex-col px-5 ${scrolls ? 'min-h-0 flex-1' : 'min-h-[220px]'}`}>
        {channel && !only ? (
          <AgentChannel log={log} busy={busy || working > 0} onStop={stop} plan={plan} />
        ) : (
          <Conversation
            messages={messages}
            busy={busy}
            live={live}
            musicians={plan.musicians}
            selected={plan.selected}
            proposals={proposals}
            onAdd={add}
            onAnswer={send}
            onDecide={decide}
            scroll={scrolls}
            elsewhere={elsewhere}
            projects={projects}
            here={studio ? undefined : project}
            onGo={onGo}
          />
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
          >
            {error}
          </p>
        )}
      </div>

      {composer && (
        <div className="shrink-0 border-t border-hair px-5">
          <Composer busy={busy} working={working} onSend={send} onStop={stop} />
        </div>
      )}
    </div>
  )
}

/** The Orchestrator's mark, so its messages read as a person in the chat. */
function Avatar({
  size = 'md',
  state = 'idle'
}: {
  size?: 'sm' | 'md'
  state?: FaceState
}): React.JSX.Element {
  // the same glowing sphere as the bar and the window header
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center">
      <OrchestratorFace size={size === 'sm' ? 16 : 24} state={state} />
    </span>
  )
}

function Conversation({
  messages,
  busy,
  live,
  musicians,
  selected,
  proposals,
  onAdd,
  onAnswer,
  onDecide,
  scroll,
  projects,
  here,
  onGo,
  elsewhere = false
}: {
  messages: ChatMessage[]
  busy: boolean
  live: string
  musicians: Musician[]
  selected: string[]
  proposals: Record<string, Proposal>
  onAdd: (ids: string[]) => Promise<void>
  onAnswer: (text: string) => Promise<boolean>
  onDecide: (id: string, approve: boolean) => Promise<void>
  scroll: boolean // in the bar's fixed window; on the artboard the card grows instead
  projects: { id: string; name: string }[]
  here?: string
  onGo?: (place: Place) => void
  elsewhere?: boolean // the questions and approvals show in the Action box, not here
}): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroll) end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, live, busy, scroll])
  const known = new Set(musicians.map((m) => m.id))
  const projectIds = new Set(projects.map((p) => p.id))
  const nameOf = (id: string): string => projects.find((p) => p.id === id)?.name ?? id

  return (
    <div
      className={`flex flex-col gap-5 py-6 ${scroll ? 'min-h-0 flex-1 overflow-y-auto pr-2' : ''}`}
      aria-live="polite"
    >
      {messages.length === 0 && !busy && (
        <p className="py-4 type-body-m text-fg-2">
          Tell the Orchestrator what you want made, or just think out loud. It reads your concept
          and research, and it can suggest deliverables as the conversation goes.
        </p>
      )}
      {messages.map((m, i) => {
        if (m.role === 'note')
          return (
            <p
              key={i}
              className="flex items-center gap-3 type-caption text-fg-2 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line"
            >
              {m.text}
            </p>
          )
        if (m.role === 'user')
          return (
            <div key={i} className="flex flex-col items-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md border border-hair bg-[var(--color-glass-fill-strong)] px-4 py-3 type-body-m whitespace-pre-wrap">
                {m.text}
              </p>
              <span className="mt-1 type-caption text-fg-2">{time(m.t)}</span>
            </div>
          )
        if (m.role === 'proposal') {
          const p = m.ref ? proposals[m.ref] : undefined
          if (!p) return null
          return elsewhere ? (
            <ActionNote key={i} done={p.status !== 'pending'} text={m.text} />
          ) : (
            <Approval key={i} p={p} musicians={musicians} onDecide={(yes) => onDecide(p.id, yes)} />
          )
        }
        const went = splitGoTo(m.text, projectIds, here)
        const split = splitSuggestion(went.body, known)
        const { body, decision } = splitDecision(split.body)
        const ids = split.ids
        // answered by the next thing the user said, if anything
        const reply = messages.slice(i + 1).find((x) => x.role === 'user')
        return (
          <OrchestratorSays key={i} t={m.t}>
            <Markdown text={body} className="[&>*:first-child]:mt-1" />
            {went.places.map((p, j) => {
              const a =
                p.area &&
                { research: 'I Research', create: 'II Create', refine: 'III Refine' }[p.area]
              return (
                <button
                  key={j}
                  onClick={() => onGo?.(p)}
                  disabled={!onGo}
                  className="group mt-3 flex w-full items-center gap-3 border border-card-line bg-card px-3 py-2.5 text-left text-link shadow-card hover:bg-selected"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center bg-brand text-on-brand">
                    <Icon name="arrow-right-up-line" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-label-serif-l">
                      {p.project === here && a ? a : nameOf(p.project)}
                    </span>
                    <span className="type-caption text-dim">
                      {p.project === here
                        ? 'In this project'
                        : a
                          ? `Open at ${a}`
                          : 'Open the project'}
                    </span>
                  </span>
                </button>
              )
            })}
            {elsewhere && (decision || ids.length > 0) && (
              <ActionNote
                done={!!reply || (ids.length > 0 && ids.every((id) => selected.includes(id)))}
                text={decision ? decision.question : 'Suggested deliverables'}
              />
            )}
            {!elsewhere && decision && (
              <DecisionCard
                decision={decision}
                answer={reply?.text}
                disabled={busy}
                onPick={onAnswer}
              />
            )}
            {!elsewhere && ids.length > 0 && (
              <Suggestion
                items={musicians.filter((x) => ids.includes(x.id))}
                added={ids.every((id) => selected.includes(id))}
                onAdd={() => onAdd(ids)}
              />
            )}
          </OrchestratorSays>
        )
      })}
      {busy && (
        <OrchestratorSays live>
          {live ? (
            <Markdown
              text={splitDecision(splitSuggestion(live, known).body).body}
              className="[&>*:first-child]:mt-1"
            />
          ) : (
            <p className="mt-1 type-body-s text-fg-2">Reading the project…</p>
          )}
        </OrchestratorSays>
      )}
      <div ref={end} />
    </div>
  )
}

/** The Orchestrator's turn: its mark on the left, the text flowing beside it, no bubble. */
function OrchestratorSays({
  t,
  live,
  children
}: {
  t?: string
  live?: boolean // it is mid-reply: the sphere thinks
  children: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex gap-3 pr-[10%]">
      <Avatar state={live ? 'thinking' : 'idle'} />
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center gap-2">
          <span className="type-label-m">Orchestrator</span>
          {t && <span className="type-caption text-fg-2">{time(t)}</span>}
        </div>
        {children}
      </div>
    </div>
  )
}

/** The Orchestrator's suggestion to add deliverables, as a card with one button. */
function Suggestion({
  items,
  added,
  onAdd
}: {
  items: Musician[]
  added: boolean
  onAdd: () => Promise<void>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border border-brand bg-brand-subtle px-4 py-3">
      <div className="min-w-0">
        <p className="type-label-m">
          {added ? 'In your deliverables' : 'Add to your deliverables'}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 type-body-s">
          {items.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5">
              <Icon name={m.icon} className="text-link" />
              {m.name}
            </span>
          ))}
        </p>
      </div>
      {added ? (
        <span className="flex items-center gap-1.5 type-label-s text-fg-2">
          <Icon name="check-line" />
          Added, each with its own chat
        </span>
      ) : (
        <button
          disabled={adding}
          onClick={async () => {
            setAdding(true)
            await onAdd()
            setAdding(false)
          }}
          className={solidButton}
        >
          {adding ? 'Adding…' : 'Add to deliverables'}
        </button>
      )}
    </div>
  )
}

/** A question the Orchestrator needs answered: one button per option. Picking one sends it as
 * your reply; typing an answer instead works too. Signal marks it while it waits on you. */
function DecisionCard({
  decision,
  answer,
  disabled,
  onPick
}: {
  decision: Decision
  answer?: string // what you replied next, once you have
  disabled: boolean
  onPick: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [sending, setSending] = useState('')
  const answered = answer !== undefined
  return (
    <div
      className={`mt-3 border-l-2 px-4 py-3 ${answered ? 'border-line-strong bg-subtle' : 'border-signal bg-signal-subtle'}`}
    >
      <p className="flex items-center gap-2 type-label-m">
        {!answered && <span className="type-caption text-signal-fg">Needs you</span>}
        {decision.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {decision.options.map((o) => {
          const chosen = answered && answer.trim().toLowerCase() === o.label.toLowerCase()
          if (answered)
            return (
              <span
                key={o.label}
                className={`flex h-9 items-center gap-1.5 border px-4 ${chosen ? 'border-fg type-current-s' : 'border-line type-label-m text-fg-disabled'}`}
              >
                {chosen && <Icon name="check-line" size={14} />}
                {o.label}
              </span>
            )
          return (
            <button
              key={o.label}
              disabled={disabled || !!sending}
              onClick={async () => {
                setSending(o.label)
                if (!(await onPick(o.label))) setSending('')
              }}
              className={o.recommended ? solidButton : outlineButton}
            >
              {sending === o.label ? 'Sending…' : o.label}
              {o.recommended && sending !== o.label && (
                <span className="ml-2 type-caption opacity-80">Recommended</span>
              )}
            </button>
          )
        })}
      </div>
      {answered &&
        !decision.options.some((o) => o.label.toLowerCase() === answer.trim().toLowerCase()) && (
          <p className="mt-2 type-caption text-fg-2">You answered in your own words.</p>
        )}
    </div>
  )
}

/** A new agent waiting for your approval: what it would own, how it runs, and its full
 * instructions behind a disclosure. Nothing is saved to the library until you approve. */
function Approval({
  p,
  musicians,
  onDecide
}: {
  p: Proposal
  musicians: Musician[]
  onDecide: (approve: boolean) => Promise<void>
}): React.JSX.Element {
  const [working, setWorking] = useState<'approve' | 'decline' | ''>('')
  const d = p.draft as Proposal['draft'] & Record<string, unknown>
  const isMusician = p.kind === 'musician'
  const by = isMusician
    ? 'the Orchestrator'
    : `the ${musicians.find((m) => m.id === p.from)?.name ?? p.from} Musician`
  const list = (k: string): string[] => (Array.isArray(d[k]) ? (d[k] as string[]) : [])
  const facts: [string, string][] = isMusician
    ? [
        ['Owns', String(d.deliverable ?? '')],
        ['Category', String(d.category ?? '')],
        ['Foundations', list('prerequisites').join(', ') || 'none'],
        ['Instruments', list('instruments').join(', ') || 'none yet: it proposes its own'],
        ['Model', String(d.model ?? 'sonnet')]
      ]
    : [
        ['Job', String(d.job ?? '')],
        ['Writes', String(d.output ?? '')],
        ['Needs', list('needs').join(', ') || 'nothing'],
        ['Model', String(d.model ?? 'haiku')]
      ]
  const pending = p.status === 'pending'

  async function decide(approve: boolean): Promise<void> {
    setWorking(approve ? 'approve' : 'decline')
    await onDecide(approve)
    setWorking('')
  }

  return (
    <div
      className={`border-l-2 py-3 pr-4 pl-4 ${pending ? 'border-signal bg-signal-subtle' : 'border-line-strong bg-subtle'}`}
    >
      <p className="type-caption text-fg-2">
        {pending && <span className="mr-2 text-signal-fg">Needs you</span>}
        New {isMusician ? 'Musician' : 'Instrument'}, proposed by {by}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <Icon
          name={isMusician ? String(d.icon || 'shapes-line') : 'box-3-line'}
          className="text-link"
        />
        <span className="type-heading-xs">{d.name}</span>
      </p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 type-body-s">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 group">
        <summary className="cursor-pointer type-label-s text-link hover:underline">
          Read its instructions
        </summary>
        <div className="mt-2 max-h-72 overflow-y-auto border border-line bg-canvas px-4 py-2">
          <Markdown text={String(d.prompt ?? '')} />
        </div>
      </details>
      <div className="mt-4 flex items-center gap-2">
        {pending ? (
          <>
            <button disabled={!!working} onClick={() => void decide(true)} className={solidButton}>
              {working === 'approve' ? 'Adding…' : `Approve and add to the library`}
            </button>
            <button
              disabled={!!working}
              onClick={() => void decide(false)}
              className={outlineButton}
            >
              {working === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 type-label-s text-fg-2">
            <Icon name={p.status === 'approved' ? 'check-line' : 'close-line'} />
            {p.status === 'approved' ? 'Approved: in the library' : 'Declined'}
          </span>
        )}
      </div>
    </div>
  )
}

function Composer({
  busy,
  working,
  onSend,
  onStop
}: {
  busy: boolean
  working: number // Musicians and Instruments busy for this chat; you can still type meanwhile
  onSend: (text: string) => Promise<boolean>
  onStop: () => void
}): React.JSX.Element {
  const [text, setText] = useState('')

  async function submit(): Promise<void> {
    if (busy || !text.trim()) return
    const sent = text
    setText('')
    if (!(await onSend(sent))) setText(sent) // keep what they wrote if it didn't go
  }

  function keys(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="shrink-0 pt-3 pb-5">
      <div className="rounded-2xl border border-hair bg-[var(--color-glass-fill)] transition-colors duration-150 focus-within:border-[var(--color-accent)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={keys}
          rows={3}
          placeholder="Ask for a change, or give your agents a new direction…"
          aria-label="Message the Orchestrator"
          className="block w-full resize-none bg-transparent px-4 pt-3 type-body-m outline-none placeholder:text-fg-2"
        />
        <div className="flex items-center justify-between gap-4 px-4 pb-3">
          <span className="flex items-center gap-2 type-caption text-fg-2">
            {busy
              ? 'Working… stop it at any time'
              : working
                ? `${working} agent${working === 1 ? '' : 's'} working for this chat`
                : 'Enter to send · Shift+Enter for a new line'}
            {!busy && working > 0 && (
              <button onClick={onStop} className="type-label-s text-link hover:underline">
                Stop all
              </button>
            )}
          </span>
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop"
              title="Stop what the agents are doing"
              className="flex size-9 items-center justify-center rounded-full bg-inverse text-inverse transition-[background-color,scale] duration-150 hover:opacity-85 active:scale-[0.95]"
            >
              <Icon name="stop-fill" />
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={!text.trim()}
              aria-label="Send"
              className="flex size-9 items-center justify-center rounded-full bg-inverse text-inverse transition-[opacity,scale] duration-150 hover:opacity-85 active:scale-[0.95] disabled:bg-[var(--color-glass-fill-strong)] disabled:text-fg-disabled disabled:opacity-100"
            >
              <Icon name="arrow-up-line" size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Read-only oversight: every agent's actions and words in this chat, terminal-style. */
function AgentChannel({
  log,
  busy,
  onStop,
  plan
}: {
  log: LogEntry[]
  busy: boolean
  onStop: () => void
  plan: CreateState // to name and mark each speaker
}): React.JSX.Element {
  const speaker = (agent: string): { name: string; mark: ReactNode } => {
    if (agent === 'orchestrator')
      return {
        name: 'Orchestrator',
        mark: (
          <span className="flex size-4 items-center justify-center rounded-full bg-on-brand text-brand">
            <Icon name="logo-mark" size={10} />
          </span>
        )
      }
    const [m, i] = agent.split('--')
    const musician = plan.musicians.find((x) => x.id === m)
    if (!i)
      return {
        name: musician?.name ?? m,
        mark: (
          <span className="flex size-4 items-center justify-center rounded-full border border-on-brand">
            <Icon name={musician?.icon ?? 'shapes-line'} size={9} />
          </span>
        )
      }
    return {
      name: plan.instruments.find((x) => x.id === i)?.name ?? i,
      mark: <span className="mx-1 size-2 rounded-full border border-on-brand" />
    }
  }
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [log.length])

  return (
    <div className="mt-6 mb-6 flex min-h-0 flex-1 flex-col bg-brand text-on-brand">
      <div className="flex items-center justify-between gap-4 border-b border-on-brand/15 px-4 py-2.5">
        <span className="type-log-s text-on-brand/60">agent channel · read-only</span>
        {busy ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 border border-on-brand px-2.5 py-1 type-log-s text-on-brand transition-colors duration-150 hover:bg-on-brand hover:text-brand"
          >
            <Icon name="stop-fill" size={12} />
            Stop all agents
          </button>
        ) : (
          <span className="type-log-s text-on-brand/60">idle</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-label="Agent channel">
        {log.length === 0 && (
          <p className="type-log-s text-on-brand/60">
            Nothing yet. Every agent action in this chat shows up here: what the Orchestrator, its
            Musicians and their Instruments read, write and say to each other.
          </p>
        )}
        {log.map((e, i) =>
          e.kind === 'turn' ? (
            <p key={i} className="my-1.5 type-log-s text-on-brand/45">
              ── {e.text} · {time(e.t)}
            </p>
          ) : (
            <p key={i} className="flex gap-2.5 type-log-s">
              <span className="w-16 shrink-0 whitespace-nowrap text-on-brand/45">{time(e.t)}</span>
              <span className="flex w-44 shrink-0 items-center gap-1.5">
                {speaker(e.agent).mark}
                <span className="truncate text-on-brand/80" title={e.agent.replace('--', ' › ')}>
                  {speaker(e.agent).name}
                </span>
              </span>
              <span
                className={`min-w-0 ${e.kind === 'say' ? 'line-clamp-3 text-on-brand/70' : e.kind === 'message' ? 'line-clamp-4 text-on-brand' : 'text-on-brand'}`}
              >
                {e.kind === 'say' ? `“${e.text}”` : e.text}
              </span>
            </p>
          )
        )}
        <div ref={end} />
      </div>
    </div>
  )
}

// ---- The score: agents (round nodes) and the work they make (square document nodes) ----

type Tone = 'ready' | 'working' | 'idle'
function Badge({ tone, children }: { tone: Tone; children: ReactNode }): React.JSX.Element {
  const look = {
    ready: 'bg-success-subtle text-success-fg',
    working: 'bg-brand-subtle text-link',
    idle: 'bg-muted text-fg-2'
  }[tone]
  return <span className={`shrink-0 px-2 py-0.5 type-label-s ${look}`}>{children}</span>
}

// Tree lines: each child gets an elbow from its parent's stem; the last child's stem stops at it.
const branch =
  'relative pl-6 before:absolute before:top-3.5 before:left-2 before:w-3 before:border-t before:border-line-strong after:absolute after:top-0 after:left-2 after:h-full after:border-l after:border-line-strong last:after:h-3.5'

/** An agent: a round marker. Orchestrator filled, Musicians ringed with their icon, Instruments small. */
function AgentNode({
  name,
  role,
  icon,
  status,
  children
}: {
  name: string
  role: 'Orchestrator' | 'Musician' | 'Instrument'
  icon?: string
  status?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  const marker =
    role === 'Orchestrator' ? (
      <Avatar size="sm" />
    ) : role === 'Musician' ? (
      <span className="flex size-6 items-center justify-center rounded-full border-2 border-brand bg-canvas text-link">
        <Icon name={icon ?? 'shapes-line'} size={12} />
      </span>
    ) : (
      <span className="mx-1.5 size-3 rounded-full border-2 border-fg-2 bg-canvas" />
    )
  return (
    <>
      <div className="flex min-h-7 items-center gap-2.5">
        {marker}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className={`truncate ${role === 'Instrument' ? 'type-body-s' : 'type-label-m'}`}>
            {name}
          </span>
          {role !== 'Orchestrator' && (
            <span className="shrink-0 type-caption text-fg-2">{role}</span>
          )}
        </span>
        {status}
      </div>
      {children && <ul className="mt-1 ml-3 flex flex-col gap-1">{children}</ul>}
    </>
  )
}

/** A piece of work (a foundation file or a finished deliverable): a square document marker. */
function WorkNode({
  name,
  ready,
  making = false,
  hint
}: {
  name: string
  ready: boolean
  making?: boolean // its Instrument is working on it now
  hint: string
}): React.JSX.Element {
  return (
    <div className="flex min-h-7 items-center gap-2.5" title={hint}>
      <span
        className={`flex size-5 items-center justify-center border ${ready ? 'border-success bg-success-subtle text-success-fg' : 'border-dashed border-line-strong bg-canvas text-fg-2'}`}
      >
        <Icon name={ready ? 'check-line' : 'file-text-line'} size={12} />
      </span>
      <span className={`min-w-0 flex-1 truncate type-body-s ${ready ? '' : 'text-fg-2'}`}>
        {name}
      </span>
      <span
        className={`shrink-0 type-caption ${ready ? 'text-success-fg' : making ? 'text-link' : 'text-fg-2'}`}
      >
        {ready ? 'Ready' : making ? 'Making…' : 'To make'}
      </span>
    </div>
  )
}

/** Work is named for what gets made, not who makes it: "prereqs/logo/" reads as "Logo". */
function workName(output: string, fallback: string): string {
  const file = /prereqs\/([\w-]+)/.exec(output)?.[1]
  if (!file) return fallback
  const words = file.replace(/-/g, ' ')
  return words[0].toUpperCase() + words.slice(1)
}

/** A Musician's or Instrument's status as a badge (Musicians) or a short word (Instruments). */
const STATUS: Record<AgentState['status'], { label: string; tone: Tone }> = {
  working: { label: 'Working', tone: 'working' },
  waiting: { label: 'Waiting', tone: 'idle' },
  done: { label: 'Done', tone: 'ready' },
  stopped: { label: 'Stopped', tone: 'idle' },
  error: { label: 'Error', tone: 'idle' }
}

function Score({
  plan,
  focus,
  busy,
  outputs,
  agents
}: {
  plan: CreateState
  focus?: string // a deliverable's chat shows only that deliverable's part of the tree
  busy: boolean
  outputs: Output[]
  agents: Record<string, AgentState> // keyed "musician" or "musician--instrument"
}): React.JSX.Element {
  // a foundation is being made while any Musician's run of its Instrument is working
  const making = (instrument: string): boolean =>
    Object.entries(agents).some(([k, a]) => k.endsWith(`--${instrument}`) && a.status === 'working')
  const ids = focus ? [focus] : plan.selected
  const chosen = plan.musicians.filter((m) => ids.includes(m.id))
  const foundations = foundationOrder(plan.musicians, plan.instruments, ids) // a few dozen items
  const names = new Map(plan.instruments.map((i) => [i.id, i.name]))
  // a foundation is ready once the first file its output names exists in the project
  const exists = new Set(outputs.map((o) => o.path))
  const ready = (output: string): boolean => {
    const file = /prereqs\/[\w./-]+/.exec(output)?.[0]
    return !!file && (exists.has(file) || outputs.some((o) => o.path.startsWith(file + '/')))
  }

  return (
    <section>
      <div className="flex items-baseline justify-end gap-3">
        <span className="flex items-center gap-3 type-caption text-fg-2">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full border-2 border-brand" /> Agent
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 border border-dashed border-line-strong" /> Work
          </span>
        </span>
      </div>

      <div className="mt-4">
        <AgentNode
          name="Orchestrator"
          role="Orchestrator"
          status={<Badge tone={busy ? 'working' : 'ready'}>{busy ? 'Working' : 'Ready'}</Badge>}
        >
          {foundations.length > 0 && (
            <li className={branch}>
              <p className="flex min-h-7 items-center type-caption text-fg-2">
                Foundations · shared, built first
              </p>
              <ul className="ml-3 flex flex-col">
                {foundations.map((f) => (
                  <li
                    key={f.id}
                    className={branch}
                    onDoubleClick={() =>
                      dispatchEvent(new CustomEvent('orchestra:open-doc', { detail: f.id }))
                    }
                  >
                    <WorkNode
                      name={workName(f.output, f.name)}
                      ready={ready(f.output)}
                      making={making(f.id)}
                      hint={`Made by the ${f.name} Instrument → ${f.output}`}
                    />
                  </li>
                ))}
              </ul>
            </li>
          )}
          {chosen.map((m) => (
            <li key={m.id} className={branch}>
              <AgentNode
                name={m.name}
                role="Musician"
                icon={m.icon}
                status={
                  agents[m.id] ? (
                    <Badge tone={STATUS[agents[m.id].status].tone}>
                      {STATUS[agents[m.id].status].label}
                    </Badge>
                  ) : (
                    <Badge tone="idle">Not started</Badge>
                  )
                }
              >
                {m.instruments.map((i) => (
                  <li key={i} className={branch}>
                    <AgentNode
                      name={names.get(i) ?? i}
                      role="Instrument"
                      status={
                        agents[`${m.id}--${i}`] && (
                          <span
                            className={`shrink-0 type-caption ${agents[`${m.id}--${i}`].status === 'working' ? 'text-link' : 'text-fg-2'}`}
                          >
                            {STATUS[agents[`${m.id}--${i}`].status].label}
                          </span>
                        )
                      }
                    />
                  </li>
                ))}
                {m.instruments.length === 0 && (
                  <li className={branch}>
                    <p className="flex min-h-7 items-center type-caption text-fg-2">
                      Proposes its Instruments on its first job
                    </p>
                  </li>
                )}
                <li className={branch}>
                  <WorkNode
                    name={m.name}
                    ready={agents[m.id]?.status === 'done'}
                    making={agents[m.id]?.status === 'working'}
                    hint={m.deliverable}
                  />
                </li>
              </AgentNode>
            </li>
          ))}
          {chosen.length === 0 && (
            <li className={branch}>
              <p className="flex min-h-7 items-center type-body-s text-fg-2">
                No deliverables yet.
              </p>
            </li>
          )}
        </AgentNode>
      </div>
    </section>
  )
}

const KIND: Record<string, string> = {
  md: 'Markdown',
  json: 'JSON',
  png: 'PNG',
  jpg: 'JPG',
  svg: 'SVG',
  pdf: 'PDF',
  glb: 'GLB'
}
const kb = (n: number): string =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`

function Files({ project, outputs }: { project: string; outputs: Output[] }): React.JSX.Element {
  const [error, setError] = useState('')
  return (
    <section className="px-5 py-3">
      {outputs.length === 0 ? (
        <p className="py-2 type-body-s text-fg-2">
          Nothing yet. Files appear here as they’re written.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hair">
          {outputs.map((o) => {
            const ext = o.path.split('.').pop()?.toLowerCase() ?? ''
            return (
              <li key={o.path}>
                <button
                  onClick={() =>
                    window.api.openOutput(project, o.path).catch((e) => setError(reason(e)))
                  }
                  title={o.path}
                  className="flex w-full items-start gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-subtle"
                >
                  <Icon
                    name={
                      ['png', 'jpg', 'svg'].includes(ext)
                        ? 'image-line'
                        : ext === 'md'
                          ? 'file-text-line'
                          : 'file-line'
                    }
                    className="mt-0.5 text-fg-2"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-label-m">{o.path.split('/').pop()}</span>
                    <span className="mt-0.5 block type-caption text-fg-2">
                      {KIND[ext] ?? ext.toUpperCase()} · {kb(o.size)} · {time(o.modified)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-2 type-caption text-signal-fg">{error}</p>}
    </section>
  )
}
