// A project's cover: its name and description over a backdrop, like a concert programme
// (brand spec §5.4 Book/Cover, canvas spec §2.3).
import { PLATES } from './Landscape'
import { AREAS, coverLandscape, type Area, type CoverInfo } from './shared'

/** The front of the book. `movement` is the area it was last left in, shown as a ribbon. */
export function CoverFace({
  info,
  movement,
  playing,
  className = ''
}: {
  info: CoverInfo
  movement?: Area
  playing?: boolean
  className?: string
}): React.JSX.Element {
  const m = AREAS.find((a) => a.id === movement)
  return (
    <div
      className={`cover-face relative isolate flex h-full w-full flex-col overflow-hidden bg-terminal py-6 pr-6 pl-[42px] text-on-brand ${className}`}
    >
      {/* Nocturne only: the same soft plates as the home screens, hidden under the v2 theme */}
      <span aria-hidden className="cover-landscape">
        <img src={PLATES[coverLandscape(info.id, info.cover?.landscape)]} alt="" />
      </span>
      <span aria-hidden className="cover-spine absolute inset-y-0 left-0 w-[18px] bg-white/15" />
      <div className="cover-meta flex justify-between type-label-s">
        <span>Orchestra presents</span>
        <span>No. {String(info.no).padStart(2, '0')}</span>
      </div>
      <div className="mt-auto">
        <h3 className="type-heading-l [overflow-wrap:anywhere]">{info.name || 'Untitled'}</h3>
        {info.concept && (
          <p className="mt-2 line-clamp-6 type-body-s text-white/70 [overflow-wrap:anywhere]">
            {info.concept}
          </p>
        )}
        {m && (
          <span className="mt-3 inline-flex rounded-full bg-brand px-2.5 py-1 type-label-s text-on-brand">
            {m.numeral} {m.name}
            {playing && ' · playing'}
          </span>
        )}
        <div className="cover-meta mt-4 flex justify-between border-t border-white/70 pt-3 type-label-s whitespace-nowrap [font-stretch:100%]">
          {AREAS.map((a) => (
            <span key={a.id}>
              {a.numeral} · {a.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
