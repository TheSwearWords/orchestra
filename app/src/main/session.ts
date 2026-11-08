import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'

// One headless Claude Code session spoken to in stream-json (Pitcrew's runner pattern), used for
// the Orchestrator and for every Musician and Instrument. Each keeps its Claude session id in a
// file, so it resumes after a restart. Messages sent while it's working queue up; Claude Code
// answers them in order, one turn each.

export interface SessionOptions {
  cwd: string
  sessionFile: string // where this session's Claude id is kept
  model: string
  systemPrompt: string
  addDirs: string[] // folders outside cwd it may read (the agent library)
  mcpConfig?: string // Orchestra's tools for this agent
  allowedTools: string[]
  disallowedTools: string[]
}

export interface ToolUse {
  name: string
  input: Record<string, unknown>
}

/** Claude's plan limits, per window (five_hour, seven_day): 0–1 used, reset in epoch seconds. */
export type Usage = Record<string, { utilization: number; resetsAt: number }>

export interface SessionHandlers {
  /** The reply so far in the current turn, while it streams. */
  onLive?: (text: string) => void
  /** One finished assistant message: its text and the tools it called. */
  onAssistant?: (text: string, tools: ToolUse[]) => void
  /** Claude reported where the plan's limits stand. */
  onUsage?: (usage: Usage) => void
  /** A turn finished: everything it said, and whether Claude reported an error. */
  onTurnEnd: (text: string, isError: boolean) => void
  /** The process ended. `expected` when the app ended it (stop, quit, hand-over). */
  onExit: (info: { expected: boolean; heard: boolean; stderr: string; spawnError?: string }) => void
}

async function sessionId(file: string): Promise<{ id: string; resume: boolean }> {
  const saved = await readFile(file, 'utf8')
    .then((t) => (JSON.parse(t) as { id?: string }).id)
    .catch(() => undefined)
  if (saved) return { id: saved, resume: true }
  const id = randomUUID()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify({ id }))
  return { id, resume: false }
}

export class ClaudeSession {
  pending = 0 // turns sent and not yet answered
  context = 0 // tokens in the latest request: how full the conversation is
  private proc!: ChildProcessWithoutNullStreams
  private ending = false

  static async start(opts: SessionOptions, on: SessionHandlers): Promise<ClaudeSession> {
    const s = new ClaudeSession()
    const { id, resume } = await sessionId(opts.sessionFile)
    const args = [
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      // file edits inside cwd are pre-approved; nothing else is, since a headless session can't
      // answer a permission prompt
      '--permission-mode',
      'acceptEdits',
      '--model',
      opts.model,
      resume ? '--resume' : '--session-id',
      id,
      '--append-system-prompt',
      opts.systemPrompt,
      ...opts.addDirs.flatMap((d) => ['--add-dir', d]),
      ...(opts.mcpConfig ? ['--mcp-config', opts.mcpConfig] : []),
      // the "=" form stops these variadic flags eating the arguments after them
      `--allowedTools=${opts.allowedTools.join(',')}`,
      `--disallowedTools=${opts.disallowedTools.join(',')}`
    ]
    const proc = spawn('claude', args, { cwd: opts.cwd })
    s.proc = proc
    let heard = false
    let done: string[] = [] // finished assistant texts this turn (a turn can span tool calls)
    let partial = ''
    const live = (): string => [...done, partial].filter(Boolean).join('\n\n')

    let buf = ''
    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => {
      heard = true
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
          partial += ev.event.delta.text ?? ''
          on.onLive?.(live())
        } else if (ev.type === 'assistant') {
          const u = ev.message?.usage
          if (u)
            s.context =
              (u.input_tokens ?? 0) +
              (u.cache_read_input_tokens ?? 0) +
              (u.cache_creation_input_tokens ?? 0)
          const content = ev.message?.content ?? []
          const text = content
            .filter((c) => c.type === 'text')
            .map((c) => c.text ?? '')
            .join('')
            .trim()
          if (text) done.push(text)
          partial = ''
          const tools = content
            .filter((c) => c.type === 'tool_use')
            .map((c) => ({ name: c.name ?? '', input: c.input ?? {} }))
          on.onAssistant?.(text, tools)
        } else if (ev.type === 'rate_limit_event') {
          const usage = ev.rate_limit_info?.unifiedWindows
          if (usage) on.onUsage?.(usage)
        } else if (ev.type === 'result') {
          const text = live() || (typeof ev.result === 'string' ? ev.result.trim() : '')
          done = []
          partial = ''
          s.pending = Math.max(0, s.pending - 1)
          on.onTurnEnd(text, !!ev.is_error)
        }
      }
    })
    let stderr = ''
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (t: string) => (stderr += t))
    let spawnError: string | undefined
    proc.on('error', (e: NodeJS.ErrnoException) => {
      spawnError = e.code === 'ENOENT' ? 'Claude Code isn’t installed or isn’t on PATH.' : e.message
    })
    proc.on('exit', () => {
      // A resume that dies before saying anything means Claude no longer has that session
      // (another machine, cleared history): start a fresh one next time.
      if (resume && !heard && !s.ending) void rm(opts.sessionFile, { force: true })
      s.pending = 0
      on.onExit({ expected: s.ending, heard, stderr, spawnError })
    })
    return s
  }

  get busy(): boolean {
    return this.pending > 0
  }

  send(text: string): void {
    this.pending++
    this.proc.stdin.write(
      JSON.stringify({ type: 'user', message: { role: 'user', content: text } }) + '\n'
    )
  }

  /** Ends the process (and on Windows its whole tree, so tool subprocesses die too). */
  kill(): void {
    this.ending = true
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(this.proc.pid), '/T', '/F'])
    else this.proc.kill()
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
  rate_limit_info?: { unifiedWindows?: Usage }
  result?: unknown
  is_error?: boolean
}
