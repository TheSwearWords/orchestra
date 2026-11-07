import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// A window the Orchestrator opens on the user's Create board to ask one thing (the colour
// direction, which deliverable first), with options to pick from. It stays open while the user
// refines it; picking an option answers it. Each answer goes back to the Orchestrator as a
// message in the chat that asked. Kept per project in .orchestra/asks.json.

export interface Ask {
  id: string // lowercase-with-dashes; asking again with the same id updates the window
  chat: string
  title: string // the window's name, e.g. "Colours"
  question: string
  options: string[] // 2 to 6, each a few words
  about?: string // the deliverable or foundation it's for, to wire the window to its seat
  status: 'open' | 'answered'
  answer?: string
  t: string
}

const ID = /^[a-z0-9][a-z0-9-]{0,47}$/
const file = (dir: string): string => join(dir, '.orchestra', 'asks.json')

export async function readAsks(dir: string): Promise<Record<string, Ask>> {
  return readFile(file(dir), 'utf8')
    .then((t) => JSON.parse(t) as Record<string, Ask>)
    .catch(() => ({}))
}

async function save(dir: string, all: Record<string, Ask>): Promise<void> {
  await mkdir(join(dir, '.orchestra'), { recursive: true })
  await writeFile(file(dir), JSON.stringify(all, null, 2))
}

/** What's wrong with an ask, in words the Orchestrator can fix. */
export function askProblems(a: Pick<Ask, 'id' | 'title' | 'question' | 'options'>): string[] {
  const out: string[] = []
  if (!ID.test(a.id)) out.push('id must be lowercase-with-dashes, under 48 characters.')
  if (!a.title.trim()) out.push('Give the window a title.')
  if (!a.question.trim()) out.push('Ask a question.')
  const opts = a.options.map((o) => o.trim()).filter(Boolean)
  if (opts.length < 2 || opts.length > 6) out.push('Give two to six options.')
  return out
}

/** Opens a window, or updates the one with this id (new options after a refinement). */
export async function openAsk(dir: string, a: Omit<Ask, 'status' | 't'>): Promise<Ask> {
  const problems = askProblems(a)
  if (problems.length)
    throw new Error(`Fix the window and open it again:\n- ${problems.join('\n- ')}`)
  const all = await readAsks(dir)
  const ask: Ask = {
    ...a,
    options: a.options.map((o) => o.trim()).filter(Boolean),
    status: 'open',
    t: new Date().toISOString()
  }
  all[a.id] = ask
  await save(dir, all)
  return ask
}

/** Records the user's pick. A refinement (free text) leaves the window open. */
export async function answerAsk(
  dir: string,
  id: string,
  text: string,
  final: boolean
): Promise<Ask> {
  const all = await readAsks(dir)
  const a = all[id]
  if (!a) throw new Error('That window is gone.')
  all[id] = final ? { ...a, status: 'answered', answer: text } : a
  await save(dir, all)
  return all[id]
}
