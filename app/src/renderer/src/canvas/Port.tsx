/** A node's dot on the edge of a window. With `out`, drag from it to pull a wire. */
export function Port({
  out,
  side,
  hint = 'Drag to connect'
}: {
  out?: string
  side: 'left' | 'right'
  hint?: string
}): React.JSX.Element {
  return (
    <span
      data-out={out}
      data-port={out}
      title={out ? hint : undefined}
      className={`absolute top-1/2 z-10 size-4 -translate-y-1/2 rounded-full border-2 border-brand bg-card ${
        side === 'right' ? '-right-2' : '-left-2'
      } ${out ? 'cursor-crosshair hover:bg-brand' : ''}`}
    />
  )
}
