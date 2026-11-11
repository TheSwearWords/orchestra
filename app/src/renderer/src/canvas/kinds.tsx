// What a window is, readable at a glance and from far away. Agents share one blue header, with a
// tab on the left showing their rank. Files are paper with a page mark. Finished work is
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

// every agent looks the same; the tab on the left says which rank it is
const AGENT = {
  frame: 'border border-agent/50 bg-card',
  header: 'border-b border-hair bg-agent-subtle text-fg',
  rank: true
}

export const KIND: Record<
  CardKind,
  { tag: string; frame?: string; header?: string; title?: string; rank?: boolean }
> = {
  orchestrator: { tag: 'Orchestrator', ...AGENT },
  musician: { tag: 'Musician', ...AGENT },
  instrument: { tag: 'Instrument', ...AGENT },
  file: {
    tag: 'Markdown',
    frame: 'paper border border-transparent',
    header: 'border-b border-hair text-link',
    title: 'font-mono text-[13px]'
  },
  deliverable: {
    tag: 'Deliverable',
    frame: 'border border-inverse/55 bg-raised',
    header: 'border-b border-hair text-fg'
  },
  decision: {
    tag: 'Decision',
    frame: 'border border-needs-you/60 bg-card',
    header: 'border-b border-hair text-fg'
  },
  reference: { tag: 'References' },
  process: { tag: 'Interpret' }
}

/** The shape beside a window's title: round for agents, the rest each their own. */
export function KindMark({ kind }: { kind: CardKind }): React.JSX.Element {
  switch (kind) {
    case 'orchestrator':
      return <Icon name="logo-mark" size={16} />
    case 'musician':
      return (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="shrink-0"
        >
          <circle cx="5.2" cy="10.8" r="3.4" />
          <circle cx="8" cy="8" r="2.3" />
          <path d="M8.4 7.6l5-5 .9.9-5 5z" />
        </svg>
      )
    case 'instrument':
      return (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="shrink-0"
        >
          <circle cx="5" cy="12.2" r="2.3" />
          <path d="M6.3 2.5h1.4v9.7H6.3zM7.7 2.5h5.3v2.6H7.7z" />
        </svg>
      )
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
