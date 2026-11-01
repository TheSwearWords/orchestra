/** Splits the Orchestrator's closing "Suggest deliverables: a, b" line off a reply, keeping only
 * ids the library knows. Formatting the model may add (bold, backticks, a full stop) is ignored. */
export function splitSuggestion(text: string, known: Set<string>): { body: string; ids: string[] } {
  const lines = text.trimEnd().split('\n')
  const m = /^\s*Suggest deliverables:\s*(.+?)\s*\.?\s*$/i.exec(
    (lines.at(-1) ?? '').replace(/[`*]/g, '')
  )
  if (!m) return { body: text, ids: [] }
  const ids = m[1]
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((id) => known.has(id))
  return { body: lines.slice(0, -1).join('\n').trimEnd(), ids: [...new Set(ids)] }
}
