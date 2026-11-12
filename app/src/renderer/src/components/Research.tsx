import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import type { Kind, Reference, ResearchState, Tag } from '../../../preload'
import { Board, type CardSpec } from '../canvas/Board'
import type { Frame } from '../canvas/Book'
import { popMenu, type MenuItem } from '../canvas/shared'
import { useToolbar } from '../canvas/toolbar'
import { DOC_BODY } from '../canvas/stage'
import { Port } from '../canvas/Port'
import { Icon } from './Icon'

const field =
  'w-full border border-line bg-canvas px-3 type-body-s outline-none placeholder:text-fg-2 focus:border-focus'
const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const host = (url: string): string => new URL(url).hostname.replace(/^www\./, '')

/** A reference's group: null is the project's default one. */
type Group = string | null

const FULL: Kind[] = ['links', 'inspiration', 'assets']
const KIND_LIST: Kind[] = [...FULL, 'text']
const LABEL: Record<Kind, string> = {
  links: 'Reference links',
  inspiration: 'Inspiration',
  assets: 'Usable assets',
  text: 'Text'
}
// a full group's windows, side by side
const SLOT: Record<Kind, { x: number; w: number }> = {
  links: { x: 0, w: 432 },
  inspiration: { x: 504, w: 576 },
  assets: { x: 1152, w: 432 },
  text: { x: 0, w: 480 }
}
// the tools under the Orchestrator bar; their actions come from the board
const TOOL_IDS = ['group', 'links', 'inspiration', 'assets', 'text', 'interpret'] as const
const TOOL_META: Record<(typeof TOOL_IDS)[number], { label: string; icon: string }> = {
  group: { label: 'Research group', icon: 'layout-grid-line' },
  links: { label: 'Reference links window', icon: 'global-line' },
  inspiration: { label: 'Inspiration window', icon: 'image-line' },
  assets: { label: 'Usable assets window', icon: 'box-3-line' },
  text: { label: 'Text window', icon: 'file-text-line' },
  interpret: { label: 'Interpret box', icon: 'pen-nib-line' }
}
const SHOW_TAGS_FROM = 8 // sites in the library before the tag filter earns its place

/** I · Research as one artboard (C4): groups of references, each holding reference links,
 * inspiration and usable assets and named for the part of the project it's about; the sites
 * to look further, wired to the links that came from them; and the interpretation they feed. */
