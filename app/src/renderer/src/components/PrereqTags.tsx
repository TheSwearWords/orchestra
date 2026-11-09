// The prerequisites on the wire into a deliverable. All green, and the Orchestrator can reach it.
export function PrereqTags({
  items,
  onOpen
}: {
  items: { id: string; name: string; ready: boolean }[]
  onOpen: (id: string) => void
}): React.JSX.Element {
  return (
    <ul className="flex w-max max-w-[320px] flex-wrap justify-center gap-1.5">
      {items.map((f) => (
        <li key={f.id}>
          <button
            onDoubleClick={() => onOpen(f.id)}
            title={`${f.name}: ${f.ready ? 'ready' : 'still to make'}. Double-click to open.`}
            className={`block h-7 px-2.5 type-label-s whitespace-nowrap transition-colors duration-200 ${
              f.ready
                ? 'bg-success-subtle text-success-fg'
                : 'border border-brand bg-card text-link'
            }`}
          >
            {f.ready && '✓ '}
            {f.name}
          </button>
        </li>
      ))}
    </ul>
  )
}
