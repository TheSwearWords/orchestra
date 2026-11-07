// The Knowledge graph window on the Studio desk: Graphify's graph of your work, for people.
// Not the whole tangle: what keeps coming up, its clusters, and one thing at a time to trace,
// with what links to it around it. Every project together, or one.
import { useEffect, useState } from 'react'
import type { Project } from '../../../preload'
import { Icon } from '../components/Icon'
import { label, neighbourhood, search, summarize, type Graph } from './graphview'
import { ring } from './stage'
import { Wire } from './Wire'

type Status = 'none' | 'building' | 'ready'
const VIEW = { w: 656, h: 440, r: 168 }
const short = (s: string, n = 24): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function Knowledge({ projects }: { projects: Project[] }): React.JSX.Element {
  const [scope, setScope] = useState<string | null>(null) // null: every project
  const [graph, setGraph] = useState<Graph | null | undefined>(undefined) // undefined: loading
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [center, setCenter] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let live = true
    const load = (): void => {
      void window.api.loadGraph(scope).then(
        (g) => live && setGraph((g as Graph | null) ?? null),
        () => live && setGraph(null)
      )
      void Promise.all(
        projects.map(async (p) => [p.id, await window.api.graphStatus(p.id)] as const)
      ).then((all) => live && setStatus(Object.fromEntries(all)))
    }
    load()
    // builds run in the background; look again now and then while the window is open
    const t = setInterval(load, 20_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [scope, projects])

  const building = Object.values(status).some((s) => s === 'building')
  const chip = (on: boolean): string =>
    `flex items-center gap-1.5 border px-2.5 py-1 type-label-s ${on ? 'border-brand bg-brand text-on-brand' : 'border-card-line text-link hover:bg-selected'}`
  const dot = (s: Status | undefined): string =>
    s === 'ready' ? 'bg-success' : s === 'building' ? 'bg-needs-you' : 'border border-wire'

  return (
    <div className="flex flex-col">
      {/* which graph: every project's, or one */}
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-5 py-3">
        <button className={chip(scope === null)} onClick={() => setScope(null)}>
          All projects
        </button>
        {projects.map((p) => (
          <button key={p.id} className={chip(scope === p.id)} onClick={() => setScope(p.id)}>
            <span className={`size-2 rounded-full ${dot(status[p.id])}`} />
            {p.name}
          </button>
        ))}
        <span className="flex-1" />
        <button
          onClick={() => {
            void window.api.buildGraph(scope)
            setStatus((all) =>
              Object.fromEntries(
                Object.entries(all).map(([id, s]) => [id, !scope || id === scope ? 'building' : s])
              )
            )
          }}
          disabled={building}
          title="Graphify reads the project folders with Claude, on your plan. The first build takes a few minutes; later ones only redo what changed."
          className="border border-chip-line px-2.5 py-1 type-label-s text-link hover:bg-selected disabled:opacity-50"
        >
          {building ? 'Building…' : scope ? 'Build this graph' : 'Build graphs'}
        </button>
      </div>

      {graph === undefined ? (
        <p className="p-5 type-body-s text-dim">Loading the graph…</p>
      ) : graph === null || graph.nodes.length === 0 ? (
        <div className="p-5">
          <p className="type-heading-m text-link">No graph yet</p>
          <p className="mt-2 type-body-s text-dim">
            Graphify builds one from each project&apos;s notes, research and files, in the
            background after you Interpret or work with the Orchestrator. Or build it now.
          </p>
        </div>
      ) : (
        <Body
          key={scope ?? 'all'}
          graph={graph}
          center={center}
          onCenter={setCenter}
          q={q}
          onQ={setQ}
        />
      )}
    </div>
  )
}

