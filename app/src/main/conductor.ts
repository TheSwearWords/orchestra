import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { appendFile, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'

// The Orchestrator's side of Create: one long-lived headless Claude Code session per project,
// spoken to in stream-json (the same pattern as Pitcrew's runner). The conversation is kept in
// the project's .orchestra folder (hidden in Obsidian), one JSON line per message.

export interface ChatMessage {
  t: string // ISO time
  role: 'user' | 'orchestrator' | 'note' // a note is the app's own line, e.g. a context hand-over
  text: string
}

// Before the Orchestrator's context fills up, it writes everything a fresh session needs to this
// file (visible in Obsidian), and the next session starts from it. Claude's context is ~200k
// tokens; hand over well before Claude Code would compact on its own.
export const HANDOFF_FILE = 'notes/orchestrator.md'
const HANDOFF_AT = Number(process.env.ORCHESTRA_HANDOFF_TOKENS) || 140_000
const HANDOFF_PROMPT = `This conversation is getting long, so you'll continue in a fresh session. Write a handoff note to ${HANDOFF_FILE} (replace the file) so that session can pick up exactly where you are: the user's goals and every decision so far, what has been made (with file paths), what is planned next and in what order, open questions, and anything the user asked you to remember. Write it for yourself, plainly. Then reply only: Saved.`

export type ChatEvent = { project: string } & (
  | { kind: 'live'; text: string } // the reply so far, while it streams
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'busy'; busy: boolean }
  | { kind: 'error'; text: string }
)

const stateDir = (project: string): string => join(project, '.orchestra')
const chatFile = (project: string): string => join(stateDir(project), 'chat.jsonl')
const sessionFile = (project: string): string => join(stateDir(project), 'session.json')

export async function readChat(project: string): Promise<ChatMessage[]> {
  const text = await readFile(chatFile(project), 'utf8').catch(() => '')
  return text
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        const m = JSON.parse(l) as ChatMessage
        return m && ['user', 'orchestrator', 'note'].includes(m.role) ? [m] : []
      } catch {
        return [] // a half-written line from a crash; skip it rather than lose the rest
      }
    })
}

async function appendChat(project: string, m: ChatMessage): Promise<void> {
  await mkdir(stateDir(project), { recursive: true })
  await appendFile(chatFile(project), JSON.stringify(m) + '\n')
}

/** The Claude session this project's Orchestrator continues, created on first use. */
async function session(project: string): Promise<{ id: string; resume: boolean }> {
  const saved = await readFile(sessionFile(project), 'utf8')
    .then((t) => (JSON.parse(t) as { id?: string }).id)
    .catch(() => undefined)
  if (saved) return { id: saved, resume: true }
  const id = randomUUID()
  await mkdir(stateDir(project), { recursive: true })
  await writeFile(sessionFile(project), JSON.stringify({ id }))
  return { id, resume: false }
}

interface Running {
  proc: ChildProcessWithoutNullStreams
  busy: boolean
  done: string[] // finished assistant texts in this turn (a turn can span tool calls)
  partial: string // the assistant message streaming now
  heard: boolean // any output yet: a resume that fails says nothing first
  stopping: boolean
  context: number // tokens in the latest request: how full the conversation is
  handingOver: boolean // the current turn is the hidden handoff, not shown in the chat
}

export interface ConductorOptions {
  emit: (e: ChatEvent) => void
  /** The Orchestrator's instructions for this project: library prompt, house rules, context. */
  systemPrompt: (projectId: string) => Promise<string>
  /** Folders outside the project the Orchestrator may read (the agent library). */
  extraDirs: string[]
}

export class Conductor {
  private running = new Map<string, Running>()
  private opts: ConductorOptions

  constructor(opts: ConductorOptions) {
    this.opts = opts
  }

  isBusy(projectId: string): boolean {
    return this.running.get(projectId)?.busy ?? false
  }

