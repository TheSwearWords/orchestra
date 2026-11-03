import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Instrument, Musician } from './library.ts'
import { startOrchestraMcp, type Hub, type OrchestraMcp, type Role } from './orchestra-mcp.ts'
import { foundationOrder } from './plan.ts'
import {
  draftProblems,
  readProposals,
  saveProposal,
  type InstrumentDraft,
  type MusicianDraft,
  type Proposal
} from './proposals.ts'
import { ClaudeSession, type ToolUse } from './session.ts'

// Create's agents. A project has several chats: "general" for the whole project and one per
// chosen deliverable. Each chat has its Orchestrator, the only agent the user talks to. The
// Orchestrator briefs Musicians (one per deliverable, keyed by its id), and Musicians run their
// Instruments (keyed "<musician>--<instrument>"). Every agent is its own Claude session on its
// library model. Chat history, the agent channel log, sessions and agent statuses live in the
// project's .orchestra folder (hidden in Obsidian); handoff notes go in notes/ to be readable.

export interface ChatMessage {
  t: string // ISO time
  // a note is the app's own line (a hand-over, a stop, a report); a proposal is an approval card
  role: 'user' | 'orchestrator' | 'note' | 'proposal'
  text: string
  ref?: string // a proposal's id
}

/** One line of the agent channel: what an agent did or said, for oversight. */
export interface LogEntry {
  t: string
  agent: string // 'orchestrator', a Musician id, or "<musician>--<instrument>"
  kind: 'tool' | 'say' | 'turn' | 'message'
  text: string
}

export type AgentStatus = 'working' | 'waiting' | 'done' | 'stopped' | 'error'
export interface AgentState {
  status: AgentStatus
  chat: string // the chat it was briefed from, where its activity is logged
  updated: string
}

type EventBody =
  | { kind: 'live'; text: string } // the Orchestrator's reply so far, while it streams
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'busy'; busy: boolean } // the Orchestrator is answering
  | { kind: 'log'; entry: LogEntry }
  | { kind: 'agents' } // a Musician or Instrument changed status
  | { kind: 'error'; text: string }
export type ChatEvent = { project: string; chat: string } & EventBody

export const GENERAL = 'general'
const ID = /^[a-z0-9][a-z0-9-]*$/
const READ_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch']
// agents lead through Orchestra's own hierarchy, never Claude subagents, and have no shell yet
const NOT_ALLOWED = ['Task', 'Agent', 'Bash']
const MAX_WORKING = 4 // Musicians and Instruments working at once, per project
const MESSAGES_PER_HOUR = 40 // briefs and reports between agents, per project

/** Where a chat's Orchestrator writes its handoff note before its context fills up. */
export const handoffFile = (chat: string): string =>
  chat === GENERAL ? 'notes/orchestrator.md' : `notes/orchestrator-${chat}.md`
// Claude's context is ~200k tokens; hand over well before Claude Code would compact on its own.
const HANDOFF_AT = Number(process.env.ORCHESTRA_HANDOFF_TOKENS) || 140_000
const handoffPrompt = (chat: string): string =>
  `This conversation is getting long, so you'll continue in a fresh session. Write a handoff note to ${handoffFile(chat)} (replace the file) so that session can pick up exactly where you are: the user's goals and every decision so far, what has been made (with file paths), which Musicians you have briefed and where they stand, what is planned next and in what order, open questions, and anything the user asked you to remember. Write it for yourself, plainly. Then reply only: Saved.`

const orchestra = (project: string): string => join(project, '.orchestra')
const chatDir = (project: string, chat: string): string => {
  if (!ID.test(chat)) throw new Error('Unknown chat.')
  return join(orchestra(project), 'chats', chat)
}
const chatFile = (project: string, chat: string, name: string): string =>
  join(chatDir(project, chat), name)

/** Before chats, a project had one conversation in .orchestra/; it becomes the general chat.
 * Chats load in parallel, so the move runs once per project and the others wait for it. */
