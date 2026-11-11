// Opening a book: its cover lifts off the shelf, grows toward you and dissolves into the book's
// board, about half a second. Closing plays the same in reverse, back into the cover's place.
import { useLayoutEffect, useRef } from 'react'
import { COVER, reducedMotion, type CoverInfo } from './shared'
import { CoverFace } from './Cover'

interface Props {
  info: CoverInfo
  shelf: DOMRect // where the cover sits on the shelf, on screen
  dir: 'open' | 'close'
  onSwap: () => void // swap the board underneath (Studio ⇄ Book) while the cover fills the view
  onDone: () => void
}

const T = 560
// the board changes under the veil at its darkest: 40% of the way in, opening or closing
const SWAP = 0.4

export function Opening({ info, shelf, dir, onSwap, onDone }: Props): React.JSX.Element {
  const book = useRef<HTMLDivElement>(null)
  const veil = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reducedMotion()) {
      // a crossfade only: the board swaps under a short fade
      onSwap()
      const t = setTimeout(onDone, 150)
      return () => clearTimeout(t)
    }
    const vw = innerWidth
    const vh = innerHeight
    const ease = 'cubic-bezier(.2,.7,.2,1)'
    const s0 = shelf.height / COVER.h
    // far enough that the cover's face fills most of the window as it goes
    const s1 = Math.max(vw / COVER.w, vh / COVER.h) * 0.9
    const place = (cx: number, cy: number, s: number): string =>
      `translate(${cx - COVER.w / 2}px, ${cy - COVER.h / 2}px) scale(${s})`
    const moves: Keyframe[] = [
      {
        transform: place(shelf.x + shelf.width / 2, shelf.y + shelf.height / 2, s0),
        opacity: 1,
        filter: 'blur(0px)',
        easing: ease
      },
      { offset: 0.45, opacity: 0.9, filter: 'blur(2px)', easing: ease },
      { transform: place(vw / 2, vh / 2, s1), opacity: 0, filter: 'blur(14px)' }
    ]
    // a soft dark veil rises and falls with it, so the board swap underneath never flashes
    const dim: Keyframe[] = [{ opacity: 0 }, { offset: 0.4, opacity: 1 }, { opacity: 0 }]
    const opts: KeyframeAnimationOptions = {
      duration: T,
      fill: 'both',
      direction: dir === 'open' ? 'normal' : 'reverse'
    }
    const a = book.current!.animate(moves, opts)
    veil.current!.animate(dim, opts)
    const swap = setTimeout(onSwap, T * (dir === 'open' ? SWAP : 1 - SWAP))
    a.finished.then(onDone, () => {})
    return () => {
      clearTimeout(swap)
      a.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      <div ref={veil} className="absolute inset-0 bg-overlay/70 opacity-0" />
      <div
        ref={book}
        className="absolute top-0 left-0 origin-center overflow-hidden rounded-lg shadow-lift"
        style={{ width: COVER.w, height: COVER.h }}
      >
        <CoverFace info={info} />
      </div>
    </div>
  )
}
