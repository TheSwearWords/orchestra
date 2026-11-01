import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'

// The Orchestrator's side of Create. A project has several chats: "general" for the whole project
// and one per chosen deliverable (its id). Each chat is one long-lived headless Claude Code
// session spoken to in stream-json (Pitcrew's pattern), with its own history, its own agent
// activity log and its own handoff note. All of it lives in the project's .orchestra folder
// (hidden in Obsidian), except the handoff notes, which go in notes/ so they can be read.

export interface ChatMessage {
  t: string // ISO time
  role: 'user' | 'orchestrator' | 'note' // a note is the app's own line, e.g. a hand-over or a stop
  text: string
}

/** One line of the agent channel: what an agent did or said, for oversight. */
export interface LogEntry {
  t: string
  agent: string // 'orchestrator' now; Musician and Instrument ids once they run
  kind: 'tool' | 'say' | 'turn'
  text: string
}

type EventBody =
  | { kind: 'live'; text: string } // the reply so far, while it streams
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'busy'; busy: boolean }
  | { kind: 'log'; entry: LogEntry }
  | { kind: 'error'; text: string }
export type ChatEvent = { project: string; chat: string } & EventBody

export const GENERAL = 'general'
const CHAT_ID = /^[a-z0-9][a-z0-9-]*$/

/** Where a chat's Orchestrator writes its handoff note before its context fills up. */
export const handoffFile = (chat: string): string =>
  chat === GENERAL ? 'notes/orchestrator.md' : `notes/orchestrator-${chat}.md`
// Claude's context is ~200k tokens; hand over well before Claude Code would compact on its own.
const HANDOFF_AT = Number(process.env.ORCHESTRA_HANDOFF_TOKENS) || 140_000
const handoffPrompt = (chat: string): string =>
  `This conversation is getting long, so you'll continue in a fresh session. Write a handoff note to ${handoffFile(chat)} (replace the file) so that session can pick up exactly where you are: the user's goals and every decision so far, what has been made (with file paths), what is planned next and in what order, open questions, and anything the user asked you to remember. Write it for yourself, plainly. Then reply only: Saved.`

const chatDir = (project: string, chat: string): string => {
  if (!CHAT_ID.test(chat)) throw new Error('Unknown chat.')
  return join(project, '.orchestra', 'chats', chat)
}
const file = (project: string, chat: string, name: string): string =>
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
  const old = join(project, '.orchestra', 'chat.jsonl')
  if (!(await stat(old).catch(() => null))) return
  const dir = chatDir(project, GENERAL)
  if (await stat(join(dir, 'chat.jsonl')).catch(() => null)) return
  await mkdir(dir, { recursive: true })
  await rename(old, join(dir, 'chat.jsonl'))
  await rename(join(project, '.orchestra', 'session.json'), join(dir, 'session.json')).catch(
    () => {}
  )
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
  return readLines<ChatMessage>(file(project, chat, 'chat.jsonl'), (m) =>
    ['user', 'orchestrator', 'note'].includes(m.role)
  )
}

export async function readLog(project: string, chat: string): Promise<LogEntry[]> {
  return readLines<LogEntry>(file(project, chat, 'log.jsonl'), (e) => typeof e.text === 'string')
}

async function append(project: string, chat: string, name: string, x: unknown): Promise<void> {
  await mkdir(chatDir(project, chat), { recursive: true })
  await appendFile(file(project, chat, name), JSON.stringify(x) + '\n')
}

