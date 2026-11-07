import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// Each project's knowledge graph, built by Graphify from the project folder (notes, research,
// references, what agents made) into <project>/graphify-out/graph.json, and one graph of the
// whole vault merged from them for the Studio. Agents query it instead of rereading files.
// Graphify's extraction runs through the `claude` CLI, on the user's Claude subscription.

const GRAPHIFY = process.env.ORCHESTRA_GRAPHIFY ?? 'graphify'
const EVERY = 10 * 60_000 // rebuild a project at most this often; changes in between wait

export const graphFile = (dir: string): string => join(dir, 'graphify-out', 'graph.json')

// what Graphify leaves out of a project: Orchestra's own working files and its output
export const IGNORE = ['.orchestra/', 'graphify-out/', 'boards/', '*.json.bak', ''].join('\n')

/** The `graphify query` arguments for a question, kept to a short answer for an agent. */
export const queryArgs = (question: string, graph: string, budget = 1500): string[] => [
  'query',
  question,
  '--graph',
  graph,
  '--budget',
  String(budget)
]

/** When a rebuild may start: not while one runs, and not again within EVERY of the last. */
export function due(last: number | undefined, running: boolean, now: number): number | null {
  if (running) return null
  const wait = last === undefined ? 0 : last + EVERY - now
  return Math.max(0, wait)
}

const run = (args: string[], cwd: string, timeout = 30 * 60_000): Promise<string> =>
  new Promise((done, fail) =>
    execFile(
      GRAPHIFY,
      args,
      { cwd, timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        // query exits 3 (ambiguous) or 4 (no match) with a useful answer on stdout
        if (err && !(stdout && [3, 4].includes(Number(err.code))))
          fail(new Error(stderr || err.message))
        else done(stdout)
      }
    )
  )

export interface Graphs {
  /** Something changed in a project: rebuild its graph soon, then the vault's. */
  touch(project: string): void
  /** Answers a question from a project's graph, or the vault's (project null). */
  query(project: string | null, question: string): Promise<string>
  status(project: string): 'none' | 'building' | 'ready'
}

export function graphs(opts: {
  home: string // Orchestra/
  projectDir: (id: string) => string
  projects: () => Promise<string[]>
  onBuilt?: (project: string) => void
}): Graphs {
  const last = new Map<string, number>()
  const running = new Set<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const vault = join(opts.home, 'graphify-out', 'graph.json')

  async function build(project: string): Promise<void> {
    const dir = opts.projectDir(project)
    running.add(project)
    try {
      const ignore = join(dir, '.graphifyignore')
      if (!existsSync(ignore)) await writeFile(ignore, IGNORE)
      await run(['extract', dir, '--backend', 'claude-cli'], dir)
      last.set(project, Date.now())
      await merge()
      opts.onBuilt?.(project)
    } catch (e) {
      console.error(`graph for ${project}:`, (e as Error).message)
      last.set(project, Date.now()) // a failure waits like a success, so it doesn't spin
    } finally {
      running.delete(project)
    }
  }

  // the vault's graph: every project's, merged
  async function merge(): Promise<void> {
    const ids = await opts.projects()
    const files = ids.map((id) => graphFile(opts.projectDir(id))).filter((f) => existsSync(f))
    if (!files.length) return
    await mkdir(join(opts.home, 'graphify-out'), { recursive: true })
    if (files.length === 1) return void (await writeFile(vault, await readFile(files[0])))
    await run(['merge-graphs', ...files, '--out', vault], opts.home)
  }

  return {
    touch(project) {
      const wait = due(last.get(project), running.has(project), Date.now())
      if (wait === null || timers.has(project)) return
      timers.set(
        project,
        setTimeout(() => {
          timers.delete(project)
          void build(project)
        }, wait)
      )
    },
    async query(project, question) {
      const file = project ? graphFile(opts.projectDir(project)) : vault
      if (!existsSync(file)) {
        if (project) this.touch(project)
        return 'There is no graph yet: it builds in the background after the first Interpret or turn. Read the files directly for now.'
      }
      return (
        await run(queryArgs(question, file), project ? opts.projectDir(project) : opts.home)
      ).trim()
    },
    status(project) {
      if (running.has(project)) return 'building'
      return existsSync(graphFile(opts.projectDir(project))) ? 'ready' : 'none'
    }
  }
}