export function Research({ project, frame }: { project: string; frame: Frame }): React.JSX.Element {
  const [data, setData] = useState<ResearchState | null>(null)
  const [error, setError] = useState('')
  const [interpreting, setInterpreting] = useState<string | null>(null) // the box at work
  const [spawn, setSpawn] = useState<{
    at?: { x: number; y: number }
    windows: { id: string; dx: number; dy: number }[]
  }>()
  // pictures of any sites that don't have one yet; a slow job, so it happens in the background
  const missing = data?.sites.filter((s) => !s.shot).length ?? 0
  useEffect(() => {
    if (frame.preview || missing === 0) return
    let live = true
    void window.api.captureSites().then((made) => {
      if (made && live) void window.api.loadResearch(project).then(setData)
    })
    return () => {
      live = false
    }
  }, [missing, project, frame.preview])

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

  async function interpret(box: string): Promise<void> {
    setInterpreting(box)
    await run(() => window.api.interpret(project, box))
    setInterpreting(null)
  }

  const windowId = (g: Group, k: Kind): string => `w-${g ?? ''}-${k}`
  type At = { x: number; y: number } | undefined
  /** A new full group, or with `kind` a single window, where you right-clicked. */
  const create = (name: string, at: At, kind?: Kind): void =>
    void run(async () => {
      const made = await window.api.addGroup(project, name, kind ? [kind] : undefined)
      const g = made.others[made.others.length - 1]
      setSpawn({
        at,
        windows: (kind ? [kind] : FULL).map((k) => ({
          id: windowId(g, k),
          dx: kind ? 0 : SLOT[k].x,
          dy: 0
        }))
      })
    })
  const newBox = (at: At): void =>
    void run(async () => {
      const boxes = await window.api.addBox(project)
      const id = boxes[boxes.length - 1].id
      setSpawn({
        at,
        windows: [
          { id: `interpret-${id}`, dx: 0, dy: 0 },
          { id: `direction-${id}`, dx: 624, dy: 0 }
        ]
      })
    })
  // the same choices as the right-click menu, as tools under the Orchestrator bar, offered while
  // this board is open (not in the book's small previews); none of them needs the loaded data
  useToolbar(
    TOOL_IDS.map((id) => ({
      ...TOOL_META[id],
      id,
      run: () =>
        id === 'group'
          ? create('New research group', undefined)
          : id === 'interpret'
            ? newBox(undefined)
            : create(LABEL[id], undefined, id)
    })),
    !frame.preview
  )

  if (!data) return <div className="bg-dots h-full" />
  const links = data.references.filter((r) => r.kind === 'link')
  // the project's own group stays off the board until something is filed in it, so a new
  // board opens with just the library, the Interpret box and research.md
  const defaultUsed = data.references.some((r) => (r.group ?? null) === null)
  const groups: Group[] = [...(defaultUsed ? [null] : []), ...data.groups.others]
  // groups an Interpret box can read, the empty default one included
  const readable: Group[] = [null, ...data.groups.others]
  const defaultName = data.groups.default ?? `${frame.name} research`
  const nameOf = (g: Group): string => g ?? defaultName
  const kindsOf = (g: Group): Kind[] => (g && data.groups.kinds[g]) || FULL
  const addItems = (at?: At): MenuItem[] => [
    { label: 'New research group', run: () => create('New research group', at) },
    { label: '', separator: true },
    ...KIND_LIST.map((k) => ({
      label: `New ${LABEL[k].toLowerCase()} window`,
      run: () => create(LABEL[k], at, k)
    })),
    { label: '', separator: true },
    { label: 'New Interpret box', run: () => newBox(at) }
  ]
  const hosts = new Set(data.sites.map((s) => host(s.url)))
  /** Right-click or the "Group" button on a reference: where else it can be filed. */
  const moveMenu = (r: Reference): void => {
    const here: Group = r.group ?? null
    const kind: Kind = r.kind === 'link' ? 'links' : r.tag === 'asset' ? 'assets' : 'inspiration'
    const items: MenuItem[] = groups
      .filter((g) => g !== here && kindsOf(g).includes(kind))
      .map((g) => ({
        label: `Move to ${nameOf(g)}`,
        run: () => void run(() => window.api.updateReference(project, r.id, { group: g }))
      }))
    void popMenu(items.length ? items : [{ label: 'Make another group to move this to' }])
  }

  return (
    <Board
      project={project}
      board="research"
      label="I · Research"
      pages={frame.pages}
      preview={frame.preview}
      wires={[
        ...links
          .filter((l) => hosts.has(host(l.source)))
          .map((l) => ({ from: `link-${l.id}`, to: `site-${host(l.source)}` })),
        ...data.boxes.flatMap((b) =>
          b.groups.map((g) => ({
            from: `group-${g}`,
            to: `box-${b.id}`,
            solid: true,
            onCut: () => void run(() => window.api.connectBox(project, b.id, g, false))
          }))
        )
      ]}
      onPick={(from, to) =>
        void run(() =>
          window.api.connectBox(project, to.replace(/^box-/, ''), from.replace(/^group-/, ''), true)
        )
      }
      spawn={spawn}
      onSpawned={() => setSpawn(undefined)}
      frames={groups
        .filter((g) => kindsOf(g).length > 1)
        .map((g) => ({
          id: g ?? '',
          name: nameOf(g),
          members: kindsOf(g).map((k) => windowId(g, k)),
          port: `group-${g ?? ''}`,
          onRename: (name) => void run(() => window.api.renameGroup(project, g, name)),
          onMenu:
            g === null
              ? undefined
              : () =>
                  void popMenu([
                    {
                      label: 'Delete group',
                      run: () => {
                        if (confirm(`Delete "${g}"? Its references move to ${defaultName}.`))
                          void run(() => window.api.removeGroup(project, g))
                      }
                    }
                  ])
        }))}
      addMenu={(at) => addItems(at)}
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
        ...groups.flatMap((g, i): CardSpec[] => {
          const inGroup = data.references.filter((r) => (r.group ?? null) === g)
          const kinds = kindsOf(g)
          const alone = kinds.length === 1
          const refs: Record<Kind, Reference[]> = {
            links: inGroup.filter((r) => r.kind === 'link'),
            inspiration: inGroup.filter((r) => r.kind === 'file' && r.tag === 'inspiration'),
            assets: inGroup.filter((r) => r.kind === 'file' && r.tag === 'asset'),
            text: inGroup.filter((r) => r.kind === 'text')
          }
          return kinds.map((k) => {
            const inner =
              k === 'links' ? (
                <Links project={project} group={g} refs={refs.links} run={run} onMove={moveMenu} />
              ) : k === 'text' ? (
                <TextWindow
                  value={refs.text[0]?.note ?? ''}
                  onSave={(text) => run(() => window.api.saveText(project, g!, text))}
                />
              ) : (
                <Tiles
                  project={project}
                  group={g}
                  refs={refs[k]}
                  tag={k === 'assets' ? 'asset' : 'inspiration'}
                  run={run}
                  onMove={moveMenu}
                />
              )
            return {
              id: windowId(g, k),
              kind: 'reference' as const,
              title: alone ? nameOf(g) : LABEL[k],
              count: k === 'text' ? undefined : String(refs[k].length),
              x: alone ? 0 : SLOT[k].x,
              y: i * 960,
              w: alone ? 480 : SLOT[k].w,
              ...(alone
                ? {
                    onRename: (name: string) =>
                      void run(() => window.api.renameGroup(project, g, name)),
                    menu: [
                      {
                        label: 'Delete window',
                        run: () => {
                          if (confirm(`Delete "${nameOf(g)}"?`))
                            void run(() => window.api.removeGroup(project, g!))
                        }
                      }
                    ]
                  }
                : {}),
              body: alone ? (
                <div className="relative">
                  <Port
                    out={`group-${g ?? ''}`}
                    side="right"
                    hint="Drag to an Interpret box to connect"
                  />
                  {inner}
                </div>
              ) : (
                inner
              )
            }
          })
        }),
        ...data.boxes.flatMap((b, i): CardSpec[] => [
          {
            id: `interpret-${b.id}`,
            kind: 'process',
            title: b.name,
            x: 1680,
            y: i * 720,
            w: 480,
            tone: 'blue',
            onRename: (name) => void run(() => window.api.renameBox(project, b.id, name)),
            menu:
              b.id === 'main'
                ? undefined
                : [
                    {
                      label: 'Delete box',
                      run: () => void run(() => window.api.removeBox(project, b.id))
                    }
                  ],
            body: (
              <InterpretBoxBody
                port={`box-${b.id}`}
                groups={readable.map((g) => ({
                  key: g ?? '',
                  name: nameOf(g),
                  count: data.references.filter((r) => (r.group ?? null) === g).length
                }))}
                wired={b.groups}
                written={!!b.text}
                busy={interpreting === b.id}
                blocked={interpreting !== null && interpreting !== b.id}
                onRun={() => void interpret(b.id)}
              />
            )
          },
          {
            id: `direction-${b.id}`,
            kind: 'file',
            title: b.id === 'main' ? 'research.md' : `research/${b.id}.md`,
            count: b.text ? undefined : 'not written yet',
            x: 2304,
            y: i * 720,
            w: 672,
            tone: 'paper',
            link: `interpret-${b.id}`,
            body: <Interpretation text={b.text} />
          }
        ]),
        {
          id: 'sites',
          kind: 'reference',
          title: 'Reference library',
          count: String(data.sites.length),
          x: -1640,
          y: 0,
          w: 1490, // two columns of 720px pictures, the size they're captured at
          body: (
            <Sites
              sites={data.sites}
              onAdd={(site) => run(() => window.api.addSite(site))}
              onRemove={(url) => run(() => window.api.removeSite(url))}
            />
          )
        }
      ]}
    />
  )
}

