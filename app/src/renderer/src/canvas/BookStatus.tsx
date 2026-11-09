import { useEffect, useState } from 'react'

interface Status {
  references: number
  interpreted: number
  boxes: number
  deliverables: number
  files: number
  working: number
}

/** Inside an opened cover: how the project stands, read when the book is opened. */
export function BookStatus({ project }: { project: string }): React.JSX.Element {
  const [s, setS] = useState<Status | null>(null)
  useEffect(() => {
    let live = true
    void Promise.all([
      window.api.loadResearch(project),
      window.api.loadCreate(project),
      window.api.listOutputs(project),
      window.api.agentStates(project)
    ]).then(
      ([r, c, o, a]) =>
        live &&
        setS({
          references: r.references.length,
          interpreted: r.boxes.filter((b) => b.text).length,
          boxes: r.boxes.length,
          deliverables: c.selected.length,
          files: o.filter((f) => !/^research(\.md$|\/)/.test(f.path)).length,
          working: Object.values(a).filter((x) => x.status === 'working').length
        }),
      () => {}
    )
    return () => {
      live = false
    }
  }, [project])
  const row = (k: string, v: string): React.JSX.Element => (
    <div className="flex flex-col items-end">
      <dt className="font-mono text-[11px] text-dim">{k}</dt>
      <dd className="type-body-s text-link">{v}</dd>
    </div>
  )
  return (
    <dl className="mb-auto flex w-[150px] flex-col gap-2.5">
      {s && (
        <>
          {row('Research', `${s.references} reference${s.references === 1 ? '' : 's'}`)}
          {row('Interpreted', `${s.interpreted} of ${s.boxes}`)}
          {row('Deliverables', String(s.deliverables))}
          {row('Files made', String(s.files))}
          {row('Agents', s.working ? `${s.working} working` : 'Idle')}
        </>
      )}
    </dl>
  )
}
