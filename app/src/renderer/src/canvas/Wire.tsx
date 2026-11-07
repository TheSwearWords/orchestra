import { curve } from './curve'

/** A dashed wire between two points, drawn inside a board's <svg>. Pointing at it makes it
 * bold so you can trace where it goes; a wide clear stroke makes it easy to hit. */
export function Wire({
  x1,
  y1,
  x2,
  y2,
  tone = 'wire',
  dim
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  tone?: 'wire' | 'needs-you'
  dim?: boolean
}): React.JSX.Element {
  const d = curve(x1, y1, x2, y2)
  return (
    <g className={`group transition-opacity duration-200 ${dim ? 'opacity-15' : ''}`}>
      <path
        d={d}
        className="fill-none stroke-transparent [pointer-events:stroke] [stroke-width:14]"
      />
      <path
        d={d}
        className={`pointer-events-none fill-none [stroke-dasharray:5_5] [stroke-width:1.4] transition-[stroke-width] duration-150 group-hover:[stroke-width:3] ${
          tone === 'needs-you' ? 'stroke-needs-you' : 'stroke-wire group-hover:stroke-brand'
        }`}
      />
    </g>
  )
}
