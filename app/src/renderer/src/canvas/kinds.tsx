// What a window is, readable at a glance and from far away. Agents are blue with round marks,
// getting quieter down the chain of command. Files are paper with a page mark. Finished work is
// ink. Decisions wait in a heavy ink frame with a diamond. Each also says its kind in words.
import { Icon } from '../components/Icon'

export type CardKind =
  | 'orchestrator'
  | 'musician'
  | 'instrument'
  | 'file'
  | 'deliverable'
  | 'decision'
  | 'reference'
  | 'process'

export const KIND: Record<
  CardKind,
  { tag: string; frame?: string; header?: string; title?: string }
> = {
  orchestrator: {
    tag: 'Orchestrator',
    frame: 'border-2 border-brand bg-card',
    header: 'bg-brand text-on-brand'
  },
  musician: {
    tag: 'Musician',
    frame: 'border-2 border-brand/50 bg-card',
    header: 'border-b border-brand/30 bg-brand/15 text-link'
  },
  instrument: {
    tag: 'Instrument',
    frame: 'border border-brand/40 bg-card',
    header: 'border-b border-hair text-link'
  },
  file: {
    tag: 'Markdown',
    frame: 'border border-inverse/40 bg-card',
    header: 'bg-dots border-b border-inverse/20 text-link',
    title: 'font-mono text-[13px]'
  },
  deliverable: {
    tag: 'Deliverable',
    frame: 'border-2 border-inverse bg-card',
    header: 'bg-inverse text-on-brand'
  },
  decision: {
    tag: 'Decision',
    frame: 'border-2 border-inverse bg-card',
    header: 'border-b-2 border-inverse text-link'
  },
  reference: { tag: 'References' },
  process: { tag: 'Interpret' }
}

/** The shape beside a window's title: round for agents, the rest each their own. */
export function KindMark({ kind }: { kind: CardKind }): React.JSX.Element {
  const ring = 'shrink-0 rounded-full border-current'
  switch (kind) {
    case 'orchestrator':
      return <Icon name="logo-mark" size={16} />
    case 'musician':
      return <span aria-hidden className={`${ring} size-3.5 border-[3px]`} />
    case 'instrument':
      return <span aria-hidden className={`${ring} size-2.5 border-[1.5px]`} />
    case 'file':
      return (
        <svg aria-hidden width="12" height="14" viewBox="0 0 12 14" className="shrink-0">
          <path
            d="M1 1h6.5L11 4.5V13H1zM7.5 1v3.5H11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
      )
    case 'deliverable':
      return <Icon name="arrow-right-up-line" size={15} />
    case 'decision':
      return <span aria-hidden className="size-2.5 shrink-0 rotate-45 bg-current" />
    case 'reference':
      return <span aria-hidden className="size-3 shrink-0 border-[1.5px] border-current" />
    case 'process':
      return (
        <span aria-hidden className="shrink-0 font-mono text-[13px] leading-none">
          ▸
        </span>
      )
  }
}
