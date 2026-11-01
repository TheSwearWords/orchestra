import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import type { Reference, ResearchState, Tag } from '../../../preload'
import { Icon } from './Icon'

const field =
  'w-full border border-line bg-canvas px-3 type-body-s outline-none placeholder:text-fg-2 focus:border-focus'
const outlineButton =
  'flex h-9 shrink-0 items-center gap-2 border border-line-strong bg-canvas px-4 type-label-m transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.97]'
const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

export function Research({ project }: { project: string }): React.JSX.Element {
  const [data, setData] = useState<ResearchState | null>(null)
  const [error, setError] = useState('')
  const [interpreting, setInterpreting] = useState(false)

  useEffect(() => {
    window.api.loadResearch(project).then(setData, (e) => setError(reason(e)))
  }, [project])

  /** Runs a change, then reloads; any failure lands in the banner. */
  async function run(change: () => Promise<unknown>): Promise<boolean> {
    setError('')
    try {
      await change()
      setData(await window.api.loadResearch(project))
      return true
    } catch (e) {
      setError(reason(e))
      return false
    }
  }

  async function interpret(): Promise<void> {
    setInterpreting(true)
    await run(() => window.api.interpret(project))
    setInterpreting(false)
  }

  if (!data) return <div className="flex-1" />
  const links = data.references.filter((r) => r.kind === 'link')
  const files = data.references.filter((r) => r.kind === 'file')

  return (
    <div className="stagger bg-canvas pb-12">
      <Sites sites={data.sites} onAdd={(site) => run(() => window.api.addSite(site))} />

      {error && (
        <p
          role="alert"
          className="mx-6 mt-6 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
        >
          {error}
        </p>
      )}

      <LinkSection
        refs={links}
        project={project}
        onAdd={(input) => run(() => window.api.addLink(project, input))}
        run={run}
      />
      <FileSection refs={files} project={project} run={run} />
      <Interpretation
        text={data.interpretation}
        count={data.references.length}
        busy={interpreting}
        onRun={interpret}
      />
    </div>
  )
}

