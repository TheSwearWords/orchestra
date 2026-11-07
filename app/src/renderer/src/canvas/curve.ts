// The curve a wire takes between two points (brand spec §5.3 Board/Wire): it leaves and
// arrives along whichever way the two ends are further apart, so wires bend, never kink.

/** An SVG path from (x1, y1) to (x2, y2) as one smooth cubic curve. */
export function curve(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const r = (n: number): number => Math.round(n * 10) / 10
  if (Math.abs(dy) >= Math.abs(dx)) {
    const k = dy / 2
    return `M${r(x1)},${r(y1)} C${r(x1)},${r(y1 + k)} ${r(x2)},${r(y2 - k)} ${r(x2)},${r(y2)}`
  }
  const k = dx / 2
  return `M${r(x1)},${r(y1)} C${r(x1 + k)},${r(y1)} ${r(x2 - k)},${r(y2)} ${r(x2)},${r(y2)}`
}
