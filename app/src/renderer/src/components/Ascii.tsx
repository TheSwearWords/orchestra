// The brand's word-built ASCII figures (assets/ascii, made from agent-log words).
const art = import.meta.glob('../assets/ascii/*.txt', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

export type AsciiName = 'apollo' | 'concert' | 'hand' | 'violin'

const ADVANCE = 0.6 // IBM Plex Mono character width, in em

interface Props {
  name: AsciiName
  // Scale the figure to fill its box's height (cropping the left edge) or its width, both
  // anchored bottom-right; to fit entirely inside the box, centered; or to fill the height
  // standing on the bottom edge, centered, cropping the sides of wider figures.
  fit: 'height' | 'width' | 'contain' | 'stand'
  className?: string // positions and colors the box
}

/** Fills its box with a figure. Decorative only. */
export function Ascii({ name, fit, className = '' }: Props): React.JSX.Element {
  const lines = art[`../assets/ascii/${name}.txt`].replace(/\s+$/, '').split('\n')
  const cols = Math.max(...lines.map((l) => l.trimEnd().length))
  // container query units: the font size follows the box, with no measuring in JS
  const byHeight = `${100 / lines.length}cqh`
  const byWidth = `${100 / (cols * ADVANCE)}cqw`
  const fontSize =
    fit === 'width' ? byWidth : fit === 'contain' ? `min(${byHeight}, ${byWidth})` : byHeight
  const place = {
    height: 'right-0 bottom-0',
    width: 'right-0 bottom-0',
    contain: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    stand: 'bottom-0 left-1/2 -translate-x-1/2'
  }[fit]
  return (
    <div
      aria-hidden
      className={`pointer-events-none overflow-hidden select-none ${className}`}
      style={{ containerType: 'size' }}
    >
      <pre className={`absolute m-0 font-mono ${place}`} style={{ fontSize, lineHeight: 1 }}>
        {lines.map((l) => l.trimEnd().padEnd(cols)).join('\n')}
      </pre>
    </div>
  )
}