  async send(projectId: string, projectDir: string, text: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    let r = this.running.get(projectId)
    if (r?.busy) throw new Error('The Orchestrator is still answering.')
    if (!r) r = await this.start(projectId, projectDir)
    const m: ChatMessage = { t: new Date().toISOString(), role: 'user', text: clean }
    await appendChat(projectDir, m)
    this.opts.emit({ project: projectId, kind: 'message', message: m })
    r.busy = true
    r.done = []
    r.partial = ''
    this.opts.emit({ project: projectId, kind: 'busy', busy: true })
    r.proc.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: clean } }) + '\n'
    )
  }

  private async start(projectId: string, projectDir: string): Promise<Running> {
    const { id, resume } = await session(projectDir)
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
      resume ? '--resume' : '--session-id',
      id,
      '--append-system-prompt',
      await this.opts.systemPrompt(projectId),
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
      handingOver: false
    }
    this.running.set(projectId, r)
    const emit = this.opts.emit
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
          if (!r.handingOver) emit({ project: projectId, kind: 'live', text: live() })
        } else if (ev.type === 'assistant') {
          const u = ev.message?.usage
          if (u)
            r.context =
              (u.input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0)
          const text = (ev.message?.content ?? [])
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('')
            .trim()
          if (text) r.done.push(text)
          r.partial = ''
        } else if (ev.type === 'result') {
          const text = live() || (typeof ev.result === 'string' ? ev.result.trim() : '')
          r.done = []
          r.partial = ''
          if (r.handingOver) {
            void this.finishHandoff(projectId, projectDir, r, !ev.is_error)
            continue
          }
          r.busy = false
          if (ev.is_error)
            emit({
              project: projectId,
              kind: 'error',
              text: text || 'The Orchestrator hit an error.'
            })
          else if (text) {
            const m: ChatMessage = { t: new Date().toISOString(), role: 'orchestrator', text }
            void appendChat(projectDir, m).then(() =>
              emit({ project: projectId, kind: 'message', message: m })
            )
          }
          if (r.context > HANDOFF_AT && !ev.is_error) this.handOver(projectId, r)
          else emit({ project: projectId, kind: 'busy', busy: false })
        }
      }
    })
    let stderr = ''
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (t: string) => (stderr += t))
    proc.on('error', (e: NodeJS.ErrnoException) => {
      emit({
        project: projectId,
        kind: 'error',
        text: e.code === 'ENOENT' ? 'Claude Code isn’t installed or isn’t on PATH.' : e.message
      })
    })
    proc.on('exit', () => {
      this.running.delete(projectId)
      if (r.stopping) return
      // A resume that dies before saying anything means Claude no longer has that session
      // (another machine, cleared history): start a fresh one next time.
      if (resume && !r.heard) void rm(sessionFile(projectDir), { force: true })
      if (r.busy || !r.heard) {
        const why = stderr.trim().split('\n').pop()
        emit({
          project: projectId,
          kind: 'error',
          text: `The Orchestrator stopped${why ? `: ${why}` : '.'} Send your message again to restart it.`
        })
        emit({ project: projectId, kind: 'busy', busy: false })
      }
    })
    return r
  }

  /** Asks the Orchestrator, out of sight, to write its handoff note before the context fills. */
  private handOver(projectId: string, r: Running): void {
    r.handingOver = true
    r.busy = true // the user waits a moment; the chat says why
    this.opts.emit({ project: projectId, kind: 'live', text: '' })
    r.proc.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: HANDOFF_PROMPT } }) + '\n'
    )
  }

  /** The note is written: end this session; the next message starts a fresh one that reads it. */
  private async finishHandoff(
    projectId: string,
    projectDir: string,
    r: Running,
    saved: boolean
  ): Promise<void> {
    const note: ChatMessage = {
      t: new Date().toISOString(),
      role: 'note',
      text: saved
        ? `The conversation was getting long, so the Orchestrator saved its context to ${HANDOFF_FILE} and continues in a fresh session.`
        : 'The Orchestrator couldn’t save its context; it continues in the same session.'
    }
    await appendChat(projectDir, note)
    this.opts.emit({ project: projectId, kind: 'message', message: note })
    if (saved) {
      r.stopping = true
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(r.proc.pid), '/T', '/F'])
      else r.proc.kill()
      this.running.delete(projectId)
      await rm(sessionFile(projectDir), { force: true })
    } else r.handingOver = false
    r.busy = false
    this.opts.emit({ project: projectId, kind: 'busy', busy: false })
  }

  stopAll(): void {
    for (const r of this.running.values()) {
      r.stopping = true
      // taskkill the whole tree on Windows so tool subprocesses die too
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(r.proc.pid), '/T', '/F'])
      else r.proc.kill()
    }
    this.running.clear()
  }
}

// The parts of Claude Code's stream-json output this file reads.
interface StreamLine {
  type?: string
  event?: { delta?: { type?: string; text?: string } }
  message?: {
    content?: { type: string; text?: string }[]
    usage?: {
      input_tokens?: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  result?: unknown
  is_error?: boolean
}
