// C3 · Opening the book, 700ms in three beats (brand spec §6): the cover grows to the centre,
// swings open on its spine, then the camera pushes through the first page into the book.
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
    const s0 = shelf.height / COVER.h
    const s1 = Math.min((vh * 0.82) / COVER.h, (vw * 0.5) / COVER.w)
    const place = (cx: number, cy: number, s: number): string =>
      `translate(${cx - COVER.w / 2}px, ${cy - COVER.h / 2}px) scale(${s})`
    const shelfAt = place(shelf.x + shelf.width / 2, shelf.y + shelf.height / 2, s0)
    const centre = place(vw / 2, vh / 2, s1)
    // the push lands on the page's centre, so the book appears to come out of it
    const through = place(vw / 2 - COVER.w * s1 * 0.6, vh / 2, s1 * 3.2)

    const ease = 'cubic-bezier(.2,.7,.2,1)'
    const moves: Keyframe[] = [
      { offset: 0, transform: shelfAt, opacity: 1 },
      { offset: 200 / 700, transform: centre, opacity: 1 },
      { offset: 500 / 700, transform: centre, opacity: 1 },
      { offset: 1, transform: through, opacity: 0 }
    ]
    const swing: Keyframe[] = [
      { offset: 0, transform: 'rotateY(0deg)' },
      { offset: 200 / 700, transform: 'rotateY(0deg)' },
      { offset: 500 / 700, transform: 'rotateY(-160deg)' },
      { offset: 1, transform: 'rotateY(-160deg)' }
    ]
    const opts: KeyframeAnimationOptions = {
      duration: 700,
      easing: ease,
      fill: 'both',
      direction: dir === 'open' ? 'normal' : 'reverse'
    }
    const a = book.current!.animate(moves, opts)
    front.current!.animate(swing, opts)
    // opening swaps once the page fills the view; closing swaps right away, under the page
    const swap = setTimeout(onSwap, dir === 'open' ? 500 : 0)
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
        <div
          ref={front}
          className="absolute inset-0 origin-left shadow-book [backface-visibility:hidden]"
        >
          <CoverFace info={info} />
        </div>
      </div>
    </div>
  )
}