/** A window of the user's own words, read by Interpret like any other reference: wire it to an
 * Interpret box from the dot on its right. */
function TextWindow({
  value,
  onSave
}: {
  value: string
  onSave: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [text, setText] = useState(value)
  return (
    <div className="p-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value.trim() && void onSave(text)}
        placeholder="Describe what you're after: a mood, a reference, how it should feel."
        aria-label="Your own words"
        className="field-sizing-content min-h-40 w-full resize-none border border-card-line bg-transparent p-3 type-body-m text-link outline-none placeholder:text-placeholder focus:border-focus"
      />
    </div>
  )
}

/** A stack of link blocks (Board/Link block), with a field to paste the next one. */
function Links({
  project,
  group,
  refs,
  run,
  onMove
}: {
  project: string
  group: Group
  refs: Reference[]
  run: Run
  onMove: (r: Reference) => void
}): React.JSX.Element {
  const [url, setUrl] = useState('')

  async function add(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!url.trim()) return
    const added = await run(async () => {
      const r = await window.api.addLink(project, { url, note: '', tag: 'inspiration' })
      if (group !== null) await window.api.updateReference(project, r.id, { group })
    })
    if (added) setUrl('')
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {refs.map((r) => {
        const shown = r.source.replace(/^https?:\/\/(www\.)?/, '')
        return (
          <div
            key={r.id}
            data-port={`link-${r.id}`}
            onContextMenu={(e) => {
              e.preventDefault()
              onMove(r)
            }}
            className="group flex gap-3 rounded-xl border border-hair bg-[var(--color-glass-fill)] p-3"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-glass-fill-strong)] font-display text-[20px] leading-none text-fg italic">
              {shown[0]?.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <a
                href={r.source}
                target="_blank"
                rel="noreferrer"
                title={r.source}
                className="block truncate type-body-m-strong text-link hover:underline"
              >
                {shown}
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
                aria-label={`Open ${shown}`}
                className="flex size-7 items-center justify-center rounded-full bg-[var(--color-glass-fill)] text-link hover:bg-[var(--color-glass-fill-strong)]"
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
          className="w-full rounded-xl border border-dashed border-wire bg-transparent px-3 py-2.5 font-mono text-[12px] text-link outline-none placeholder:text-dim focus:border-solid focus:border-brand"
        />
      </form>
    </div>
  )
}

/** Image tiles (Board/Tile) for one use: Inspiration or Usable assets. Drop files on the card
 * to add them here; a tile moves to the other card with its "Move" button. */
function Tiles({
  project,
  group,
  refs,
  tag,
  run,
  onMove
}: {
  project: string
  group: Group
  refs: Reference[]
  tag: Tag
  run: Run
  onMove: (r: Reference) => void
}): React.JSX.Element {
  const [over, setOver] = useState(false)
  const other: Tag = tag === 'asset' ? 'inspiration' : 'asset'

  async function adopt(added: Reference[]): Promise<void> {
    // new files arrive as inspiration and ungrouped; they're filed where they were dropped
    if (tag === 'asset' || group !== null)
      await Promise.all(
        added.map((r) =>
          window.api.updateReference(project, r.id, {
            tag,
            ...(group !== null ? { group } : {})
          })
        )
      )
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
        <figure
          key={r.id}
          onContextMenu={(e) => {
            e.preventDefault()
            onMove(r)
          }}
          className="group m-0 flex flex-col border border-card-line"
        >
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

/** The reference library: the sites worth looking through, each a tile with what it's for;
 * your own can be added. */
function Sites({
  sites,
  onAdd,
  onRemove
}: {
  sites: ResearchState['sites']
  onAdd: (site: { name: string; url: string; about: string; tags: string[] }) => Promise<boolean>
  onRemove: (url: string) => Promise<boolean>
}): React.JSX.Element {
  // the × on a site: kept inside the link's box, so it must not follow the link
  const remove = (e: React.MouseEvent, s: { name: string; url: string }): void => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Remove ${s.name} from the reference library?`)) void onRemove(s.url)
  }
  const removeButton = (s: { name: string; url: string }, size: number): React.ReactNode => (
    <button
      type="button"
      onClick={(e) => remove(e, s)}
      aria-label={`Remove ${s.name} from the library`}
      title="Remove from the library"
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-dim opacity-0 group-hover:opacity-100 hover:bg-[var(--color-glass-fill-strong)] hover:text-danger-fg focus-visible:opacity-100"
    >
      <Icon name="close-line" size={size} />
    </button>
  )
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagText, setTagText] = useState('')
  const allTags = [...new Set(sites.flatMap((s) => s.tags ?? []))].sort()
  const showTags = sites.length >= SHOW_TAGS_FROM && allTags.length > 0
  // compact: one dense row per site, no screenshots; remembered between sessions
  const [compact, setCompactState] = useState(() => localStorage.getItem('library-compact') === '1')
  const setCompact = (on: boolean): void => {
    setCompactState(on)
    try {
      localStorage.setItem('library-compact', on ? '1' : '0')
    } catch {
      // the library works the same without it
    }
  }
  const shown = showTags && tagFilter ? sites.filter((s) => s.tags?.includes(tagFilter)) : sites
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [about, setAbout] = useState('')

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const tags = tagText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (await onAdd({ name, url, about, tags })) {
      setTagText('')
      setAdding(false)
      setName('')
      setUrl('')
      setAbout('')
    }
  }

  return (
    <div className={`grid p-4 ${compact ? 'grid-cols-1 gap-1' : 'grid-cols-2 gap-3'}`}>
      <div className="col-span-full flex flex-wrap items-center gap-1.5">
        {showTags &&
          [null, ...allTags].map((t) => (
            <button
              key={t ?? 'all'}
              aria-pressed={tagFilter === t}
              onClick={() => setTagFilter(t)}
              className={`serif-on rounded-full border px-3 py-1 type-label-s ${
                tagFilter === t
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-card-line text-link hover:bg-selected'
              }`}
            >
              {t ?? 'All'}
            </button>
          ))}
        <button
          onClick={() => setCompact(!compact)}
          aria-pressed={compact}
          title={compact ? 'Show screenshots' : 'Compact list'}
          className="ml-auto flex h-7 items-center gap-1.5 rounded-full border border-hair bg-[var(--color-glass-fill)] px-3 type-label-s text-link hover:bg-[var(--color-glass-fill-strong)]"
        >
          <Icon name="layout-grid-line" size={13} />
          {compact ? 'Cards' : 'Compact'}
        </button>
      </div>
      {shown.map((s) =>
        compact ? (
          <a
            key={s.url}
            data-port={`site-${host(s.url)}`}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={s.about ? `${s.url}\n${s.about}` : s.url}
            className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-link transition-colors duration-150 hover:bg-[var(--color-glass-fill-strong)]"
          >
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-glass-fill-strong)] font-display text-[12px] leading-none text-fg italic"
            >
              {s.name[0]}
            </span>
            <span className="min-w-0 shrink-0 truncate type-body-s font-medium">{s.name}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-dim">
              {s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </span>
            <Icon
              name="arrow-right-up-line"
              size={14}
              className="shrink-0 text-link/40 group-hover:text-link"
            />
            {removeButton(s, 13)}
          </a>
        ) : (
          <a
            key={s.url}
            data-port={`site-${host(s.url)}`}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            title={s.url}
            className="group flex flex-col gap-3 rounded-xl border border-hair bg-[var(--color-glass-fill)] p-2 text-link transition-colors duration-150 hover:border-line-strong hover:bg-[var(--color-glass-fill-strong)]"
          >
            {s.shot && (
              <img
                alt=""
                src={`orchestra://site/${host(s.url)}.png`}
                className="aspect-video w-full rounded-lg object-cover object-top"
              />
            )}
            <span className="flex flex-col gap-1.5 px-2 pb-2">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-glass-fill-strong)] font-display text-[14px] leading-none text-fg italic"
                >
                  {s.name[0]}
                </span>
                <span className="min-w-0 flex-1 truncate type-heading-m">{s.name}</span>
                <Icon
                  name="arrow-right-up-line"
                  size={16}
                  className="shrink-0 text-link/50 group-hover:text-link"
                />
                {removeButton(s, 14)}
              </span>
              <span className="truncate font-mono text-[11px] text-dim">
                {s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </span>
              {s.about && <span className="type-body-s text-fg">{s.about}</span>}
              {s.tags && s.tags.length > 0 && (
                <span className="flex flex-wrap gap-1 pt-0.5">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[var(--color-glass-fill)] px-2 py-0.5 type-caption text-dim"
                    >
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </a>
        )
      )}
      {adding ? (
        <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-brand p-4">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Site name"
            className={`h-9 ${field}`}
          />
          <input
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="godly.website"
            aria-label="Site address"
            className={`h-9 ${field}`}
          />
          <input
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="What it's good for"
            aria-label="What the site is for"
            className={`h-9 ${field}`}
          />
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="Tags, with commas"
            aria-label="Tags for the site"
            className={`h-9 ${field}`}
          />
          <span className="flex gap-2">
            <button type="submit" className={solidButton}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-2 type-label-m text-dim"
            >
              Cancel
            </button>
          </span>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-wire text-link hover:bg-selected"
        >
          <span className="font-mono text-xl text-link/50">+</span>
          <span className="serif-on type-label-m">Add a site</span>
          <span className="type-caption text-dim">One you keep going back to</span>
        </button>
      )}
    </div>
  )
}

