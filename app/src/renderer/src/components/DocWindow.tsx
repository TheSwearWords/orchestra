import { useEffect, useState } from 'react'
import { DOC_BODY } from '../canvas/stage'
import { Markdown } from './Research'

/** A markdown file the project made, read on the board. `stamp` changes when the file does. */
export function DocWindow({
  project,
  path,
  stamp
}: {
  project: string
  path: string
  stamp?: string // the file's modified time; none means it isn't written yet
}): React.JSX.Element {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!stamp) return
    let live = true
    window.api.readOutput(project, path).then(
      (t) => live && setText(t),
      () => live && setText(null)
    )
    return () => {
      live = false
    }
  }, [project, path, stamp])
  return (
    <div className="min-h-32 overflow-y-auto p-5" style={{ maxHeight: DOC_BODY }}>
      {text === null ? (
        <p className="type-body-s text-dim">{stamp ? 'Opening…' : 'Being written…'}</p>
      ) : (
        <Markdown text={text} />
      )}
    </div>
  )
}
