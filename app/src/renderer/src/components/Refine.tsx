// III · Refine. Each deliverable locked in on the Create board can be flagged ready for Refine by
// pointing at the work it is made in: a Figma page, a Blender file, a folder. Ready ones get a
// work window and a scorecard of findings, and are signed off when the user is happy. Only the
// user moves a deliverable between these; agents never do.
import { useCallback, useEffect, useState } from 'react'
import type { CreateState, Musician } from '../../../preload'
import type { RefineView } from '../../../main/refine'
import type { Finding, FindingStatus, Severity } from '../../../main/audits'
import { Board, type CardSpec } from '../canvas/Board'
import type { Frame } from '../canvas/Book'

const W = 520
const GAP = 96
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const solid =
  'h-8 shrink-0 rounded-full bg-brand px-3.5 type-label-s text-on-brand disabled:bg-muted disabled:text-fg-disabled'
const quiet = 'h-8 shrink-0 rounded-full border border-chip-line px-3.5 type-label-s text-link'
const field =
  'h-8 min-w-0 flex-1 rounded-md border border-card-line bg-transparent px-2.5 type-body-s outline-none focus:border-brand'
const KIND: Record<string, string> = {
  figma: 'Figma',
  blender: 'Blender',
  folder: 'Folder',
  url: 'Web page',
  other: 'File'
}
// the renderer may not import the main-process module (it reads files), so the stage is read here
const stageOf = (s: RefineView['state'], id: string): 'draft' | 'ready' | 'signed-off' =>
  s.signed.includes(id) ? 'signed-off' : s.approved.includes(id) ? 'ready' : 'draft'
const SEVERITY: Record<Severity, string> = { high: 'High', medium: 'Medium', low: 'Low' }