const migrating = new Map<string, Promise<void>>()
function migrate(project: string): Promise<void> {
  let p = migrating.get(project)
  if (!p) {
    p = moveOldChat(project)
    migrating.set(project, p)
  }
  return p
}
async function moveOldChat(project: string): Promise<void> {
  const old = join(orchestra(project), 'chat.jsonl')
  if (!(await stat(old).catch(() => null))) return
  const dir = chatDir(project, GENERAL)
  if (await stat(join(dir, 'chat.jsonl')).catch(() => null)) return
  await mkdir(dir, { recursive: true })
  await rename(old, join(dir, 'chat.jsonl'))
  await rename(join(orchestra(project), 'session.json'), join(dir, 'session.json')).catch(() => {})
}

async function readLines<T>(path: string, keep: (x: T) => boolean): Promise<T[]> {
  const text = await readFile(path, 'utf8').catch(() => '')
  return text
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        const x = JSON.parse(l) as T
        return x && keep(x) ? [x] : []
      } catch {
        return [] // a half-written line from a crash; skip it rather than lose the rest
      }
    })
}

export async function readChat(project: string, chat: string): Promise<ChatMessage[]> {
  await migrate(project)
  return readLines<ChatMessage>(chatFile(project, chat, 'chat.jsonl'), (m) =>
    ['user', 'orchestrator', 'note', 'proposal'].includes(m.role)
  )
}

export async function readLog(project: string, chat: string): Promise<LogEntry[]> {
  return readLines<LogEntry>(
    chatFile(project, chat, 'log.jsonl'),
    (e) => typeof e.text === 'string'
  )
}

async function append(project: string, chat: string, name: string, x: unknown): Promise<void> {
  await mkdir(chatDir(project, chat), { recursive: true })
  await appendFile(chatFile(project, chat, name), JSON.stringify(x) + '\n')
}

/** A short, readable line for a tool call in the agent channel. */
export function describeTool(name: string, input: Record<string, unknown> = {}): string {
  const s = (k: string): string => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const path = s('file_path') || s('path') || s('notebook_path')
  const short = path.replace(/\\/g, '/').replace(/^.*\/(projects\/[^/]+\/|library\/)/, '$1')
  switch (name) {
    case 'Read':
      return `read ${short}`
    case 'Write':
      return `wrote ${short}`
    case 'Edit':
    case 'MultiEdit':
      return `edited ${short}`
    case 'Glob':
      return `looked for ${s('pattern')}`
    case 'Grep':
      return `searched for "${s('pattern')}"`
    case 'WebFetch':
      return `opened ${s('url')}`
    case 'WebSearch':
      return `searched the web for "${s('query')}"`
    default:
      return name.replace(/^mcp__\w+__/, '').replace(/_/g, ' ')
  }
}

/** Splits an agent key into its library ids: a Musician, or a Musician's Instrument. */
export function parseAgent(key: string): { musician: string; instrument?: string } {
  const [musician, instrument] = key.split('--')
  return instrument ? { musician, instrument } : { musician }
}

export interface ConductorOptions {
  emit: (e: ChatEvent) => void
  projectDir: (project: string) => string
  library: () => Promise<{ musicians: Musician[]; instruments: Instrument[] }>
  selected: (projectDir: string) => Promise<string[]>
  orchestratorModel: () => Promise<string>
  /** Instructions for a chat's Orchestrator: library prompt, house rules, project and chat. */
  orchestratorPrompt: (project: string, chat: string) => Promise<string>
  /** Instructions for a Musician or Instrument: its library prompt, house rules, how to work. */
  agentPrompt: (project: string, key: string) => Promise<string>
  /** Folders outside the project agents may read (the agent library). */
  extraDirs: string[]
  /** Writes an approved proposal into the library. */
  adopt: (p: Proposal) => Promise<void>
  /** Adds a newly approved Musician to the project's deliverables. */
  addDeliverable: (projectDir: string, id: string) => Promise<void>
}

