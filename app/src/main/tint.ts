// The colour of a reference library tile's text panel: the site's own brand colour, the one that
// stands out in its picture, darkened enough for light text. Pure, so it can be tested.

/** HSL from RGB in 0..255: hue in degrees, saturation and lightness in 0..1. */
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

/** From raw BGRA pixels (Electron's toBitmap), a CSS colour, or undefined when the picture
 * is mostly white, grey or black and has no brand colour to pick out. */
export function brandTint(bgra: Uint8Array): string | undefined {
  let r = 0
  let g = 0
  let b = 0
  let weight = 0
  const pixels = Math.floor(bgra.length / 4)
  for (let i = 0; i < pixels; i++) {
    const [B, G, R] = [bgra[i * 4], bgra[i * 4 + 1], bgra[i * 4 + 2]]
    // colourful pixels count most, so a bright accent beats a white page around it
    const chroma = (Math.max(R, G, B) - Math.min(R, G, B)) / 255
    r += R * chroma
    g += G * chroma
    b += B * chroma
    weight += chroma
  }
  if (!pixels || weight / pixels < 0.04) return undefined
  const [h, s] = hsl(r / weight, g / weight, b / weight)
  const hue = Math.round(h)
  const sat = Math.round(Math.min(0.7, Math.max(0.35, s)) * 100)
  return `hsl(${hue} ${sat}% 18% / 0.62)`
}
