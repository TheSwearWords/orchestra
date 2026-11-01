// Icons are the exact Remix SVGs exported from Figma, drawn as a CSS mask so
// their color comes from the current text color (tokens) instead of the baked fill.
const urls = import.meta.glob('../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const byName: Record<string, string> = Object.fromEntries(
  Object.entries(urls).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url])
)

export type IconName =
  | 'add-line'
  | 'arrow-left-double-line'
  | 'arrow-right-double-line'
  | 'arrow-right-up-line'
  | 'check-line'
  | 'close-line'
  | 'folder-line'
  | 'layout-column-line'
  | 'logo-mark'
  | 'phase-create'
  | 'phase-refine'
  | 'phase-research'
  | 'search-line'
  | 'settings-3-line'
  | 'team-line'
  | 'upload-2-line'
  | 'user-line'
  | 'wordmark'

interface Props {
  // any bundled icon; names from data files (like a deliverable's icon) may be unknown and fall
  // back to a generic shape
  name: IconName | (string & {})
  size?: number
  width?: number // for non-square marks such as the phase columns; defaults to size
  className?: string
}

export function Icon({ name, size = 16, width = size, className = '' }: Props): React.JSX.Element {
  // quoted: small SVGs are inlined as data: URIs, which contain characters that break bare url()
  const url = `url("${byName[name] ?? byName['shapes-line']}")`
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%'
      }}
    />
  )
}