interface Orchestrator {
  s: ClaudeSession
  handingOver: boolean
  started: number
}

interface RunningAgent {
  s: ClaudeSession
  role: 'musician' | 'instrument'
  chat: string
}

export class Conductor implements Hub {
  private orchestrators = new Map<string, Orchestrator>() // "<project>/<chat>"
  private agents = new Map<string, RunningAgent>() // "<project>/<agent key>"
  private states = new Map<string, Record<string, AgentState>>() // project → agent key → state
  private sent = new Map<string, number[]>() // project → times of messages between agents
  private mcp!: OrchestraMcp
  private opts: ConductorOptions

  constructor(opts: ConductorOptions) {
    this.opts = opts
  }

  async init(): Promise<void> {
    this.mcp = await startOrchestraMcp(this)
  }

  isBusy(project: string, chat: string): boolean {
    return this.orchestrators.get(`${project}/${chat}`)?.s.busy ?? false
  }

  // ---- the conversation with the user ----

  async send(project: string, chat: string, text: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    if (this.isBusy(project, chat)) throw new Error('The Orchestrator is still answering.')
    const o = await this.orchestrator(project, chat)
    await this.say(project, chat, { t: now(), role: 'user', text: clean })
    await this.log(project, chat, 'orchestrator', 'turn', 'new message from you')
    this.turn(project, chat, o, clean)
  }

  /** Stops everything in a chat: its Orchestrator and every agent briefed from it. The
   * conversation is kept; the next message resumes it. */
  async stop(project: string, chat: string): Promise<void> {
    const key = `${project}/${chat}`
    const o = this.orchestrators.get(key)
    const wasBusy = o?.s.busy ?? false
    if (o) {
      o.s.kill()
      this.orchestrators.delete(key)
    }
    const states = await this.statesOf(project)
    let stoppedAgents = 0
    for (const [agentKey, a] of [...this.agents]) {
      if (!agentKey.startsWith(`${project}/`) || a.chat !== chat) continue
      a.s.kill()
      this.agents.delete(agentKey)
      const id = agentKey.slice(project.length + 1)
      if (states[id]?.status === 'working') {
        states[id] = { ...states[id], status: 'stopped', updated: now() }
        stoppedAgents++
      }
    }
    if (stoppedAgents) await this.saveStates(project, chat)
    if (!wasBusy && !stoppedAgents) return
    await this.say(project, chat, { t: now(), role: 'note', text: 'Stopped by you.' })
    await this.log(project, chat, 'orchestrator', 'turn', 'stopped by you')
    this.opts.emit({ project, chat, kind: 'busy', busy: false })
  }

  stopAll(): void {
    for (const o of this.orchestrators.values()) o.s.kill()
    for (const a of this.agents.values()) a.s.kill()
    this.orchestrators.clear()
    this.agents.clear()
  }

  /** Every Musician's and Instrument's status in a project, for the tree. */
  async agentStates(project: string): Promise<Record<string, AgentState>> {
    return { ...(await this.statesOf(project)) }
  }

  // ---- the Orchestrator's session ----

