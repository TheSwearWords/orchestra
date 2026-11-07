import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import type { Reference, ResearchState, Tag } from '../../../preload'
import { Board } from '../canvas/Board'
import type { Frame } from '../canvas/Book'
import { Icon } from './Icon'

const field =
  'w-full border border-line bg-canvas px-3 type-body-s outline-none placeholder:text-fg-2 focus:border-focus'
const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

/** I · Research as one artboard (C4): reference links, inspiration and usable assets as
 * cards, the sites to look further, and the interpretation they feed. */
export function Research({ project, frame }: { project: string; frame: Frame }): React.JSX.Element {
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

  if (!data) return <div className="bg-dots h-full" />
  const links = data.references.filter((r) => r.kind === 'link')
  const files = data.references.filter((r) => r.kind === 'file')
  const inspiration = files.filter((r) => r.tag === 'inspiration')
  const assets = files.filter((r) => r.tag === 'asset')
  const tiles = (refs: Reference[], tag: Tag): React.ReactNode => (
    <Tiles project={project} refs={refs} tag={tag} run={run} />
  )

  return (
    <Board
      project={project}
      board="research"
      label="I · Research"
      crumbs={frame.crumbs}
      pages={frame.pages}
      preview={frame.preview}
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
      cards={[
        {
          id: 'links',
          title: 'Reference links',
          count: String(links.length),
          x: 0,
          y: 0,
          w: 432,
          body: <Links project={project} refs={links} run={run} />
        },
        {
          id: 'inspiration',
          title: 'Inspiration',
          count: String(inspiration.length),
          x: 480,
          y: 0,
          w: 576,
          body: tiles(inspiration, 'inspiration')
        },
        {
          id: 'assets',
          title: 'Usable assets',
          count: String(assets.length),
          x: 1104,
          y: 0,
          w: 432,
          body: tiles(assets, 'asset')
        },
        {
          id: 'interpretation',
          title: 'research.md',
          count: data.interpretation ? undefined : 'not written yet',
          x: 1584,
          y: 0,
          w: 672,
          tone: 'paper',
          body: <Interpretation text={data.interpretation} />
        },
        {
          id: 'sites',
          title: 'Look further',
          count: String(data.sites.length),
          x: 0,
          y: 720,
          w: 432,
          body: <Sites sites={data.sites} onAdd={(site) => run(() => window.api.addSite(site))} />
        },
        {
          id: 'interpret',
          title: 'Interpret',
          x: 480,
          y: 720,
          w: 576,
          tone: 'blue',
          body: (
            <Ready
              links={links.length}
              inspiration={inspiration.length}
              assets={assets.length}
              written={!!data.interpretation}
              busy={interpreting}
              onRun={interpret}
            />
          )
        }
      ]}
    />
  )
}

/** A stack of link blocks (Board/Link block), with a field to paste the next one. */
function Links({
  project,
  refs,
  run
}: {
  project: string
  refs: Reference[]
  run: Run
}): React.JSX.Element {
  const [url, setUrl] = useState('')

  async function add(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!url.trim()) return
    if (await run(() => window.api.addLink(project, { url, note: '', tag: 'inspiration' })))
      setUrl('')
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {refs.map((r) => {
        const host = r.source.replace(/^https?:\/\/(www\.)?/, '')
        return (
          <div key={r.id} className="group flex gap-3 border border-card-line p-3">
            <span className="flex size-[46px] shrink-0 items-center justify-center bg-brand font-display text-[24px] font-extrabold text-on-brand italic">
              {host[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={r.source}
                target="_blank"
                rel="noreferrer"
                title={r.source}
                className="block truncate type-body-m-strong text-link hover:underline"
              >
                {host}
              </a>
              <NoteField
                key={r.note}
                value={r.note}
                onSave={(note) => run(() => window.api.updateReference(project, r.id, { note }))}
              />
            </div>
            <div className="flex flex-col items-center gap-1">
              <a
                href={r.source}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${host}`}
                className="flex size-7 items-center justify-center bg-brand/15 text-link hover:bg-brand hover:text-on-brand"
              >
                <Icon name="arrow-right-up-line" size={14} />
              </a>
              <Remove onRemove={() => run(() => window.api.removeReference(project, r.id))} />
            </div>
          </div>
        )
      })}
      <form onSubmit={add}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a link, then Enter"
          aria-label="Add a reference link"
          className="w-full border border-dashed border-wire bg-transparent px-3 py-2.5 font-mono text-[12px] text-link outline-none placeholder:text-dim focus:border-solid focus:border-brand"
        />
      </form>
    </div>
  )
}

/** Image tiles (Board/Tile) for one use: Inspiration or Usable assets. Drop files on the card
 * to add them here; a tile moves to the other card with its "Move" button. */
function Tiles({
  project,
  refs,
  tag,
  run
}: {
  project: string
  refs: Reference[]
  tag: Tag
  run: Run
}): React.JSX.Element {
  const [over, setOver] = useState(false)
  const other: Tag = tag === 'asset' ? 'inspiration' : 'asset'

  async function adopt(added: Reference[]): Promise<void> {
    // new files arrive as inspiration; ones dropped on Usable assets are retagged straight away
    if (tag === 'asset')
      await Promise.all(added.map((r) => window.api.updateReference(project, r.id, { tag })))
  }
  function drop(e: DragEvent): void {
    e.preventDefault()
    setOver(false)
    const dropped = [...e.dataTransfer.files]
    if (dropped.length) void run(async () => adopt(await window.api.addFiles(project, dropped)))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={drop}
      className={`grid grid-cols-2 gap-3 p-4 transition-colors duration-150 ${over ? 'bg-selected' : ''}`}
    >
      {refs.map((r) => (
        <figure key={r.id} className="group m-0 flex flex-col border border-card-line">
          <button
            onClick={() => run(() => window.api.openReferenceFile(project, r.source))}
            title={`Open ${r.source}`}
            className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-brand"
          >
            {r.source.endsWith('.pdf') ? (
              <span className="font-display text-[28px] font-extrabold text-on-brand italic">
                PDF
              </span>
            ) : (
              <img
                src={`orchestra://ref/${project}/${encodeURIComponent(r.source)}`}
                alt=""
                className="size-full object-cover mix-blend-screen grayscale"
              />
            )}
          </button>
          <figcaption className="flex flex-col px-2.5 pt-2 pb-1">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate type-label-s text-link" title={r.source}>
                {r.source}
              </span>
              <button
                onClick={() => run(() => window.api.updateReference(project, r.id, { tag: other }))}
                title={`Move to ${other === 'asset' ? 'Usable assets' : 'Inspiration'}`}
                className="type-caption text-dim opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-link focus-visible:opacity-100"
              >
                Move
              </button>
              <Remove onRemove={() => run(() => window.api.removeReference(project, r.id))} />
            </span>
            <NoteField
              key={r.note}
              value={r.note}
              onSave={(note) => run(() => window.api.updateReference(project, r.id, { note }))}
            />
          </figcaption>
        </figure>
      ))}
      <button
        onClick={() => run(async () => adopt(await window.api.pickFiles(project)))}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-1 border border-dashed border-wire text-link hover:bg-selected"
      >
        <span className="font-mono text-xl text-link/50">+</span>
        <span className="serif-on type-label-s">
          {over ? 'Drop to add' : 'Drop files or browse'}
        </span>
        <span className="type-caption text-dim">Images or PDFs, up to 25 MB</span>
      </button>
    </div>
  )
}

