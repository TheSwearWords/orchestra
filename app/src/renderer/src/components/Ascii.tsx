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
  // Scale the figure to fill its box's height (cropping the left edge) or its width.
  fit: 'height' | 'width'
  className?: string // positions and colors the box
}

/** Fills its box with a figure, anchored bottom-right. Decorative only. */
export function Ascii({ name, fit, className = '' }: Props): React.JSX.Element {
  const lines = art[`../assets/ascii/${name}.txt`].replace(/\s+$/, '').split('\n')
  const cols = Math.max(...lines.map((l) => l.trimEnd().length))
  // container query units: the font size follows the box, with no measuring in JS
  const fontSize = fit === 'height' ? `${100 / lines.length}cqh` : `${100 / (cols * ADVANCE)}cqw`
  return (
    <div
      aria-hidden
      className={`pointer-events-none overflow-hidden select-none ${className}`}
      style={{ containerType: 'size' }}
    >
      <pre className="absolute right-0 bottom-0 m-0 font-mono" style={{ fontSize, lineHeight: 1 }}>
        {lines.map((l) => l.trimEnd().padEnd(cols)).join('\n')}
      </pre>
    </div>
  )
}
