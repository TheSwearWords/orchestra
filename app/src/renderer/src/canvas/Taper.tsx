/** The concave fillet where a tab or notch runs into the edge it hangs from: a square with a
 * quarter circle cut out of it. `solid` names the corner that stays filled. Its colour is the
 * current text colour, so give it the same colour as the piece it belongs to. */
export function Taper({
  solid,
  size = 10,
  className = ''
}: {
  solid: 'bl' | 'br' | 'tl' | 'tr'
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 10 10"
      className={`pointer-events-none absolute ${className}`}
      style={{ scale: `${solid[1] === 'r' ? -1 : 1} ${solid[0] === 't' ? -1 : 1}` }}
    >
      <path d="M0 0A10 10 0 0 0 10 10H0Z" fill="currentColor" />
      <path
        d="M0 0A10 10 0 0 0 10 10"
        fill="none"
        stroke="var(--color-border-default)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