  private async orchestrator(project: string, chat: string): Promise<Orchestrator> {
    const key = `${project}/${chat}`
    const existing = this.orchestrators.get(key)
    if (existing) return existing
    const dir = this.opts.projectDir(project)
    const emit = (e: EventBody): void => this.opts.emit({ project, chat, ...e })
    const o: Orchestrator = {
      s: undefined as unknown as ClaudeSession,
      handingOver: false,
      started: 0
    }
    o.s = await ClaudeSession.start(
      {
        cwd: dir,
        sessionFile: chatFile(dir, chat, 'session.json'),
        model: await this.opts.orchestratorModel(),
        systemPrompt: await this.opts.orchestratorPrompt(project, chat),
        addDirs: this.opts.extraDirs,
        mcpConfig: this.mcp.configFor(project, chat, 'orchestrator'),
        allowedTools: [...READ_TOOLS, 'mcp__orchestra'],
        disallowedTools: NOT_ALLOWED
      },
      {
        onLive: (text) => {
          if (!o.handingOver) emit({ kind: 'live', text })
        },
        onAssistant: (text, tools) => {
          if (o.handingOver) return
          void this.logActions(project, chat, 'orchestrator', text, tools)
        },
        onTurnEnd: (text, isError) => {
          if (o.handingOver) {
            void this.finishHandoff(project, chat, o, !isError)
            return
          }
          void this.log(project, chat, 'orchestrator', 'turn', `done in ${secs(o.started)}s`)
          if (isError) emit({ kind: 'error', text: text || 'The Orchestrator hit an error.' })
          else if (text) void this.say(project, chat, { t: now(), role: 'orchestrator', text })
          if (o.s.busy) return // more queued (a report arrived meanwhile)
          if (o.s.context > HANDOFF_AT && !isError) this.handOver(chat, o, emit)
          else emit({ kind: 'busy', busy: false })
        },
        onExit: ({ expected, heard, stderr, spawnError }) => {
          if (this.orchestrators.get(key) === o) this.orchestrators.delete(key)
          if (expected) return
          const why = spawnError ?? stderr.trim().split('\n').pop()
          emit({
            kind: 'error',
            text: `The Orchestrator stopped${why ? `: ${why}` : '.'} Send your message again to restart it.`
          })
          if (heard || spawnError) emit({ kind: 'busy', busy: false })
          else emit({ kind: 'busy', busy: false })
        }
      }
    )
    this.orchestrators.set(key, o)
    return o
  }

  private turn(project: string, chat: string, o: Orchestrator, text: string): void {
    if (!o.s.busy) o.started = Date.now()
    o.s.send(text)
    this.opts.emit({ project, chat, kind: 'busy', busy: true })
  }

  /** Asks the Orchestrator, out of sight, to write its handoff note before the context fills. */
  private handOver(chat: string, o: Orchestrator, emit: (e: EventBody) => void): void {
    o.handingOver = true
    emit({ kind: 'live', text: '' })
    o.s.send(handoffPrompt(chat))
  }

  /** The note is written: end this session; the next message starts a fresh one that reads it. */
  private async finishHandoff(
    project: string,
    chat: string,
    o: Orchestrator,
    saved: boolean
  ): Promise<void> {
    await this.say(project, chat, {
      t: now(),
      role: 'note',
      text: saved
        ? `The conversation was getting long, so the Orchestrator saved its context to ${handoffFile(chat)} and continues in a fresh session.`
        : 'The Orchestrator couldn’t save its context; it continues in the same session.'
    })
    if (saved) {
      o.s.kill()
      this.orchestrators.delete(`${project}/${chat}`)
      await rm(chatFile(this.opts.projectDir(project), chat, 'session.json'), { force: true })
      await this.log(project, chat, 'orchestrator', 'turn', `context saved to ${handoffFile(chat)}`)
    } else o.handingOver = false
    this.opts.emit({ project, chat, kind: 'busy', busy: false })
  }

  // ---- Musicians and Instruments ----

  async roleOf(_project: string, agent: string): Promise<Role | null> {
    if (agent === 'orchestrator') return 'orchestrator'
    const { musicians, instruments } = await this.opts.library()
    const { musician, instrument } = parseAgent(agent)
    if (!musicians.some((m) => m.id === musician)) return null
    if (!instrument) return 'musician'
    return instruments.some((i) => i.id === instrument) ? 'instrument' : null
  }