function Sites({
  sites,
  onAdd
}: {
  sites: ResearchState['sites']
  onAdd: (site: { name: string; url: string }) => Promise<boolean>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (await onAdd({ name, url })) {
      setAdding(false)
      setName('')
      setUrl('')
    }
  }

  return (
    <div className="mt-6 border-y border-line">
      <ul className="grid grid-cols-2 @4xl:grid-cols-4">
        {sites.map((s) => (
          <li
            key={s.url}
            className="border-r border-b border-line [&:nth-child(2n)]:border-r-0 @4xl:[&:nth-child(2n)]:border-r @4xl:[&:nth-child(4n)]:border-r-0"
          >
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              title={s.url}
              className="flex h-12 items-center justify-center gap-2 bg-subtle type-label-m transition-colors duration-150 hover:bg-muted"
            >
              {s.name}
              <Icon name="arrow-right-up-line" className="text-fg-2" />
            </a>
          </li>
        ))}
        <li className="border-b border-line">
          <button
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
            className={`flex h-12 w-full items-center justify-center gap-2 transition-colors duration-150 hover:bg-muted ${adding ? 'bg-muted type-current-m' : 'bg-canvas type-label-m text-link'}`}
          >
            <Icon name="add-line" />
            Add site
          </button>
        </li>
      </ul>
      {adding && (
        <form onSubmit={submit} className="stagger flex items-center gap-3 bg-subtle px-6 py-3">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Site name"
            className={`h-9 max-w-48 ${field}`}
          />
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="godly.website"
            aria-label="Site address"
            className={`h-9 ${field}`}
          />
          <button type="submit" className={solidButton}>
            Save site
          </button>
          <button type="button" onClick={() => setAdding(false)} className="type-label-m text-fg-2">
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  count,
  noun,
  action
}: {
  title: string
  count: number
  noun: string
  action: ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 className="type-heading-s">{title}</h2>
        <p className="mt-1 type-caption text-fg-2">
          {count} {noun}
          {count === 1 ? '' : 's'}
        </p>
      </div>
      {action}
    </div>
  )
}

type Run = (change: () => Promise<unknown>) => Promise<boolean>

function LinkSection({
  refs,
  project,
  onAdd,
  run
}: {
  refs: Reference[]
  project: string
  onAdd: (input: { url: string; note: string; tag: Tag }) => Promise<boolean>
  run: Run
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [tag, setTag] = useState<Tag>('inspiration')

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (await onAdd({ url, note, tag })) {
      setAdding(false)
      setUrl('')
      setNote('')
      setTag('inspiration')
    }
  }

  return (
    <section className="px-6 pt-10">
      <SectionHeader
        title="Reference links"
        count={refs.length}
        noun="reference"
        action={
          <button
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
            className={outlineButton}
          >
            <Icon name="add-line" />
            Add reference
          </button>
        }
      />

      {adding && (
        <form
          onSubmit={submit}
          className="stagger mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] items-start gap-3 border border-line bg-subtle p-4"
        >
          <input
            autoFocus
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link"
            aria-label="Link"
            className={`h-9 ${field}`}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What do you like about it?"
            aria-label="What I like about it"
            rows={1}
            className={`min-h-9 resize-y py-2 ${field}`}
          />
          <TagToggle value={tag} onChange={setTag} />
          <button type="submit" className={solidButton}>
            Save
          </button>
        </form>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-x-6 bg-subtle px-3 py-2.5 type-caption text-fg-2">
        <span>Reference and source</span>
        <span>What I like about it</span>
        <span className="w-[178px]">Use</span>
      </div>
      {refs.length === 0 && (
        <p className="border-b border-line px-3 py-6 type-body-s text-fg-2">
          Paste a link to anything that catches your eye, then say what you like about it.
        </p>
      )}
      <ul>
        {refs.map((r) => (
          <li
            key={r.id}
            className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-x-6 border-b border-line px-3 py-3"
          >
            <a
              href={r.source}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-3 type-body-s text-link hover:underline"
            >
              <LinkThumb url={r.source} />
              <span className="truncate">{r.source.replace(/^https?:\/\/(www\.)?/, '')}</span>
            </a>
            <NoteField
              key={r.note}
              value={r.note}
              onSave={(note) => run(() => window.api.updateReference(project, r.id, { note }))}
            />
            <RowEnd
              tag={r.tag}
              onTag={(tag) => run(() => window.api.updateReference(project, r.id, { tag }))}
              onRemove={() => run(() => window.api.removeReference(project, r.id))}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function FileSection({
  refs,
  project,
  run
}: {
  refs: Reference[]
  project: string
  run: Run
}): React.JSX.Element {
  const [over, setOver] = useState(false)

  function drop(e: DragEvent): void {
    e.preventDefault()
    setOver(false)
    const dropped = [...e.dataTransfer.files]
    if (dropped.length) void run(() => window.api.addFiles(project, dropped))
  }

  return (
    <section
      className="px-6 pt-12"
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={drop}
    >
      <SectionHeader
        title="Reference files"
        count={refs.length}
        noun="file"
        action={
          <button
            onClick={() => run(() => window.api.pickFiles(project))}
            className={outlineButton}
          >
            <Icon name="upload-2-line" />
            Upload files
          </button>
        }
      />
      <ul className="mt-4 flex flex-col gap-3">
        {refs.map((r) => (
          <li
            key={r.id}
            className="group grid grid-cols-[auto_minmax(0,0.8fr)_minmax(0,1.3fr)_auto] items-center gap-x-6 border border-line bg-subtle p-3"
          >
            <FileThumb project={project} file={r.source} />
            <div className="min-w-0">
              <p className="truncate type-label-m">{r.source}</p>
              <p className="mt-1 type-caption text-fg-2">
                {r.source.endsWith('.pdf') ? 'PDF' : 'Image'} · {bytes(r.size ?? 0)} · added{' '}
                {ago(r.added)}
              </p>
              <button
                onClick={() => run(() => window.api.openReferenceFile(project, r.source))}
                className="mt-1 type-caption text-link hover:underline"
              >
                Open
              </button>
            </div>
            <NoteField
              key={r.note}
              value={r.note}
              onSave={(note) => run(() => window.api.updateReference(project, r.id, { note }))}
            />
            <RowEnd
              tag={r.tag}
              onTag={(tag) => run(() => window.api.updateReference(project, r.id, { tag }))}
              onRemove={() => run(() => window.api.removeReference(project, r.id))}
            />
          </li>
        ))}
      </ul>
      <div
        className={`mt-3 border border-dashed px-4 py-5 transition-colors duration-150 ${over ? 'border-focus bg-brand-subtle' : 'border-line-strong bg-subtle'}`}
      >
        <p className="flex items-center gap-3 type-label-m">
          <Icon name="add-line" />
          {over ? 'Drop to add them' : 'Drop images or PDFs here'}
        </p>
        <p className="mt-1 pl-7 type-caption text-fg-2">
          PNG, JPG, GIF, WebP, SVG or PDF, up to 25 MB each. A copy is kept in the project.
        </p>
      </div>
    </section>
  )
}

function Interpretation({
  text,
  count,
  busy,
  onRun
}: {
  text: string | null
  count: number
  busy: boolean
  onRun: () => void
}): React.JSX.Element {
  return (
    <section className="px-6 pt-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h2 className="type-heading-s">Interpretation</h2>
          <p className="mt-1 type-caption text-fg-2">
            The Orchestrator reads every reference and your notes, then writes research.md.
          </p>
        </div>
        <button onClick={onRun} disabled={busy || count === 0} className={solidButton}>
          {busy ? 'Reading…' : text ? 'Interpret again' : 'Interpret references'}
        </button>
      </div>
      {busy && (
        <p className="mt-4 border-l-2 border-agent bg-agent-subtle px-3 py-2 type-body-s text-agent-fg">
          Orchestrator is reading {count} reference{count === 1 ? '' : 's'}. This can take a minute
          or two.
        </p>
      )}
      {text ? (
        <Markdown text={text} />
      ) : (
        !busy && (
          <p className="mt-4 border border-line px-4 py-6 type-body-s text-fg-2">
            {count === 0
              ? 'Add a few references and notes first.'
              : 'Nothing yet. Interpret once your references say what you want.'}
          </p>
        )
      )}
    </section>
  )
}

/** Note text that reads as plain copy until hovered or focused; saves on blur. */
function NoteField({
  value,
  onSave
}: {
  value: string
  onSave: (note: string) => Promise<boolean>
}): React.JSX.Element {
  // callers key this by the saved note, so a fresh save remounts it with the new value
  const [draft, setDraft] = useState(value)
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value) void onSave(draft)
      }}
      placeholder="What do you like about it?"
      aria-label="What I like about it"
      rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 60)))}
      className="w-full resize-none border border-transparent bg-transparent px-2 py-1.5 type-body-s outline-none transition-colors duration-150 placeholder:text-fg-2 hover:border-line focus:border-focus focus:bg-canvas"
    />
  )
}

function TagToggle({
  value,
  onChange
}: {
  value: Tag
  onChange: (t: Tag) => void
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Use" className="flex h-9 border border-line bg-canvas">
      {(
        [
          ['inspiration', 'Inspiration'],
          ['asset', 'Usable asset']
        ] as const
      ).map(([t, label]) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={`px-3 transition-colors duration-150 ${value === t ? 'bg-muted type-current-s' : 'type-label-s text-fg-2 hover:text-fg'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function RowEnd({
  tag,
  onTag,
  onRemove
}: {
  tag: Tag
  onTag: (t: Tag) => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <TagToggle value={tag} onChange={onTag} />
      <button
        onClick={() => {
          if (confirm('Remove this reference from the project?')) onRemove()
        }}
        aria-label="Remove reference"
        title="Remove"
        className="flex size-8 items-center justify-center text-fg-2 opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-danger-fg focus-visible:opacity-100"
      >
        <Icon name="close-line" />
      </button>
    </div>
  )
}

const IMAGE_URL = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i

function LinkThumb({ url }: { url: string }): React.JSX.Element {
  const host = new URL(url).hostname.replace(/^www\./, '')
  return (
    <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden border border-line bg-subtle">
      {IMAGE_URL.test(url) ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="font-display text-[26px] text-fg-2 italic">{host[0].toUpperCase()}</span>
      )}
    </span>
  )
}

function FileThumb({ project, file }: { project: string; file: string }): React.JSX.Element {
  return (
    <span className="flex h-16 w-22 items-center justify-center overflow-hidden border border-line bg-canvas">
      {file.endsWith('.pdf') ? (
        <span className="font-display text-[22px] text-fg-2 italic">PDF</span>
      ) : (
        <img
          src={`orchestra://ref/${project}/${encodeURIComponent(file)}`}
          alt=""
          className="size-full object-cover"
        />
      )}
    </span>
  )
}

interface Item {
  text: string
  sub: string[] // nested bullets
  more: string[] // indented paragraphs after the nested bullets
}

/** Just enough markdown for research.md: headings, (nested) lists, rules, paragraphs.
 * Built as React elements, never raw HTML, because the text can quote fetched web pages. */
export function Markdown({
  text,
  className = 'stagger mt-4 max-w-[760px] border border-line bg-canvas px-6 py-5'
}: {
  text: string
  className?: string // the box around it; research.md gets a framed sheet
}): React.JSX.Element {
  const out: React.JSX.Element[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: Item[] } | null = null

  const flushPara = (): void => {
    if (para.length)
      out.push(
        <p key={out.length} className="mt-3 type-body-s text-fg">
          {inline(para.join(' '))}
        </p>
      )
    para = []
  }
  const flushList = (): void => {
    if (!list) return
    const List = list.ordered ? 'ol' : 'ul'
    out.push(
      <List
        key={out.length}
        className={`mt-3 pl-5 type-body-s ${list.ordered ? 'list-decimal' : 'list-disc'}`}
      >
        {list.items.map((it, i) => (
          <li key={i} className="mt-1.5">
            {inline(it.text)}
            {it.sub.length > 0 && (
              <ul className="mt-1 list-[circle] pl-5">
                {it.sub.map((sub, j) => (
                  <li key={j} className="mt-1">
                    {inline(sub)}
                  </li>
                ))}
              </ul>
            )}
            {it.more.map((m, j) => (
              <p key={j} className="mt-1.5">
                {inline(m)}
              </p>
            ))}
          </li>
        ))}
      </List>
    )
    list = null
  }

  for (const raw of text.trim().split(/\r?\n/)) {
    const line = raw.trimEnd()
    const item = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line)
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (!line.trim()) {
      flushPara() // a blank line ends a paragraph; lists may continue past it
    } else if (heading) {
      flushPara()
      flushList()
      out.push(
        heading[1].length === 1 ? (
          <h3 key={out.length} className="type-heading-m">
            {heading[2]}
          </h3>
        ) : (
          <h4 key={out.length} className="mt-7 type-heading-xs">
            {heading[2]}
          </h4>
        )
      )
    } else if (/^\s*-{3,}\s*$/.test(line)) {
      flushPara()
      flushList()
      out.push(<hr key={out.length} className="mt-6 border-line" />)
    } else if (item) {
      flushPara()
      const ordered = /\d/.test(item[2])
      const last = list?.items.at(-1)
      if (item[1].length >= 2 && last) last.sub.push(item[3])
      else {
        if (!list || list.ordered !== ordered) {
          flushList()
          list = { ordered, items: [] }
        }
        list.items.push({ text: item[3], sub: [], more: [] })
      }
    } else if (list && /^\s/.test(raw)) {
      list.items.at(-1)!.more.push(line.trim())
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()

  return <div className={className}>{out}</div>
}

// **bold** and _italic_ / *italic*; everything else stays literal text
function inline(s: string): ReactNode[] {
  // `code` first, so underscores and asterisks inside a file name stay literal
  return s.split(/(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/).map((part, i) =>
    /^`.+`$/.test(part) ? (
      <code key={i} className="bg-subtle px-1 font-mono text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith('**') ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : /^[_*].+[_*]$/.test(part) ? (
      <em key={i} className="font-display text-[1.15em]">
        {part.slice(1, -1)}
      </em>
    ) : (
      part
    )
  )
}

function bytes(n: number): string {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`
}

function ago(iso: string): string {
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  if (Math.abs(mins) < 60 * 24) return rtf.format(Math.round(mins / 60), 'hour')
  return rtf.format(Math.round(mins / 60 / 24), 'day')
}
