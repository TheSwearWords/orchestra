// What first-time setup asks of this machine: is each thing really connected, and running the
// steps from recipes.ts.
import { execFile, spawn } from 'child_process'
import { cp, mkdir, readFile, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, isAbsolute, join } from 'path'
import { onPath } from './connections.ts'
import { PROVIDERS, type ProviderId } from './providers.ts'
import { findStep } from './recipes.ts'
import { saveSetup, type Setup } from './setup.ts'
import type { Usage } from './session.ts'

export type McpStatus = 'connected' | 'auth' | 'failed'

export interface MachineCheck {
  claude: { loggedIn: boolean; method: string; plan: string }
  clis: Record<ProviderId, boolean>
  gh: { installed: boolean; loggedIn: boolean; user: string }
  graphify: boolean
  mcp: Record<string, McpStatus>
}

const run = (
  cmd: string,
  args: string[],
  timeout = 60_000
): Promise<{ ok: boolean; out: string }> =>
  new Promise((done) =>
    execFile(cmd, args, { timeout, windowsHide: true }, (err, out, errOut) =>
      done({ ok: !err, out: `${out}${errOut}` })
    )
  )

/** `claude mcp list` as name → status; connectors from claude.ai count under their own name. */
export function parseMcpList(text: string): Record<string, McpStatus> {
  const found: Record<string, McpStatus> = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^(?:claude\.ai )?(.+?): .* - (.+)$/.exec(line.trim())
    if (!m) continue
    found[m[1].toLowerCase()] = /needs auth/i.test(m[2])
      ? 'auth'
      : /connected/i.test(m[2])
        ? 'connected'
        : 'failed'
  }
  return found
}

export function parseClaudeAuth(text: string): MachineCheck['claude'] {
  try {
    const a = JSON.parse(text) as {
      loggedIn?: boolean
      authMethod?: string
      subscriptionType?: string
    }
    return {
      loggedIn: a.loggedIn === true,
      method: a.authMethod ?? '',
      plan: a.subscriptionType ?? ''
    }
  } catch {
    return { loggedIn: false, method: '', plan: '' }
  }
}

export async function machineCheck(): Promise<MachineCheck> {
  const [auth, gh, mcp] = await Promise.all([
    run('claude', ['auth', 'status']),
    run('gh', ['auth', 'status']),
    run('claude', ['mcp', 'list'])
  ])
  return {
    claude: parseClaudeAuth(auth.out),
    clis: Object.fromEntries(PROVIDERS.map((p) => [p.id, onPath(p.cli)])) as Record<
      ProviderId,
      boolean
    >,
    gh: {
      installed: onPath('gh'),
      loggedIn: gh.ok,
      user: /account (\S+)/.exec(gh.out)?.[1] ?? ''
    },
    graphify: onPath(process.env.ORCHESTRA_GRAPHIFY ?? 'graphify'),
    mcp: parseMcpList(mcp.out)
  }
}

/** Runs a step from recipes.ts: in the background, or in a terminal when it needs you. */
export async function runStep(id: string): Promise<{ ok: boolean; out: string }> {
  const step = findStep(id)
  if (!step?.cmd) return { ok: false, out: 'Unknown step.' }
  if (step.how === 'run') {
    const [cmd, ...args] = step.cmd.split(' ')
    const r = await run(cmd, args)
    return { ok: r.ok || /already exists/i.test(r.out), out: r.out.trim() }
  }
  if (step.how !== 'terminal') return { ok: false, out: 'This step has nothing to run.' }
  // shortcut: terminals only open on Windows; add macOS and Linux with the first non-Windows build
  if (process.platform !== 'win32') return { ok: false, out: 'Copy this into a terminal.' }
  spawn('cmd', ['/c', 'start', '', 'cmd', '/k', step.cmd], {
    detached: true,
    stdio: 'ignore'
  }).unref()
  return { ok: true, out: '' }
}

/** The latest plan limits, written by the Claude Code status line (~/.orchestra/usage.json), so
 * the meter also counts what you use outside Orchestra. Null if there's no usable reading. */
export async function readUsageFile(): Promise<{ at: number; windows: Usage } | null> {
  const raw = await readFile(join(homedir(), '.orchestra', 'usage.json'), 'utf8').catch(() => null)
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as { at?: unknown; windows?: Usage }
    return typeof d.at === 'number' && d.windows ? { at: d.at, windows: d.windows } : null
  } catch {
    return null
  }
}

/** Makes `to` the workspace: brings the agent library along and points Orchestra at it. */
export async function moveHome(
  from: string,
  to: string,
  setup: Setup,
  pointer: string
): Promise<void> {
  if (!isAbsolute(to)) throw new Error('Choose a full folder path.')
  await mkdir(join(to, 'projects'), { recursive: true })
  await cp(join(from, 'library'), join(to, 'library'), { recursive: true, force: false })
  await saveSetup(to, setup)
  await mkdir(dirname(pointer), { recursive: true })
  await writeFile(pointer, to)
}
