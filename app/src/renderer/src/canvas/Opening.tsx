// C3 · Opening the book, 1.4s: the cover comes to the centre, swings all the way open on its
// spine, rests a beat, then fades into the book's artboard.
// Closing plays the same in reverse, back into the cover's place on the shelf.
import { useLayoutEffect, useRef } from 'react'
import { COVER, reducedMotion, type CoverInfo } from './shared'
import { CoverFace } from './Cover'

interface Props {
  info: CoverInfo
  shelf: DOMRect // where the cover sits on the shelf, on screen
  dir: 'open' | 'close'
  onSwap: () => void // swap the board underneath (Studio ⇄ Book) while the page fills the view
  onDone: () => void
}

export function Opening({ info, shelf, dir, onSwap, onDone }: Props): React.JSX.Element {
  const book = useRef<HTMLDivElement>(null)
  const front = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reducedMotion()) {
      // a crossfade only: the board swaps under a short fade
      onSwap()
      const t = setTimeout(onDone, 150)
      return () => clearTimeout(t)
    }
    const vw = innerWidth
    const vh = innerHeight
    const T = 1420
    const at = (ms: number): number => ms / T
    const ease = 'cubic-bezier(.2,.7,.2,1)'
    const s0 = shelf.height / COVER.h
    const s1 = Math.min((vh * 0.7) / COVER.h, (vw * 0.34) / COVER.w)
    const place = (cx: number, cy: number, s: number): string =>
      `translate(${cx - COVER.w / 2}px, ${cy - COVER.h / 2}px) scale(${s})`
    const shelfAt = place(shelf.x + shelf.width / 2, shelf.y + shelf.height / 2, s0)
    const closed = place(vw / 2, vh / 2, s1)
    // open, the spread is centred: the spine sits in the middle of the window
    const open = place(vw / 2 + (COVER.w * s1) / 2, vh / 2, s1)

    // 1. to the centre  2. swings all the way open  3. a breath  4. fades into the artboard
    const moves: Keyframe[] = [
      { offset: 0, transform: shelfAt, opacity: 1, easing: ease },
      { offset: at(380), transform: closed, opacity: 1, easing: ease },
      { offset: at(1020), transform: open, opacity: 1 },
      { offset: at(1140), transform: open, opacity: 1, easing: ease },
      { offset: 1, transform: open, opacity: 0 }
    ]
    const swing: Keyframe[] = [
      { offset: 0, transform: 'rotateY(0deg)' },
      { offset: at(380), transform: 'rotateY(0deg)', easing: ease },
      { offset: at(1020), transform: 'rotateY(-180deg)' },
      { offset: 1, transform: 'rotateY(-180deg)' }
    ]
    const opts: KeyframeAnimationOptions = {
      duration: T,
      fill: 'both',
      direction: dir === 'open' ? 'normal' : 'reverse'
    }
    const a = book.current!.animate(moves, opts)
    front.current!.animate(swing, opts)
    // opening swaps the board in behind the open book as it starts to fade; closing swaps at
    // once, under the book as it fades back in
    const swap = setTimeout(onSwap, dir === 'open' ? 1140 : 0)
    a.finished.then(onDone, () => {})
    return () => {
      clearTimeout(swap)
      a.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden>
      <div
        ref={book}
        className="absolute top-0 left-0 origin-center [perspective:2000px]"
        style={{ width: COVER.w, height: COVER.h }}
      >
        {/* the first page */}
        <div className="bg-dots absolute inset-0 border border-card-line shadow-book" />
        <div ref={front} className="absolute inset-0 origin-left [transform-style:preserve-3d]">
          <div className="absolute inset-0 shadow-book [backface-visibility:hidden]">
            <CoverFace info={info} />
          </div>
          {/* the inside of the cover, seen once it has swung past the spine */}
          <div className="absolute inset-0 flex flex-col justify-end border border-card-line bg-card p-6 text-link [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="type-label-mono">Orchestra presents</p>
            <p className="mt-1 type-heading-m">{info.name}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