function Remove({ onRemove }: { onRemove: () => void }): React.JSX.Element {
  return (
    <button
      onClick={() => {
        if (confirm('Remove this reference from the project?')) onRemove()
      }}
      aria-label="Remove reference"
      title="Remove"
      className="flex size-7 items-center justify-center text-dim opacity-0 transition-[opacity,color] duration-150 group-hover:opacity-100 hover:text-danger-fg focus-visible:opacity-100"
    >
      <Icon name="close-line" size={14} />
    </button>
  )
}

/** The sites to look further, as chips; one more can be added. */
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

  const chipStyle =
    'flex items-center gap-1.5 rounded-full border border-card-line px-3 py-1 type-label-s text-link transition-colors duration-150 hover:bg-brand hover:text-on-brand'
  return (
    <div className="p-4">
      <ul className="flex flex-wrap gap-2">
        {sites.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer" title={s.url} className={chipStyle}>
              {s.name}
              <Icon name="arrow-right-up-line" size={12} />
            </a>
          </li>
        ))}
        <li>
          <button
            onClick={() => setAdding(!adding)}
            aria-expanded={adding}
            className={`${chipStyle} border-dashed`}
          >
            <Icon name="add-line" size={12} />
            Add site
          </button>
        </li>
      </ul>
      {adding && (
        <form onSubmit={submit} className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Site name"
            className={`h-9 max-w-32 ${field}`}
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
            Save
          </button>
        </form>
      )}
    </div>
  )
}

type Run = (change: () => Promise<unknown>) => Promise<boolean>

/** The blue card: what Interpret will read, and the button. */
function Ready({
  links,
  inspiration,
  assets,
  written,
  busy,
  onRun
}: {
  links: number
  inspiration: number
  assets: number
  written: boolean
  busy: boolean
  onRun: () => void
}): React.JSX.Element {
  const total = links + inspiration + assets
  return (
    <div className="flex items-center gap-5 px-5 pt-1 pb-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-link">
        <Icon name="logo-mark" size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-heading-m">
          {busy
            ? 'Reading…'
            : total === 0
              ? 'Add references first'
              : written
                ? 'Interpreted'
                : 'Ready to interpret'}
        </p>
        <p className="mt-1 font-mono text-[12px] text-poster-dim">
          {busy
            ? `The Orchestrator is reading ${total} reference${total === 1 ? '' : 's'}. A minute or two.`
            : `${links} links · ${inspiration} inspiration · ${assets} assets`}
        </p>
      </div>
      <button
        onClick={onRun}
        disabled={busy || total === 0}
        className="serif-on h-11 shrink-0 bg-white px-5 type-label-m text-link hover:bg-inverse hover:text-on-brand disabled:opacity-50"
      >
        {written ? 'Interpret again' : 'Interpret'}
      </button>
    </div>
  )
}

/** research.md on paper (Board/Paper card): its direction and themes, as written. */
function Interpretation({ text }: { text: string | null }): React.JSX.Element {
  return (
    <div className="p-6">
      {text ? (
        <Markdown text={text} />
      ) : (
        <>
          <h3 className="type-heading-xl text-link">Direction</h3>
          <p className="mt-3 type-body-m text-dim">
            Not written yet. Interpret writes research.md from your links, inspiration and assets,
            and every Musician reads it as its brief.
          </p>
        </>
      )}
    </div>
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
