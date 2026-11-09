import { useEffect } from 'react'
import type { Ask } from '../../../preload'

const loaded = new Set<string>()
/** Fetches a Google font once. One that isn't there falls back to an installed font of that name. */
function loadFont(family: string): void {
  if (loaded.has(family)) return
  loaded.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`
  document.head.append(link)
}

/** What an option in the Action box shows: the colours, the typeface or the picture itself. */
export function OptionPreview({
  project,
  option: o
}: {
  project: string
  option: Ask['options'][number]
}): React.JSX.Element {
  const { font, image, colors } = o
  useEffect(() => {
    if (font) loadFont(font)
  }, [font])
  return (
    <>
      {image && (
        <img
          alt=""
          src={
            image.startsWith('https:')
              ? image
              : `orchestra://file/${project}/${encodeURIComponent(image)}`
          }
          className="aspect-[16/10] w-full object-cover"
        />
      )}
      {colors && (
        <span className="flex h-10 w-full">
          {colors.map((c, i) => (
            <span key={i} className="flex-1" style={{ background: c }} title={c} />
          ))}
        </span>
      )}
      {font && (
        <span className="block text-[32px] leading-tight" style={{ fontFamily: `'${font}'` }}>
          {o.sample ?? o.label}
        </span>
      )}
    </>
  )
}