  async choices(project: string, agent: string): Promise<{ id: string; name: string }[]> {
    const lib = await this.opts.library()
    if (agent === 'orchestrator') {
      const selected = await this.opts.selected(this.opts.projectDir(project))
      return lib.musicians
        .filter((m) => selected.includes(m.id))
        .map((m) => ({ id: m.id, name: m.name }))
    }
    const m = lib.musicians.find((x) => x.id === agent)
    if (!m) return []
    // its own Instruments, plus the foundations its deliverable needs
    const ids = new Set([
      ...foundationOrder(lib.musicians, lib.instruments, [m.id]).map((i) => i.id),
      ...m.instruments
    ])
    return lib.instruments.filter((i) => ids.has(i.id)).map((i) => ({ id: i.id, name: i.name }))
  }

  async briefMusician(
    project: string,
    chat: string,
    musician: string,
    brief: string
  ): Promise<string> {
    const allowed = await this.choices(project, 'orchestrator')
    const m = allowed.find((x) => x.id === musician)
    if (!m)
      throw new Error(
        `${musician} isn't one of this project's chosen deliverables. You can brief: ${allowed.map((x) => x.id).join(', ') || 'none yet'}. To add one, suggest it to the user.`
      )
    await this.log(project, chat, 'orchestrator', 'message', `→ ${m.name}: ${oneLine(brief)}`)
    await this.deliver(
      project,
      chat,
      musician,
      'musician',
      `[Brief from the Orchestrator]\n${brief}`
    )
    return `Briefed the ${m.name} Musician. It reports back to you when it has news; that arrives as a message here.`
  }

  async runInstrument(
    project: string,
    chat: string,
    musician: string,
    instrument: string,
    brief: string
  ): Promise<string> {
    const allowed = await this.choices(project, musician)
    const i = allowed.find((x) => x.id === instrument)
    if (!i)
      throw new Error(
        `${instrument} isn't one of your Instruments. You can run: ${allowed.map((x) => x.id).join(', ')}.`
      )
    await this.log(project, chat, musician, 'message', `→ ${i.name}: ${oneLine(brief)}`)
    await this.deliver(
      project,
      chat,
      `${musician}--${instrument}`,
      'instrument',
      `[Brief from your Musician]\n${brief}`
    )
    return `Started the ${i.name} Instrument. Its report comes back to you as a message when it finishes.`
  }

  async report(
    project: string,
    chat: string,
    musician: string,
    text: string,
    done: boolean
  ): Promise<string> {
    const { musicians } = await this.opts.library()
    const name = musicians.find((m) => m.id === musician)?.name ?? musician
    await this.setState(project, musician, chat, done ? 'done' : 'waiting')
    await this.log(project, chat, musician, 'message', `→ Orchestrator: ${oneLine(text)}`)
    this.count(project)
    await this.say(project, chat, {
      t: now(),
      role: 'note',
      text: done
        ? `The ${name} Musician finished and reported back.`
        : `The ${name} Musician reported back.`
    })
    const o = await this.orchestrator(project, chat)
    this.turn(
      project,
      chat,
      o,
      `[Report from the ${name} Musician${done ? ', finished' : ''}]\n${text}`
    )
    return 'Reported to the Orchestrator.'
  }

  // ---- new agents, approved by the user ----

  /** The Orchestrator proposes a Musician for a deliverable the library doesn't cover. */
  async proposeMusician(project: string, chat: string, draft: MusicianDraft): Promise<string> {
    await this.propose(project, chat, 'orchestrator', 'musician', draft)
    return `The user now sees an approval card for the ${draft.name} Musician. In this same reply, say in a sentence or two why it's needed, then stop and wait: you'll get a message when they decide.`
  }

