import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// What an audit found in a deliverable's work, kept in audits/<deliverable>.json. A finding
// points at something inside the work (a Figma node, a Blender object, a file and line), not at
// pixels. An Instrument writes the audit through its Musician, so checkAudit is a trust boundary
// (like askProblems): it says what is wrong in words the agent can act on.

export type Severity = 'high' | 'medium' | 'low'
export type FindingStatus = 'open' | 'fixed' | 'dismissed'
export interface Finding {
  id: string
  severity: Severity
  note: string // what is wrong, where, and what to do
  target?: { kind: string; ref: string }
  status: FindingStatus
}
export interface Audit {
  score?: number // 0 to 100
  findings: Finding[]
  updated: string
}

const SEVERITY: Severity[] = ['high', 'medium', 'low']
const STATUS: FindingStatus[] = ['open', 'fixed', 'dismissed']
const MAX_FINDINGS = 100
const MAX_NOTE = 1000
const MAX_TARGET = 300
const ID = /^[a-z0-9][a-z0-9-]*$/

export const emptyAudit = (): Audit => ({ findings: [], updated: new Date().toISOString() })

/** Reads an audit an agent wrote. Anything wrong is listed in `problems` and nothing is kept
 * from a malformed finding, so a half-right audit never reaches the board. */
export function checkAudit(input: unknown): { audit?: Audit; problems: string[] } {
  const problems: string[] = []
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { problems: ['An audit is an object with a "findings" list.'] }
  const o = input as Record<string, unknown>
  if (!Array.isArray(o.findings)) return { problems: ['"findings" must be a list.'] }
  if (o.findings.length > MAX_FINDINGS)
    problems.push(`At most ${MAX_FINDINGS} findings. Group the small ones.`)

  let score: number | undefined
  if (o.score !== undefined) {
    if (typeof o.score === 'number' && Number.isFinite(o.score) && o.score >= 0 && o.score <= 100)
      score = Math.round(o.score)
    else problems.push('"score" must be a number from 0 to 100.')
  }

  const seen = new Set<string>()
  const findings: Finding[] = []
  o.findings.slice(0, MAX_FINDINGS).forEach((raw, i) => {
    const at = `Finding ${i + 1}`
    if (!raw || typeof raw !== 'object') return void problems.push(`${at} must be an object.`)
    const f = raw as Record<string, unknown>
    const note = typeof f.note === 'string' ? f.note.trim() : ''
    if (!note) problems.push(`${at} needs a "note": what is wrong, where, and what to do.`)
    if (note.length > MAX_NOTE) problems.push(`${at}: the note is over ${MAX_NOTE} characters.`)
    if (!SEVERITY.includes(f.severity as Severity))
      problems.push(`${at}: "severity" must be high, medium or low.`)
    const status = f.status === undefined ? 'open' : f.status
    if (!STATUS.includes(status as FindingStatus))
      problems.push(`${at}: "status" must be open, fixed or dismissed.`)
    let target: Finding['target']
    if (f.target !== undefined) {
      const t = f.target as Record<string, unknown> | null
      if (
        t &&
        typeof t === 'object' &&
        typeof t.kind === 'string' &&
        typeof t.ref === 'string' &&
        t.kind.trim() &&
        t.ref.trim() &&
        t.ref.length <= MAX_TARGET
      )
        target = { kind: t.kind.trim(), ref: t.ref.trim() }
      else
        problems.push(
          `${at}: "target" needs a "kind" and a "ref" (${MAX_TARGET} characters at most).`
        )
    }
    // ids are made up when they are missing, and must not repeat
    let id = typeof f.id === 'string' && ID.test(f.id) ? f.id : `f${i + 1}`
    if (seen.has(id)) problems.push(`${at}: the id "${id}" is used twice.`)
    while (seen.has(id)) id = `${id}-${i + 1}`
    seen.add(id)
    findings.push({
      id,
      severity: f.severity as Severity,
      note,
      ...(target ? { target } : {}),
      status: status as FindingStatus
    })
  })
  if (problems.length) return { problems }
  return {
    audit: {
      ...(score === undefined ? {} : { score }),
      findings,
      updated: new Date().toISOString()
    },
    problems
  }
}

/** The findings still waiting on the user, worst first. */
export function openFindings(audit: Audit): Finding[] {
  return audit.findings
    .filter((f) => f.status === 'open')
    .sort((a, b) => SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity))
}

/** Marks one finding. Returns a new audit; an id that is not there changes nothing. */
export function setStatus(audit: Audit, id: string, status: FindingStatus): Audit {
  if (!audit.findings.some((f) => f.id === id)) return audit
  return {
    ...audit,
    findings: audit.findings.map((f) => (f.id === id ? { ...f, status } : f)),
    updated: new Date().toISOString()
  }
}

/** A finding the user adds by hand, for work an agent cannot audit. */
export function addManual(audit: Audit, note: string, severity: Severity = 'medium'): Audit {
  const text = note.trim().slice(0, MAX_NOTE)
  if (!text || audit.findings.length >= MAX_FINDINGS) return audit
  let n = audit.findings.length + 1
  while (audit.findings.some((f) => f.id === `m${n}`)) n++
  return {
    ...audit,
    findings: [...audit.findings, { id: `m${n}`, severity, note: text, status: 'open' }],
    updated: new Date().toISOString()
  }
}

/** What signing off would leave behind: the sign-off dialog lists these. */
export function signOffCheck(audit: Audit): { open: Finding[] } {
  return { open: openFindings(audit) }
}

const file = (project: string, deliverable: string): string =>
  join(project, 'audits', `${deliverable}.json`)

/** The saved audit, or an empty one. A file that does not parse counts as no audit. */
export async function readAudit(project: string, deliverable: string): Promise<Audit> {
  if (!ID.test(deliverable)) throw new Error(`"${deliverable}" is not a deliverable id.`)
  try {
    const raw = JSON.parse(await readFile(file(project, deliverable), 'utf8'))
    const { audit } = checkAudit(raw)
    if (!audit) return emptyAudit()
    // checking stamps the time; a saved audit keeps the time it was saved
    return typeof raw.updated === 'string' ? { ...audit, updated: raw.updated } : audit
  } catch {
    return emptyAudit()
  }
}

export async function saveAudit(project: string, deliverable: string, audit: Audit): Promise<void> {
  if (!ID.test(deliverable)) throw new Error(`"${deliverable}" is not a deliverable id.`)
  await mkdir(join(project, 'audits'), { recursive: true })
  await writeFile(file(project, deliverable), JSON.stringify(audit, null, 2) + '\n')
}
