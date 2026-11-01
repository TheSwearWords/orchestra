import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import type { AddressInfo } from 'net'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

// Orchestra's own tools, served to each agent's session over localhost (Pitcrew's pattern). The
// chain of command is enforced here, by which tools each level gets:
//   Orchestrator: brief_musician. Only it talks to the user, and only it starts Musicians.
//   Musician: run_instrument and report. Only Musicians start Instruments.
//   Instrument: nothing. Its closing message goes back to its Musician automatically.
// Each session connects to /mcp/<project>/<chat>/<agent>, so every call knows who is calling.

export type Role = 'orchestrator' | 'musician' | 'instrument'

/** What the tools need from the rest of the app (the Conductor). */
export interface Hub {
  roleOf(project: string, agent: string): Promise<Role | null>
  /** Ids the caller may brief or run, for the tool's description and checks. */
  choices(project: string, agent: string): Promise<{ id: string; name: string }[]>
  briefMusician(project: string, chat: string, musician: string, brief: string): Promise<string>
  runInstrument(
    project: string,
    chat: string,
    musician: string,
    instrument: string,
    brief: string
  ): Promise<string>
  report(
    project: string,
    chat: string,
    musician: string,
    text: string,
    done: boolean
  ): Promise<string>
}

type Result = { content: { type: 'text'; text: string }[]; isError?: boolean }
const ok = (text: string): Result => ({ content: [{ type: 'text', text }] })
const fail = (text: string): Result => ({ content: [{ type: 'text', text }], isError: true })
const run = async (fn: () => Promise<string>): Promise<Result> => {
  try {
    return ok(await fn())
  } catch (e) {
    return fail((e as Error).message)
  }
}

async function build(hub: Hub, project: string, chat: string, agent: string): Promise<McpServer> {
  const mcp = new McpServer({ name: 'orchestra', version: '1.0.0' })
  const role = await hub.roleOf(project, agent)
  const choices = await hub.choices(project, agent)
  const list = choices.map((c) => `${c.id} (${c.name})`).join(', ') || 'none'

  if (role === 'orchestrator') {
    mcp.registerTool(
      'brief_musician',
      {
        description: `Start the Musician for one of this project's chosen deliverables, or send more to one already working. Brief it like a person: the goal, the files to read, constraints, the output and where it goes, and what "done" means. It reports back to you. Musicians you can brief: ${list}.`,
        inputSchema: { musician: z.string(), brief: z.string() }
      },
      ({ musician, brief }) => run(() => hub.briefMusician(project, chat, musician, brief))
    )
  }

  if (role === 'musician') {
    mcp.registerTool(
      'run_instrument',
      {
        description: `Start one of your Instruments on one job, or send more to one already working. Brief it with the inputs, the output file and what "done" means. When it finishes, its report comes back to you as a message. Instruments you can run: ${list}.`,
        inputSchema: { instrument: z.string(), brief: z.string() }
      },
      ({ instrument, brief }) =>
        run(() => hub.runInstrument(project, chat, agent, instrument, brief))
    )
    mcp.registerTool(
      'report',
      {
        description:
          'Tell the Orchestrator where things stand: what was made (with file paths), what is next, and any decision the user needs to make. Set done to true only when the whole deliverable is finished. Report after each meaningful step, and whenever you need a decision.',
        inputSchema: { text: z.string(), done: z.boolean().optional() }
      },
      ({ text, done }) => run(() => hub.report(project, chat, agent, text, done ?? false))
    )
  }

  return mcp
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (c: string) => (data += c))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : undefined)
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

export interface OrchestraMcp {
  /** --mcp-config JSON for one agent's session */
  configFor(project: string, chat: string, agent: string): string
  close(): void
}

/** Starts the tool server on a random localhost port, guarded by a per-run token. */
export async function startOrchestraMcp(hub: Hub): Promise<OrchestraMcp> {
  const token = randomBytes(24).toString('hex')
  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const m = /^\/mcp\/([^/]+)\/([^/]+)\/([^/?]+)/.exec(req.url ?? '')
    if (!m || req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(m ? 401 : 404).end()
      return
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end() // stateless: no SSE stream or session to delete
      return
    }
    try {
      const [project, chat, agent] = m.slice(1).map(decodeURIComponent)
      const mcp = await build(hub, project, chat, agent)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      })
      res.on('close', () => {
        void transport.close()
        void mcp.close()
      })
      await mcp.connect(transport)
      await transport.handleRequest(req, res, await readBody(req))
    } catch (e) {
      if (!res.headersSent) res.writeHead(500).end(String((e as Error).message))
    }
  })
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r))
  const port = (http.address() as AddressInfo).port
  const enc = encodeURIComponent

  return {
    close: () => {
      http.closeAllConnections()
      http.close()
    },
    configFor: (project, chat, agent) =>
      JSON.stringify({
        mcpServers: {
          orchestra: {
            type: 'http',
            url: `http://127.0.0.1:${port}/mcp/${enc(project)}/${enc(chat)}/${enc(agent)}`,
            headers: { Authorization: `Bearer ${token}` }
          }
        }
      })
  }
}