export function Refine({ project, frame }: { project: string; frame: Frame }): React.JSX.Element {
  const [view, setView] = useState<RefineView | null>(null)
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = (): void => {
      void window.api.refineLoad(project).then(setView, () => {})
      void window.api.loadCreate(project).then(setPlan, () => {})
    }
    load()
    addEventListener('orchestra:agents-changed', load)
    return () => removeEventListener('orchestra:agents-changed', load)
  }, [project])

  /** Runs one change and redraws from the answer. */
  const act = useCallback(async (run: () => Promise<RefineView>): Promise<void> => {
    setError('')
    try {
      setView(await run())
    } catch (e) {
      setError(reason(e))
    }
  }, [])

  const musician = (id: string): Musician | undefined => plan?.musicians.find((m) => m.id === id)
  const nameOf = (id: string): string => musician(id)?.name ?? id
  const cards: CardSpec[] = []

  if (view && plan) {
    const ready = view.locked.filter((id) => stageOf(view.state, id) !== 'draft')
    const waiting = view.locked.filter((id) => stageOf(view.state, id) === 'draft')

    if (!view.locked.length) {
      cards.push({
        id: 'empty',
        title: 'Nothing to refine yet',
        x: 0,
        y: 0,
        w: 480,
        body: (
          <div className="flex flex-col items-start gap-4 p-5">
            <p className="type-body-m text-dim">
              Refine opens up once a deliverable is locked in on the Create board. Then point it at
              the work it is made in, and check it here.
            </p>
            <button onClick={() => frame.go?.('create')} className={solid}>
              Go to Create
            </button>
          </div>
        )
      })
    }

    if (waiting.length) {
      cards.push({
        id: 'waiting',
        title: 'Not ready yet',
        count: String(waiting.length),
        x: -(W + GAP),
        y: 0,
        w: W,
        body: (
          <ul className="flex flex-col divide-y divide-hair">
            {waiting.map((id) => (
              <li key={id} className="p-5">
                <ReadyRow
                  name={nameOf(id)}
                  what={musician(id)?.deliverable ?? ''}
                  link={view.work[id]?.ref ?? ''}
                  onReady={(ref) =>
                    act(async () => {
                      await window.api.refineSetWork(project, id, ref)
                      return window.api.refineApprove(project, id)
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )
      })
    }

    ready.forEach((id, i) => {
      const work = view.work[id]
      const audit = view.audits[id]
      const signed = stageOf(view.state, id) === 'signed-off'
      const x = i * (W + GAP)
      cards.push(
        {
          id: `work-${id}`,
          title: nameOf(id),
          count: signed ? 'Signed off' : 'Ready',
          kind: 'deliverable',
          x,
          y: 0,
          w: W,
          body: (
            <WorkBody
              kind={KIND[work?.kind ?? 'other']}
              link={work?.ref ?? ''}
              signed={signed}
              onOpen={() =>
                void window.api.refineOpenWork(project, id).catch((e) => setError(reason(e)))
              }
              onLink={(ref) => act(() => window.api.refineSetWork(project, id, ref))}
              onReopen={() => act(() => window.api.refineReopen(project, id))}
              onSignOff={() => {
                const open = (audit?.findings ?? []).filter((f) => f.status === 'open')
                const warn = open.length
                  ? `${open.length} finding${open.length === 1 ? ' is' : 's are'} still open:\n\n${open
                      .map((f) => `• ${f.note}`)
                      .join('\n')}\n\nSign off anyway?`
                  : `Sign off ${nameOf(id)}?`
                if (confirm(warn)) void act(() => window.api.refineSignOff(project, id))
              }}
            />
          )
        },
        {
          id: `score-${id}`,
          title: 'Findings',
          count: audit ? `${audit.findings.filter((f) => f.status === 'open').length} open` : '',
          x,
          y: 360,
          w: W,
          link: `work-${id}`,
          auto: true,
          body: (
            <Scorecard
              findings={audit?.findings ?? []}
              onStatus={(f, s) => act(() => window.api.refineSetFinding(project, id, f, s))}
              onAdd={(note, sev) => act(() => window.api.refineAddFinding(project, id, note, sev))}
            />
          )
        }
      )
    })
  }

  return (
    <Board
      project={project}
      board="refine"
      label="III · Refine"
      pages={frame.pages}
      preview={frame.preview}
      cards={cards}
      top={
        error && (
          <p
            role="alert"
            className="border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
          >
            {error}
          </p>
        )
      }
    />
  )
}

/** One deliverable waiting to be flagged: where its work lives, then the button. */
function ReadyRow({
  name,
  what,
  link,
  onReady
}: {
  name: string
  what: string
  link: string
  onReady: (ref: string) => Promise<void>
}): React.JSX.Element {
  const [ref, setRef] = useState(link)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="type-heading-s">{name}</span>
        <span className="type-caption text-dim">{what}</span>
      </div>
      <div className="flex gap-2">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Link or path to the work: a Figma page, a .blend file, a folder"
          aria-label={`Where ${name} is made`}
          className={field}
        />
        <button onClick={() => void onReady(ref)} disabled={!ref.trim()} className={solid}>
          Ready for Refine
        </button>
      </div>
    </div>
  )
}

function WorkBody({
  kind,
  link,
  signed,
  onOpen,
  onLink,
  onReopen,
  onSignOff
}: {
  kind: string
  link: string
  signed: boolean
  onOpen: () => void
  onLink: (ref: string) => Promise<void>
  onReopen: () => Promise<void>
  onSignOff: () => void
}): React.JSX.Element {
  const [ref, setRef] = useState(link)
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <span className="type-label-mono text-dim">{kind}</span>
        <button onClick={onOpen} className={`${quiet} ml-auto`}>
          Open
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ref !== link && void onLink(ref)}
          aria-label="Where the work lives"
          className={field}
        />
        <button onClick={() => void onLink(ref)} disabled={ref === link} className={quiet}>
          Save link
        </button>
      </div>
      <div className="flex gap-2 border-t border-hair pt-4">
        <button onClick={() => void onReopen()} className={quiet}>
          Back to Create
        </button>
        {!signed && (
          <button onClick={onSignOff} className={`${solid} ml-auto`}>
            Sign off
          </button>
        )}
      </div>
    </div>
  )
}

function Scorecard({
  findings,
  onStatus,
  onAdd
}: {
  findings: Finding[]
  onStatus: (id: string, status: FindingStatus) => Promise<void>
  onAdd: (note: string, severity: Severity) => Promise<void>
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState<Severity>('medium')
  const open = findings.filter((f) => f.status === 'open')
  const done = findings.filter((f) => f.status !== 'open')
  return (
    <div className="flex flex-col gap-4 p-5">
      {!findings.length && (
        <p className="type-body-s text-dim">
          No findings yet. Running audits comes next; for now, add what you notice.
        </p>
      )}
      {[...open, ...done].map((f) => (
        <div
          key={f.id}
          className={`flex flex-col gap-1.5 ${f.status === 'open' ? '' : 'opacity-60'}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`type-label-mono ${f.severity === 'high' ? 'text-signal-fg' : 'text-dim'}`}
            >
              {SEVERITY[f.severity]}
            </span>
            {f.status !== 'open' && <span className="type-label-mono text-dim">{f.status}</span>}
            {f.target && (
              <span className="truncate type-log-s text-dim" title={f.target.ref}>
                {f.target.kind} · {f.target.ref}
              </span>
            )}
          </div>
          <p className="type-body-s">{f.note}</p>
          <div className="flex gap-2">
            {f.status === 'open' ? (
              <>
                <button onClick={() => void onStatus(f.id, 'fixed')} className={quiet}>
                  Fixed
                </button>
                <button onClick={() => void onStatus(f.id, 'dismissed')} className={quiet}>
                  Dismiss
                </button>
              </>
            ) : (
              <button onClick={() => void onStatus(f.id, 'open')} className={quiet}>
                Reopen
              </button>
            )}
          </div>
        </div>
      ))}
      <form
        className="flex gap-2 border-t border-hair pt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!note.trim()) return
          void onAdd(note, severity).then(() => setNote(''))
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a finding"
          aria-label="Add a finding"
          className={field}
        />
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          aria-label="Severity"
          className="h-8 rounded-md border border-card-line bg-transparent px-2 type-body-s"
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" disabled={!note.trim()} className={solid}>
          Add
        </button>
      </form>
    </div>
  )
}