function Body({
  graph,
  center,
  onCenter,
  q,
  onQ
}: {
  graph: Graph
  center: string | null
  onCenter: (id: string) => void
  q: string
  onQ: (q: string) => void
}): React.JSX.Element {
  const { hubs, clusters } = summarize(graph, 10)
  const focus = center && graph.nodes.some((n) => n.id === center) ? center : hubs[0]?.id
  const hood = focus ? neighbourhood(graph, focus) : null
  const found = search(graph, q)
  const spots = ring(hood?.around.length ?? 0, VIEW.w / 2, VIEW.h / 2, VIEW.r)
  const biggest = clusters[0]?.size ?? 1

  return (
    <>
      <section className="border-b border-hair px-5 py-4">
        <p className="type-caption text-dim">
          {graph.nodes.length} things · {graph.links.length} links · {clusters.length} clusters
        </p>
        <h3 className="mt-3 type-label-mono text-link">What keeps coming up</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {hubs.map((h) => (
            <button
              key={h.id}
              onClick={() => onCenter(h.id)}
              title={`${h.degree} links`}
              className={`rounded-full border px-3 py-1 type-label-s ${h.id === focus ? 'border-brand bg-brand text-on-brand' : 'border-card-line text-link hover:bg-selected'}`}
            >
              {short(h.label, 32)} <span className="opacity-60">{h.degree}</span>
            </button>
          ))}
        </div>
        <h3 className="mt-4 type-label-mono text-link">Clusters</h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {clusters.slice(0, 8).map((c) => (
            <li key={c.name} className="flex items-center gap-3">
              <span className="w-56 truncate type-body-s text-fg">{c.name}</span>
              <span
                className="h-2 bg-brand/30"
                style={{ width: `${(c.size / biggest) * 260}px` }}
              />
              <span className="type-caption text-dim">{c.size}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* trace one thing: it in the middle, what links to it around */}
      <section className="px-5 py-4">
        <div className="flex items-center gap-3">
          <h3 className="type-label-mono text-link">Trace</h3>
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => onQ(e.target.value)}
              placeholder="Find a typeface, a reference, a decision…"
              aria-label="Find something in the graph"
              className="w-full border-0 border-b-2 border-brand bg-transparent py-1 type-body-s text-link outline-none placeholder:text-placeholder focus-visible:outline-none"
            />
            {found.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 border border-chip-line bg-card p-1 shadow-lift">
                {found.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => {
                        onCenter(n.id)
                        onQ('')
                      }}
                      className="flex w-full justify-between gap-3 px-2.5 py-1.5 text-left hover:bg-selected"
                    >
                      <span className="truncate type-body-s text-link">{label(n)}</span>
                      <span className="shrink-0 type-caption text-dim">
                        {n.community_name ?? ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {hood?.center && (
          <>
            <svg
              viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
              width={VIEW.w}
              height={VIEW.h}
              className="mt-3 block max-w-full"
              role="img"
              aria-label={`${label(hood.center)} and what links to it`}
            >
              {hood.around.map((a, i) => (
                <Wire
                  key={a.node.id}
                  x1={VIEW.w / 2}
                  y1={VIEW.h / 2}
                  x2={spots[i].x}
                  y2={spots[i].y}
                />
              ))}
              {hood.around.map((a, i) => (
                <g
                  key={a.node.id}
                  onClick={() => onCenter(a.node.id)}
                  className="cursor-pointer [&:hover_circle]:fill-brand"
                >
                  <title>{`${label(a.node)}${a.relation ? ` · ${a.relation.replace(/_/g, ' ')}` : ''}`}</title>
                  <circle
                    cx={spots[i].x}
                    cy={spots[i].y}
                    r={7}
                    className="fill-card stroke-brand [stroke-width:1.5]"
                  />
                  <text
                    x={spots[i].x}
                    y={spots[i].y + (spots[i].y > VIEW.h / 2 ? 22 : -14)}
                    textAnchor="middle"
                    className="fill-link font-mono text-[11px]"
                  >
                    {short(label(a.node))}
                  </text>
                </g>
              ))}
              <rect
                x={VIEW.w / 2 - 9}
                y={VIEW.h / 2 - 9}
                width={18}
                height={18}
                className="fill-brand"
              />
            </svg>
            <div className="mt-2 flex items-start gap-3 border-t border-hair pt-3">
              <span className="mt-1 size-3 shrink-0 bg-brand" />
              <div className="min-w-0">
                <p className="type-heading-m text-link">{label(hood.center)}</p>
                <p className="mt-1 type-caption text-dim">
                  {[
                    hood.center.community_name,
                    hood.center.source_file,
                    `${hood.around.length + hood.more} links`
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {hood.more > 0 && (
                  <p className="mt-1 type-caption text-dim">
                    Showing the {hood.around.length} best connected; {hood.more} more link here.
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 type-caption text-dim">
                  <Icon name="search-line" size={12} />
                  Click anything around it to move there.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  )
}
