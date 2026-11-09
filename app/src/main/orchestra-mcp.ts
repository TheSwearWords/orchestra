import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import type { AddressInfo } from 'net'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { InstrumentDraft, MusicianDraft } from './proposals.ts'
import type { PreviewInput } from './previews.ts'
import type { OptionInput } from './asks.ts'

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
  briefMusician(
    project: string,
    chat: string,
    musician: string,
    brief: string,
    foundation?: string
  ): Promise<string>
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
  proposeMusician(project: string, chat: string, draft: MusicianDraft): Promise<string>
  queryGraph(project: string, question: string): Promise<string>
  setPreview(project: string, chat: string, musician: string, input: PreviewInput): Promise<string>
  openWindow(
    project: string,
    chat: string,
    w: { id: string; title: string; question: string; options: OptionInput[]; about?: string }
  ): Promise<string>
  proposeInstrument(
    project: string,
    chat: string,
    musician: string,
    draft: InstrumentDraft
  ): Promise<string>
}

const ids = z.array(z.string()).optional()
const model = z.enum(['opus', 'sonnet', 'haiku']).optional()
const prompt = z
  .string()
  .describe("The agent's full instructions (the markdown body), written from the library template.")

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

  if (role === 'orchestrator' || role === 'musician') {
    mcp.registerTool(
      'ask_graph',
      {
        description:
          'Ask the knowledge graph before reading files: it links everything in the project (notes, research, references, decisions, what agents made) and answers from those links, citing files you can then read. In the Studio it covers every project, so it answers questions across them (which typefaces the user keeps picking, where a palette came from). Ask in plain words.',
        inputSchema: { question: z.string() }
      },
      ({ question }) => run(() => hub.queryGraph(project, question))
    )
  }

  if (role === 'orchestrator') {
    mcp.registerTool(
      'brief_musician',
      {
        description: `Start the Musician for one of this project's chosen deliverables, or send more to one already working. Brief it like a person: the goal, the files to read, constraints, the output and where it goes, and what "done" means. It reports back to you. Musicians you can brief: ${list}.`,
        inputSchema: {
          musician: z.string(),
          brief: z.string(),
          foundation: z
            .string()
            .optional()
            .describe('While its prerequisites are missing: the id of the next one to make')
        }
      },
      ({ musician, brief, foundation }) =>
        run(() => hub.briefMusician(project, chat, musician, brief, foundation))
    )
    mcp.registerTool(
      'propose_musician',
      {
        description:
          "Propose a new Musician when the user wants a deliverable no library Musician covers. Draft it from library/templates/musician-template.md. The user sees it as an approval card in the chat; nothing is saved until they approve, and then it joins this project's deliverables. List only existing Instruments; once approved, the Musician proposes any new ones it needs.",
        inputSchema: {
          id: z.string().describe('lowercase-with-dashes, e.g. "trailer"'),
          name: z.string(),
          deliverable: z.string().describe('What it owns end to end, one line'),
          category: z.string(),
          icon: z.string().optional().describe('A Remix icon name, e.g. film-line'),
          keywords: ids,
          prerequisites: ids.describe('Foundation Instrument ids, built once per project'),
          instruments: ids.describe('Its own existing Instrument ids, in run order'),
          model,
          prompt
        }
      },
      (draft) => run(() => hub.proposeMusician(project, chat, draft))
    )
    mcp.registerTool(
      'open_window',
      {
        description:
          "Put a choice in the Action box beside your window on the user's Create board, whenever the user has to pick between options, once you know enough from their research and answers to offer good ones. Show the options themselves rather than describing them: colours (hex) for palettes, font (a Google Fonts family name) and sample for typefaces, image for anything visual. Plain words are fine for choices that aren't visual, such as where to start. Call again with the same id to replace the options after they refine. Their pick, or their refinement, comes back as a message starting with the title in brackets, and a picked choice leaves the box.",
        inputSchema: {
          id: z.string().describe('lowercase-with-dashes, one per topic, e.g. "colours"'),
          title: z.string().describe('Short, e.g. "Colours"'),
          question: z.string(),
          options: z
            .array(
              z.union([
                z.string(),
                z.object({
                  label: z.string(),
                  colors: z.array(z.string()).optional().describe('Hex swatches, e.g. #0538FF'),
                  font: z
                    .string()
                    .optional()
                    .describe(
                      'A Google Fonts family, e.g. Playfair Display: the option is set in it'
                    ),
                  sample: z.string().optional().describe('The words to set the font in'),
                  image: z
                    .string()
                    .optional()
                    .describe(
                      'https address of a picture, or a png, jpg, gif, webp or svg in the project, e.g. prereqs/logo/a.png'
                    ),
                  detail: z.string().optional().describe('One short line under the option')
                })
              ])
            )
            .describe('Two to six concrete options'),
          about: z
            .string()
            .optional()
            .describe('The deliverable (Musician) or foundation (Instrument) id it is for')
        }
      },
      (w) => run(() => hub.openWindow(project, chat, w))
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
    mcp.registerTool(
      'set_preview',
      {
        description:
          'Show finished work on the board, as a picture the user clicks to go to it. For Figma: the url of the page or frame, and image_url from get_screenshot (its short-lived url) of something representative, such as the buttons or a layout. For a website running locally: the localhost url, dev (the command that serves it) and dir (its folder in the project); Orchestra starts it when clicked and takes the picture itself. Call again with the same label to update it.',
        inputSchema: {
          label: z.string().describe('Short, e.g. "Brand kit"'),
          url: z.string().describe('https, or http on localhost'),
          image_url: z.string().optional().describe('https address of a png, jpeg or webp'),
          dev: z.string().optional().describe('e.g. "npm run dev"; localhost only'),
          dir: z.string().optional().describe('Folder inside the project to run dev in')
        }
      },
      (input) => run(() => hub.setPreview(project, chat, agent, input))
    )
    mcp.registerTool(
      'propose_instrument',
      {
        description:
          'Propose a new Instrument for your own crew, only when none in the library can do the job and the job is distinct and worth reviewing on its own. Draft it from library/templates/instrument-template.md. The user approves it through the Orchestrator; once approved it joins your Instruments and you can run it.',
        inputSchema: {
          id: z.string().describe('lowercase-with-dashes, e.g. "shot-cutter"'),
          name: z.string(),
          job: z.string().describe('One sentence'),
          output: z
            .string()
            .describe('The file it writes, inside the project, e.g. prereqs/shot-list.md'),
          needs: ids.describe('Instrument ids whose output must exist first'),
          model,
          prompt
        }
      },
      (draft) => run(() => hub.proposeInstrument(project, chat, agent, draft))
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