  /** A Musician proposes an Instrument for its own crew. The card goes to the user in the chat
   * the Musician was briefed from, and the Orchestrator is told so it can explain it. */
  async proposeInstrument(
    project: string,
    chat: string,
    musician: string,
    draft: InstrumentDraft
  ): Promise<string> {
    const { musicians } = await this.opts.library()
    const name = musicians.find((m) => m.id === musician)?.name ?? musician
    await this.propose(project, chat, musician, 'instrument', draft)
    this.count(project)
    const o = await this.orchestrator(project, chat)
    this.turn(
      project,
      chat,
      o,
      `[Proposal from the ${name} Musician]\nIt wants a new Instrument, ${draft.name}: ${draft.job}\nThe user sees an approval card for it. Tell them in a sentence or two why the Musician needs it, then wait for their decision.`
    )
    return 'Sent to the user for approval, through the Orchestrator. Wait: you get a message when they decide. Carry on with anything that doesn’t need it.'
  }

  private async propose(
    project: string,
    chat: string,
    from: string,
    kind: Proposal['kind'],
    draft: MusicianDraft | InstrumentDraft
  ): Promise<void> {
    const dir = this.opts.projectDir(project)
    const problems = draftProblems(kind, draft, await this.opts.library())
    const id = `${kind}:${draft.id}`
    if ((await readProposals(dir))[id]?.status === 'pending')
      problems.push(`${draft.id} is already waiting for the user's approval.`)
    if (problems.length)
      throw new Error(`Fix the draft and propose again:\n- ${problems.join('\n- ')}`)
    await saveProposal(dir, { id, kind, from, chat, status: 'pending', t: now(), draft })
    await this.log(project, chat, from, 'message', `proposed a new ${kind}: ${draft.name}`)
    await this.say(project, chat, {
      t: now(),
      role: 'proposal',
      ref: id,
      text: `New ${kind}: ${draft.name}`
    })
  }

  /** The user approves or declines a proposal card. Approval writes it to the library (and a
   * new Musician joins the project's deliverables); either way its proposer hears back. */
  async decide(project: string, chat: string, id: string, approve: boolean): Promise<void> {
    const dir = this.opts.projectDir(project)
    const p = (await readProposals(dir))[id]
    if (!p) throw new Error('That proposal no longer exists.')
    if (p.status !== 'pending') throw new Error(`Already ${p.status}.`)
    const kind = p.kind === 'musician' ? 'Musician' : 'Instrument'
    if (approve) {
      // the library may have changed since it was proposed
      const problems = draftProblems(p.kind, p.draft, await this.opts.library())
      if (problems.length) throw new Error(`Can't add it: ${problems.join(' ')}`)
      await this.opts.adopt(p)
      if (p.kind === 'musician') await this.opts.addDeliverable(dir, p.draft.id)
    }
    await saveProposal(dir, { ...p, status: approve ? 'approved' : 'declined' })
    const verdict = approve ? 'approved' : 'declined'
    await this.say(project, chat, {
      t: now(),
      role: 'note',
      text: approve
        ? `You approved the ${p.draft.name} ${kind}. It's in the library${p.kind === 'musician' ? ' and your deliverables, with its own chat' : ''}.`
        : `You declined the ${p.draft.name} ${kind}.`
    })
    await this.log(
      project,
      chat,
      'orchestrator',
      'turn',
      `${p.draft.name} ${kind} ${verdict} by you`
    )
    if (p.kind === 'musician') {
      const o = await this.orchestrator(project, chat)
      this.turn(
        project,
        chat,
        o,
        approve
          ? `[The user approved the ${p.draft.name} Musician (${p.draft.id}). It's saved to the library and added to this project's deliverables, so you can brief it now.]`
          : `[The user declined the ${p.draft.name} Musician. Ask what they'd like instead if it isn't clear.]`
      )
      return
    }
    try {
      await this.deliver(
        project,
        chat,
        p.from,
        'musician',
        approve
          ? `[The user approved your new Instrument, ${p.draft.name} (${p.draft.id}). It's in the library and in your crew: run it with run_instrument.]`
          : `[The user declined your proposed Instrument, ${p.draft.name}. Do the job with your existing Instruments, or report to the Orchestrator what you can't do without it.]`
      )
    } catch (e) {
      // the decision stands; the Musician hears it when it's next briefed
      await this.log(
        project,
        chat,
        p.from,
        'turn',
        `couldn't receive the decision: ${(e as Error).message}`
      )
    }
  }

