// A project's cover, generated from its name, client and art, like a concert programme
// (brand spec §5.4 Book/Cover, canvas spec §2.3).
import { Ascii } from '../components/Ascii'
import { AREAS, coverArt, coverColor, type Area, type CoverColor, type CoverInfo } from './shared'

const LOOK: Record<CoverColor, { face: string; spine: string; plate: string; dim: string }> = {
  blue: {
    face: 'bg-poster-dots text-on-brand',
    spine: 'bg-brand-pressed',
    plate: '',
    dim: 'text-poster-dim'
  },
  ink: {
    face: 'bg-terminal text-on-brand',
    spine: 'bg-white/15',
    plate: 'bg-brand',
    dim: 'text-white/70'
  },
  white: {
    face: 'bg-dots text-link border border-card-line',
    spine: 'bg-brand/15',
    plate: 'bg-brand',
    dim: 'text-dim'
  }
}

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
  const color = coverColor(info.id)
  const look = LOOK[color]
  const m = AREAS.find((a) => a.id === movement)
  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden py-6 pr-6 pl-[42px] ${look.face} ${className}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[18px] ${look.spine}`} />
      <div className="flex justify-between type-label-s">
        <span>Orchestra presents</span>
        <span>No. {String(info.no).padStart(2, '0')}</span>
      </div>
      <div className={`absolute top-[64px] right-6 size-[150px] text-white ${look.plate}`}>
        <Ascii name={coverArt(info.id)} fit="contain" className="absolute inset-2" />
      </div>
      <div className="mt-auto">
        <h3 className="type-heading-l [overflow-wrap:anywhere]">{info.name || 'Untitled'}</h3>
        {info.client && <p className={`mt-2 type-label-s ${look.dim}`}>{info.client}</p>}
        {m && (
          <span
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 type-label-s ${
              color === 'blue' ? 'bg-white text-link' : 'bg-brand text-on-brand'
            }`}
          >
            {m.numeral} {m.name}
            {playing && ' · playing'}
          </span>
        )}
        <div
          className={`mt-4 flex justify-between border-t pt-3 type-label-s whitespace-nowrap [font-stretch:100%] ${
            color === 'white' ? 'border-rule' : 'border-white/70'
          }`}
        >
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
