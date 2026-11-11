// The blurred landscape behind the home screens (Studio, Setup, cover editor). Nocturne only:
// under the v2 theme the layer is hidden by CSS (assets/themes/nocturne.css).
import sunset from '../assets/landscapes/sunset.png'
import alpine from '../assets/landscapes/alpine.png'
import desert from '../assets/landscapes/desert.png'
import hills from '../assets/landscapes/hills.png'
import coast from '../assets/landscapes/coast.png'

// The plates are 720 × 450 with the blur baked in (a 28px CSS blur over the whole window was
// costly), so they are soft at any size.
const PLATES = { sunset, alpine, desert, hills, coast }

/** Put it first inside a wrapper with the class `on-landscape`; the board above goes clear. */
export function Landscape({ name }: { name: keyof typeof PLATES }): React.JSX.Element {
  return (
    <div aria-hidden className="landscape pointer-events-none absolute inset-0 overflow-hidden">
      <img src={PLATES[name]} alt="" className="size-full object-cover" />
    </div>
  )
}