  async proposals(project: string): Promise<Record<string, Proposal>> {
    return readProposals(this.opts.projectDir(project))
  }

  /** Sends a brief or report to a Musician or Instrument, starting its session if needed. */
  private async deliver(
    project: string,
    chat: string,
    key: string,
    role: 'musician' | 'instrument',
    text: string
  ): Promise<void> {
    const states = await this.statesOf(project)
    const working = Object.entries(states).filter(
      ([k, s]) => k !== key && s.status === 'working'
    ).length
    if (working >= MAX_WORKING)
      throw new Error(
        `${working} agents are already working in this project. Wait for one to report before starting another.`
      )
    this.count(project)
    const a =
      this.agents.get(`${project}/${key}`) ?? (await this.startAgent(project, chat, key, role))
    a.chat = chat
    await this.setState(project, key, chat, 'working')
    a.s.send(text)
  }

  /** Counts a message between agents, refusing past the hourly cap so agents can't loop. */
  private count(project: string): void {
    const hourAgo = Date.now() - 3_600_000
    const recent = (this.sent.get(project) ?? []).filter((t) => t > hourAgo)
    if (recent.length >= MESSAGES_PER_HOUR)
      throw new Error(
        `Agents have sent ${MESSAGES_PER_HOUR} messages to each other in the last hour, Orchestra's limit. Stop and check in with the user before going on.`
      )
    this.sent.set(project, [...recent, Date.now()])
  }

  private async startAgent(
    project: string,
    chat: string,
    key: string,
    role: 'musician' | 'instrument'
  ): Promise<RunningAgent> {
    const dir = this.opts.projectDir(project)
    const lib = await this.opts.library()
    const { musician, instrument } = parseAgent(key)
    const doc = instrument
      ? lib.instruments.find((i) => i.id === instrument)
      : lib.musicians.find((m) => m.id === musician)
    if (!doc) throw new Error(`No agent called ${key} in the library.`)
    const a: RunningAgent = { s: undefined as unknown as ClaudeSession, role, chat }
    a.s = await ClaudeSession.start(
      {
        cwd: dir,
        sessionFile: join(orchestra(dir), 'agents', key, 'session.json'),
        model: doc.model,
        systemPrompt: await this.opts.agentPrompt(project, key),
        addDirs: this.opts.extraDirs,
        // Instruments get no Orchestra tools: their closing message is their report
        mcpConfig: role === 'musician' ? this.mcp.configFor(project, chat, key) : undefined,
        allowedTools: role === 'musician' ? [...READ_TOOLS, 'mcp__orchestra'] : READ_TOOLS,
        disallowedTools: NOT_ALLOWED
      },
      {
        onAssistant: (text, tools) => void this.logActions(project, a.chat, key, text, tools),
        onTurnEnd: (text, isError) => void this.agentTurnEnd(project, key, a, text, isError),
        onExit: ({ expected, stderr, spawnError }) => {
          if (this.agents.get(`${project}/${key}`) === a) this.agents.delete(`${project}/${key}`)
          if (expected) return
          const why = spawnError ?? stderr.trim().split('\n').pop() ?? ''
          void this.log(
            project,
            a.chat,
            key,
            'turn',
            `stopped unexpectedly${why ? `: ${why}` : ''}`
          )
          void this.setState(project, key, a.chat, 'error')
        }
      }
    )
    this.agents.set(`${project}/${key}`, a)
    return a
  }

