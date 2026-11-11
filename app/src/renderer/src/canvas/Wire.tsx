import { curve } from './curve'

/** A dashed wire between two points, drawn inside a board's <svg>; solid once what it joins is
 * connected. Pointing at it makes it bold so you can trace where it goes; a wide clear stroke
 * makes it easy to hit. */
export function Wire({
  x1,
  y1,
  x2,
  y2,
  tone = 'wire',
  dim,
  solid,
  onCut
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  tone?: 'wire' | 'needs-you'
  dim?: boolean
  solid?: boolean
  onCut?: () => void // click the wire to disconnect it
}): React.JSX.Element {
  const d = curve(x1, y1, x2, y2)
  return (
    <g className={`group transition-opacity duration-200 ${dim ? 'opacity-15' : ''}`}>
      <path
        d={d}
        onClick={onCut}
        className={`fill-none stroke-transparent [pointer-events:stroke] [stroke-width:14] ${onCut ? 'cursor-pointer' : ''}`}
      >
        {onCut && <title>Click to disconnect</title>}
      </path>
      <path
        d={d}
        className={`pointer-events-none fill-none [stroke-width:2] transition-[stroke-width] duration-150 group-hover:[stroke-width:3] ${
          solid ? '' : '[stroke-dasharray:5_5]'
        } ${
          tone === 'needs-you'
            ? 'stroke-needs-you'
            : solid
              ? 'stroke-brand'
              : 'stroke-wire group-hover:stroke-brand'
        }`}
      />
    </g>
  )
}
