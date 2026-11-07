import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// A choice the Orchestrator puts in the Action box beside its window on the Create board,
// when seeing the options helps (colour palettes, type pairings, logo routes). It stays while
// the user refines it; picking an option answers it and it leaves the box. Each answer goes
// back to the Orchestrator as a message in the chat that asked. Kept per project in
// .orchestra/asks.json.

export interface Ask {
  id: string // lowercase-with-dashes; asking again with the same id updates the window
  chat: string
  title: string // the window's name, e.g. "Colours"
  question: string
  options: Option[] // 2 to 6
  about?: string // the deliverable or foundation it's for, to wire the window to its seat
  status: 'open' | 'answered'
  answer?: string
  t: string
}

/** One option: a few words, and what to show for it (swatches, a line of detail). */
export interface Option {
  label: string
  colors?: string[] // hex swatches, for palettes
  detail?: string
}
export type OptionInput = string | Option

const ID = /^[a-z0-9][a-z0-9-]{0,47}$/
const HEX = /^#[0-9a-f]{3,8}$/i

/** Options as given (words, or objects), tidied: blanks dropped, swatches only valid hex. */
export const tidyOptions = (options: OptionInput[]): Option[] =>
  options
    .map((o) => (typeof o === 'string' ? { label: o } : o))
    .map((o) => ({
      label: String(o.label ?? '').trim(),
      ...(o.colors?.length ? { colors: o.colors.filter((c) => HEX.test(c)).slice(0, 8) } : {}),
      ...(o.detail?.trim() ? { detail: o.detail.trim() } : {})
    }))
    .filter((o) => o.label)
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
export function askProblems(
  a: Pick<Ask, 'id' | 'title' | 'question'> & { options: OptionInput[] }
): string[] {
  const out: string[] = []
  if (!ID.test(a.id)) out.push('id must be lowercase-with-dashes, under 48 characters.')
  if (!a.title.trim()) out.push('Give the window a title.')
  if (!a.question.trim()) out.push('Ask a question.')
  const opts = tidyOptions(a.options)
  if (opts.length < 2 || opts.length > 6) out.push('Give two to six options.')
  return out
}

/** Opens a window, or updates the one with this id (new options after a refinement). */
export async function openAsk(
  dir: string,
  a: Omit<Ask, 'status' | 't' | 'options'> & { options: OptionInput[] }
): Promise<Ask> {
  const problems = askProblems(a)
  if (problems.length)
    throw new Error(`Fix the window and open it again:\n- ${problems.join('\n- ')}`)
  const all = await readAsks(dir)
  const ask: Ask = {
    ...a,
    options: tidyOptions(a.options),
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
