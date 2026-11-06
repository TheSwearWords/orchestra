// Pure camera maths for the canvas: no DOM, so it is shared and tested in node.
// A camera is the world point at the viewport's top-left (x, y) and a zoom (z).
// screen = (world - camera) * z

export interface Camera {
  x: number
  y: number
  z: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const MIN_ZOOM = 0.08
export const MAX_ZOOM = 2.5
export const GRID = 24

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** The camera that shows `r` centred in a `vw`×`vh` viewport, `pad` screen px all round. */
export function fit(r: Rect, vw: number, vh: number, pad = 0, maxZ = MAX_ZOOM): Camera {
  const z = clampZoom(Math.min((vw - pad * 2) / r.w, (vh - pad * 2) / r.h, maxZ))
  return { x: r.x + r.w / 2 - vw / 2 / z, y: r.y + r.h / 2 - vh / 2 / z, z }
}

/** Zooms by `factor` keeping the world point under screen point (sx, sy) fixed. */
export function zoomAt(c: Camera, factor: number, sx: number, sy: number): Camera {
  const z = clampZoom(c.z * factor)
  const wx = c.x + sx / c.z
  const wy = c.y + sy / c.z
  return { x: wx - sx / z, y: wy - sy / z, z }
}

export const toWorld = (c: Camera, sx: number, sy: number): { x: number; y: number } => ({
  x: c.x + sx / c.z,
  y: c.y + sy / c.z
})

export const snap = (v: number): number => Math.round(v / GRID) * GRID

/** Interpolates two cameras; zoom moves geometrically so a fly-out and fly-in feel even. */
export function lerpCamera(a: Camera, b: Camera, t: number, vw: number, vh: number): Camera {
  const z = a.z * Math.pow(b.z / a.z, t)
  // interpolate the viewport centre in world space, then derive the corner for this zoom
  const ca = { x: a.x + vw / 2 / a.z, y: a.y + vh / 2 / a.z }
  const cb = { x: b.x + vw / 2 / b.z, y: b.y + vh / 2 / b.z }
  const cx = ca.x + (cb.x - ca.x) * t
  const cy = ca.y + (cb.y - ca.y) * t
  return { x: cx - vw / 2 / z, y: cy - vh / 2 / z, z }
}

/** The brand curve, cubic-bezier(.2,.7,.2,1), solved for y at time t. */
export function ease(t: number): number {
  const [x1, y1, x2, y2] = [0.2, 0.7, 0.2, 1]
  const bez = (u: number, p1: number, p2: number): number =>
    3 * u * (1 - u) * (1 - u) * p1 + 3 * u * u * (1 - u) * p2 + u * u * u
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (bez(mid, x1, x2) < t) lo = mid
    else hi = mid
  }
  return bez((lo + hi) / 2, y1, y2)
}
