// A side notch at the window's edge that goes to the neighbouring area. It replaces the
// full-height page strips, so the board keeps its whole width.
import { Icon } from '../components/Icon'
import { Taper } from './Taper'
import { MODE_ICON } from './tabList'
import type { Area } from './shared'

export function EdgeTab({
  side,
  to,
  name,
  onGo
}: {
  side: 'left' | 'right'
  to: Area | null // null: the whole book
  name: string
  onGo: (a: Area | null) => void
}): React.JSX.Element {
  const left = side === 'left'
  const chevron = <Icon name={left ? 'arrow-left-s-line' : 'arrow-right-s-line'} size={14} />
  const icon = <Icon name={MODE_ICON[to ?? 'book']} size={16} />
  return (
    <button
      onClick={() => onGo(to)}
      aria-label={`Go to ${name}`}
      title={name}
      className={`glass absolute top-1/2 z-10 flex min-h-[140px] w-9 -translate-y-1/2 flex-col items-center justify-center gap-3 border border-chip-line bg-chip py-4 text-dim transition-colors duration-200 ease-(--ease) hover:text-fg ${
        left ? 'left-0 rounded-r-[14px] border-l-0' : 'right-0 rounded-l-[14px] border-r-0'
      }`}
    >
      <Taper
        solid={left ? 'bl' : 'br'}
        className={`-top-2.5 text-chip ${left ? 'left-0' : 'right-0'}`}
      />
      <Taper
        solid={left ? 'tl' : 'tr'}
        className={`-bottom-2.5 text-chip ${left ? 'left-0' : 'right-0'}`}
      />
      {left ? chevron : null}
      {left ? icon : null}
      <span
        className={`type-body-s font-medium [writing-mode:vertical-rl] ${left ? 'rotate-180' : ''}`}
      >
        {name}
      </span>
      {left ? null : icon}
      {left ? null : chevron}
    </button>
  )
}