  private async agentTurnEnd(
    project: string,
    key: string,
    a: RunningAgent,
    text: string,
    isError: boolean
  ): Promise<void> {
    if (a.s.busy) return // more messages queued for it; it keeps working
    const { musician, instrument } = parseAgent(key)
    if (isError) {
      await this.log(project, a.chat, key, 'turn', `hit an error: ${oneLine(text)}`)
      await this.setState(project, key, a.chat, 'error')
      return
    }
    if (!instrument) {
      // a Musician between steps: done only once it has reported done
      const state = (await this.statesOf(project))[key]
      if (state?.status === 'working') await this.setState(project, key, a.chat, 'waiting')
      return
    }
    // an Instrument's closing message is its report to its Musician; its job is done
    await this.setState(project, key, a.chat, 'done')
    const lib = await this.opts.library()
    const name = lib.instruments.find((i) => i.id === instrument)?.name ?? instrument
    const musicianName = lib.musicians.find((m) => m.id === musician)?.name ?? musician
    await this.log(project, a.chat, key, 'message', `→ ${musicianName}: ${oneLine(text)}`)
    a.s.kill() // its session is saved; a new brief resumes it
    this.agents.delete(`${project}/${key}`)
    try {
      await this.deliver(
        project,
        a.chat,
        musician,
        'musician',
        `[Report from the ${name} Instrument]\n${text || '(it ended without a report)'}`
      )
    } catch (e) {
      await this.log(
        project,
        a.chat,
        musician,
        'turn',
        `couldn't receive the report: ${(e as Error).message}`
      )
    }
  }

  // ---- statuses, chat and log ----

  private async statesOf(project: string): Promise<Record<string, AgentState>> {
    let s = this.states.get(project)
    if (!s) {
      const file = join(orchestra(this.opts.projectDir(project)), 'agents.json')
      const saved = await readFile(file, 'utf8')
        .then((t) => JSON.parse(t) as Record<string, AgentState>)
        .catch(() => ({}) as Record<string, AgentState>)
      // anything "working" when the app last closed isn't any more
      for (const k of Object.keys(saved))
        if (saved[k].status === 'working') saved[k] = { ...saved[k], status: 'stopped' }
      s = saved
      this.states.set(project, s)
    }
    return s
  }

  private async setState(
    project: string,
    key: string,
    chat: string,
    status: AgentStatus
  ): Promise<void> {
    const states = await this.statesOf(project)
    states[key] = { status, chat, updated: now() }
    await this.saveStates(project, chat)
  }

  private async saveStates(project: string, chat: string): Promise<void> {
    const dir = orchestra(this.opts.projectDir(project))
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, 'agents.json'),
      JSON.stringify(this.states.get(project) ?? {}, null, 2)
    )
    this.opts.emit({ project, chat, kind: 'agents' })
  }

  private async say(project: string, chat: string, m: ChatMessage): Promise<void> {
    await append(this.opts.projectDir(project), chat, 'chat.jsonl', m)
    this.opts.emit({ project, chat, kind: 'message', message: m })
  }

  private async log(
    project: string,
    chat: string,
    agent: string,
    kind: LogEntry['kind'],
    text: string
  ): Promise<void> {
    const entry: LogEntry = { t: now(), agent, kind, text }
    await append(this.opts.projectDir(project), chat, 'log.jsonl', entry)
    this.opts.emit({ project, chat, kind: 'log', entry })
  }

  /** Logs an assistant message's tool calls and words. Orchestra's own tools log themselves. */
  private async logActions(
    project: string,
    chat: string,
    agent: string,
    text: string,
    tools: ToolUse[]
  ): Promise<void> {
    for (const t of tools)
      if (!t.name.startsWith('mcp__orchestra__') && t.name !== 'ToolSearch')
        await this.log(project, chat, agent, 'tool', describeTool(t.name, t.input))
    if (text) await this.log(project, chat, agent, 'say', oneLine(text))
  }
}

const now = (): string => new Date().toISOString()
const secs = (from: number): number => Math.max(1, Math.round((Date.now() - from) / 1000))
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim()
