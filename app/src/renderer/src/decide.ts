import { splitSuggestion } from './suggest.ts'

export interface Decision {
  question: string
  options: { label: string; recommended: boolean }[]
}

/** Splits a closing decision block off the Orchestrator's reply:
 *
 *   Decide: Which direction should the palette take?
 *   - Warm editorial (recommended)
 *   - Cool technical
 *
 * Needs 2 to 6 options. Formatting the model may add (bold, backticks, `*` bullets) is ignored. */
export function splitDecision(text: string): { body: string; decision: Decision | null } {
  const lines = text.trimEnd().split('\n')
  const clean = (s: string): string => s.replace(/[`*_]/g, '').trim()
  let i = lines.length
  const options: string[] = []
  while (i > 0 && /^\s*[-*•]\s+\S/.test(lines[i - 1])) {
    options.unshift(clean(lines[i - 1].replace(/^\s*[-*•]\s+/, '')))
    i--
  }
  const head = /^Decide:\s*(.+)$/i.exec(clean(lines[i - 1] ?? ''))
  if (!head || options.length < 2 || options.length > 6) return { body: text, decision: null }
  return {
    body: lines
      .slice(0, i - 1)
      .join('\n')
      .trimEnd(),
    decision: {
      question: head[1],
      options: options.map((o) => {
        const recommended = /\((recommended|my pick)\)\s*$/i.test(o)
        return { label: o.replace(/\s*\((recommended|my pick)\)\s*$/i, ''), recommended }
      })
    }
  }
}

/** The sentences in a reply that ask the user something. Code and links don't count. */
export function questionsIn(text: string): string {
  const prose = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
  return (prose.match(/[^.!?\n]*[^.!?\s][^.!?\n]*\?/g) ?? [])
    .map((s) =>
      s
        .replace(/[*_#>]/g, '')
        .replace(/^\s*(?:[-•]|\d+[.)])\s*/, '')
        .trim()
    )
    .join(' ')
}

/** What the Orchestrator's latest reply still needs from the user: a choice, deliverables to add
 * or any open-ended question. Null once they've answered, or if it didn't ask anything. */
export function waitingOnUser(
  messages: { t: string; role: string; text: string }[],
  known: Set<string>,
  selected: string[]
): { t: string; question: string } | null {
  const i = messages.map((m) => m.role).lastIndexOf('orchestrator')
  if (i < 0 || messages.slice(i + 1).some((m) => m.role === 'user')) return null
  const { body, ids } = splitSuggestion(messages[i].text, known)
  const decision = splitDecision(body).decision
  // adding its suggestions sends no message, so they answer it by being on the board
  const fresh = ids.filter((id) => !selected.includes(id))
  if (ids.length && !fresh.length) return null
  const question =
    decision?.question ?? (fresh.length ? 'Add these deliverables?' : questionsIn(body))
  return question ? { t: messages[i].t, question } : null
}
