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