type Run = (change: () => Promise<unknown>) => Promise<boolean>

/** The blue card: what Interpret will read, and the button. */
function InterpretBoxBody({
  port,
  groups,
  wired,
  written,
  busy,
  blocked,
  onRun
}: {
  port: string
  groups: { key: string; name: string; count: number }[]
  wired: string[]
  written: boolean
  busy: boolean
  blocked: boolean // another box is reading; one runs at a time
  onRun: () => void
}): React.JSX.Element {
  const connected = groups.filter((g) => wired.includes(g.key))
  const total = connected.reduce((n, g) => n + g.count, 0)
  return (
    <div data-port={port} data-in={port} className="relative flex flex-col gap-4 px-5 pt-1 pb-5">
      <Port side="left" />
      <div>
        <p className="type-heading-m">
          {busy
            ? 'Reading…'
            : total === 0
              ? 'Connect a group'
              : written
                ? 'Interpreted'
                : 'Ready to interpret'}
        </p>
        <p className="mt-1 font-mono text-[12px] text-poster-dim">
          {busy
            ? `Reading ${total} reference${total === 1 ? '' : 's'}. A minute or two.`
            : `${total} reference${total === 1 ? '' : 's'} connected`}
        </p>
      </div>
      {connected.length > 0 ? (
        <ul className="flex flex-col gap-0.5 font-mono text-[12px]">
          {connected.map((g) => (
            <li key={g.key}>{g.name}</li>
          ))}
        </ul>
      ) : (
        <p className="type-body-s text-poster-dim">
          Drag from the dot on a group to this box to connect it.
        </p>
      )}
      <button
        onClick={onRun}
        disabled={busy || blocked || total === 0}
        className="serif-on h-11 self-start bg-white px-5 type-label-m text-link hover:bg-inverse hover:text-on-brand disabled:opacity-50"
      >
        {written ? 'Interpret again' : 'Interpret'}
      </button>
    </div>
  )
}

/** research.md on paper (Board/Paper card): its direction and themes, as written. */
function Interpretation({ text }: { text: string | null }): React.JSX.Element {
  return (
    <div className="overflow-y-auto p-6" style={{ maxHeight: DOC_BODY }}>
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
      // Enter locks the note in; Shift+Enter starts a new line
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      placeholder="What do you like about it?"
      aria-label="What I like about it"
      rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 60)))}
      className="w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 type-body-s outline-none transition-colors duration-150 placeholder:text-fg-2 hover:border-line focus:border-focus focus:bg-[var(--color-glass-fill)]"
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