/** The Claude session a chat's Orchestrator continues, created on first use. */
async function session(project: string, chat: string): Promise<{ id: string; resume: boolean }> {
  const path = file(project, chat, 'session.json')
  const saved = await readFile(path, 'utf8')
    .then((t) => (JSON.parse(t) as { id?: string }).id)
    .catch(() => undefined)
  if (saved) return { id: saved, resume: true }
  const id = randomUUID()
  await mkdir(chatDir(project, chat), { recursive: true })
  await writeFile(path, JSON.stringify({ id }))
  return { id, resume: false }
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

interface Running {
  proc: ChildProcessWithoutNullStreams
  busy: boolean
  done: string[] // finished assistant texts in this turn (a turn can span tool calls)
  partial: string // the assistant message streaming now
  heard: boolean // any output yet: a resume that fails says nothing first
  stopping: boolean // ended by the app (stop, hand-over, quit), not by a crash
  context: number // tokens in the latest request: how full the conversation is
  handingOver: boolean // the current turn is the hidden handoff, not shown in the chat
  started: number // when the current turn began
}

export interface ConductorOptions {
  emit: (e: ChatEvent) => void
  /** The Orchestrator's instructions for one chat: library prompt, house rules, context. */
  systemPrompt: (projectId: string, chat: string) => Promise<string>
  /** The Orchestrator's model (its library file's `model:`, opus by default). */
  model: () => Promise<string>
  /** Folders outside the project the Orchestrator may read (the agent library). */
  extraDirs: string[]
}

export class Conductor {
  private running = new Map<string, Running>()
  private opts: ConductorOptions

  constructor(opts: ConductorOptions) {
    this.opts = opts
  }

  isBusy(projectId: string, chat: string): boolean {
    return this.running.get(`${projectId}/${chat}`)?.busy ?? false
  }

  async send(projectId: string, chat: string, projectDir: string, text: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    const key = `${projectId}/${chat}`
    let r = this.running.get(key)
    if (r?.busy) throw new Error('The Orchestrator is still answering.')
    if (!r) r = await this.start(projectId, chat, projectDir)
    const m: ChatMessage = { t: new Date().toISOString(), role: 'user', text: clean }
    await append(projectDir, chat, 'chat.jsonl', m)
    this.opts.emit({ project: projectId, chat, kind: 'message', message: m })
    r.busy = true
    r.done = []
    r.partial = ''
    r.started = Date.now()
    this.opts.emit({ project: projectId, chat, kind: 'busy', busy: true })
    await this.log(projectId, chat, projectDir, 'turn', 'new message from you')
    r.proc.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: clean } }) + '\n'
    )
  }

  /** Stops whatever the chat's agents are doing now. The conversation itself is kept: the next
   * message resumes the same session. */
  async stop(projectId: string, chat: string, projectDir: string): Promise<void> {
    const key = `${projectId}/${chat}`
    const r = this.running.get(key)
    if (!r) return
    const wasBusy = r.busy
    this.kill(r)
    this.running.delete(key)
    if (!wasBusy) return
    const note: ChatMessage = { t: new Date().toISOString(), role: 'note', text: 'Stopped by you.' }
    await append(projectDir, chat, 'chat.jsonl', note)
    this.opts.emit({ project: projectId, chat, kind: 'message', message: note })
    await this.log(projectId, chat, projectDir, 'turn', 'stopped by you')
    this.opts.emit({ project: projectId, chat, kind: 'busy', busy: false })
  }

  private async log(
    projectId: string,
    chat: string,
    projectDir: string,
    kind: LogEntry['kind'],
    text: string,
    agent = 'orchestrator'
  ): Promise<void> {
    const entry: LogEntry = { t: new Date().toISOString(), agent, kind, text }
    await append(projectDir, chat, 'log.jsonl', entry)
    this.opts.emit({ project: projectId, chat, kind: 'log', entry })
  }

  private kill(r: Running): void {
    r.stopping = true
    // taskkill the whole tree on Windows so tool subprocesses die too
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(r.proc.pid), '/T', '/F'])
    else r.proc.kill()
  }

  private async start(projectId: string, chat: string, projectDir: string): Promise<Running> {
    const key = `${projectId}/${chat}`
    const { id, resume } = await session(projectDir, chat)
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      // file edits inside the project are pre-approved; nothing else is, since a headless
      // session can't answer a permission prompt
      '--permission-mode',
      'acceptEdits',
      '--model',
      await this.opts.model(),
      resume ? '--resume' : '--session-id',
      id,
      '--append-system-prompt',
      await this.opts.systemPrompt(projectId, chat),
      ...this.opts.extraDirs.flatMap((d) => ['--add-dir', d]),
      '--allowedTools=Read,Glob,Grep,WebFetch,WebSearch',
      // the Orchestrator leads through Orchestra's own hierarchy, never Claude subagents
      '--disallowedTools=Task,Agent,Bash'
    ]
    const proc = spawn('claude', args, { cwd: projectDir })
    const r: Running = {
      proc,
      busy: false,
      done: [],
      partial: '',
      heard: false,
      stopping: false,
      context: 0,
      handingOver: false,
      started: Date.now()
    }
    this.running.set(key, r)
    const emit = (e: EventBody): void => this.opts.emit({ project: projectId, chat, ...e })
    const live = (): string => [...r.done, r.partial].filter(Boolean).join('\n\n')

    let buf = ''
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      r.heard = true
      buf += chunk
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let ev: StreamLine
        try {
          ev = JSON.parse(line)
        } catch {
          continue
        }
        if (ev.type === 'stream_event' && ev.event?.delta?.type === 'text_delta') {
          r.partial += ev.event.delta.text ?? ''
          if (!r.handingOver) emit({ kind: 'live', text: live() })
        } else if (ev.type === 'assistant') {
          const u = ev.message?.usage
          if (u)
            r.context =
              (u.input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0)
          const content = ev.message?.content ?? []
          const text = content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('')
            .trim()
          if (text) r.done.push(text)
          r.partial = ''
          for (const c of content)
            if (c.type === 'tool_use')
              void this.log(
                projectId,
                chat,
                projectDir,
                'tool',
                describeTool(c.name ?? '', c.input)
              )
          if (text && !r.handingOver)
            void this.log(projectId, chat, projectDir, 'say', text.replace(/\s+/g, ' '))
        } else if (ev.type === 'result') {
          const text = live() || (typeof ev.result === 'string' ? ev.result.trim() : '')
          r.done = []
          r.partial = ''
          if (r.handingOver) {
            void this.finishHandoff(projectId, chat, projectDir, r, !ev.is_error)
            continue
          }
          r.busy = false
          void this.log(
            projectId,
            chat,
            projectDir,
            'turn',
            `done in ${Math.max(1, Math.round((Date.now() - r.started) / 1000))}s`
          )
          if (ev.is_error) emit({ kind: 'error', text: text || 'The Orchestrator hit an error.' })
          else if (text) {
            const m: ChatMessage = { t: new Date().toISOString(), role: 'orchestrator', text }
            void append(projectDir, chat, 'chat.jsonl', m).then(() =>
              emit({ kind: 'message', message: m })
            )
          }
          if (r.context > HANDOFF_AT && !ev.is_error) this.handOver(chat, r, emit)
          else emit({ kind: 'busy', busy: false })
        }
      }
    })
    let stderr = ''
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (t: string) => (stderr += t))
    proc.on('error', (e: NodeJS.ErrnoException) => {
      emit({
        kind: 'error',
        text: e.code === 'ENOENT' ? 'Claude Code isn’t installed or isn’t on PATH.' : e.message
      })
    })
    proc.on('exit', () => {
      if (this.running.get(key) === r) this.running.delete(key)
      if (r.stopping) return
      // A resume that dies before saying anything means Claude no longer has that session
      // (another machine, cleared history): start a fresh one next time.
      if (resume && !r.heard) void rm(file(projectDir, chat, 'session.json'), { force: true })
      if (r.busy || !r.heard) {
        const why = stderr.trim().split('\n').pop()
        emit({
          kind: 'error',
          text: `The Orchestrator stopped${why ? `: ${why}` : '.'} Send your message again to restart it.`
        })
        emit({ kind: 'busy', busy: false })
      }
    })
    return r
  }

  /** Asks the Orchestrator, out of sight, to write its handoff note before the context fills. */
  private handOver(chat: string, r: Running, emit: (e: EventBody) => void): void {
    r.handingOver = true
    r.busy = true // the user waits a moment; the chat says why
    emit({ kind: 'live', text: '' })
    r.proc.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: handoffPrompt(chat) } }) +
        '\n'
    )
  }

  /** The note is written: end this session; the next message starts a fresh one that reads it. */
  private async finishHandoff(
    projectId: string,
    chat: string,
    projectDir: string,
    r: Running,
    saved: boolean
  ): Promise<void> {
    const note: ChatMessage = {
      t: new Date().toISOString(),
      role: 'note',
      text: saved
        ? `The conversation was getting long, so the Orchestrator saved its context to ${handoffFile(chat)} and continues in a fresh session.`
        : 'The Orchestrator couldn’t save its context; it continues in the same session.'
    }
    await append(projectDir, chat, 'chat.jsonl', note)
    this.opts.emit({ project: projectId, chat, kind: 'message', message: note })
    if (saved) {
      this.kill(r)
      this.running.delete(`${projectId}/${chat}`)
      await rm(file(projectDir, chat, 'session.json'), { force: true })
      await this.log(projectId, chat, projectDir, 'turn', `context saved to ${handoffFile(chat)}`)
    } else r.handingOver = false
    r.busy = false
    this.opts.emit({ project: projectId, chat, kind: 'busy', busy: false })
  }

  stopAll(): void {
    for (const r of this.running.values()) this.kill(r)
    this.running.clear()
  }
}

// The parts of Claude Code's stream-json output this file reads.
interface StreamLine {
  type?: string
  event?: { delta?: { type?: string; text?: string } }
  message?: {
    content?: { type: string; text?: string; name?: string; input?: Record<string, unknown> }[]
    usage?: {
      input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  result?: unknown
  is_error?: boolean
}
