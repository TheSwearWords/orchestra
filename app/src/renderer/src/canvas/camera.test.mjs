import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampZoom, ease, fit, lerpCamera, snap, toWorld, wheelCamera, zoomAt } from './camera.ts'

const wheel = (deltaX, deltaY, keys = {}) => ({
  deltaX,
  deltaY,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...keys
})

test('wheelCamera pans on scroll, sideways with shift, and zooms with ctrl', () => {
  const c = { x: 0, y: 0, z: 2 }
  assert.deepEqual(wheelCamera(c, wheel(0, 100), 0, 0), { x: 0, y: 50, z: 2 })
  assert.deepEqual(wheelCamera(c, wheel(0, 100, { shiftKey: true }), 0, 0), { x: 50, y: 0, z: 2 })
  const zoomed = wheelCamera(c, wheel(0, -100, { ctrlKey: true }), 300, 200)
  assert.ok(zoomed.z > c.z && zoomed.z < c.z * 1.5, 'one notch is a gentle step')
  const before = toWorld(c, 300, 200)
  const after = toWorld(zoomed, 300, 200)
  assert.ok(Math.abs(before.x - after.x) < 1e-6 && Math.abs(before.y - after.y) < 1e-6)
})

test('fit centres a rect and picks the smaller axis', () => {
  const c = fit({ x: 100, y: 100, w: 400, h: 200 }, 800, 800)
  assert.equal(c.z, 2)
  // the rect's centre (300, 200) lands at the viewport centre (400, 400)
  assert.deepEqual(toWorld(c, 400, 400), { x: 300, y: 200 })
})

test('zoomAt keeps the point under the cursor still', () => {
  const c = { x: 10, y: 20, z: 1 }
  const before = toWorld(c, 300, 150)
  const after = toWorld(zoomAt(c, 1.7, 300, 150), 300, 150)
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9)
})

test('zoom is clamped', () => {
  assert.equal(clampZoom(100), 2.5)
  assert.equal(clampZoom(0), 0.08)
})

test('lerpCamera hits both ends', () => {
  const a = { x: 0, y: 0, z: 1 }
  const b = { x: 500, y: 300, z: 0.25 }
  assert.deepEqual(lerpCamera(a, b, 0, 800, 600), a)
  const end = lerpCamera(a, b, 1, 800, 600)
  assert.ok(Math.abs(end.x - b.x) < 1e-9 && Math.abs(end.y - b.y) < 1e-9 && end.z === b.z)
})

test('snap and ease', () => {
  assert.equal(snap(35), 24)
  assert.equal(snap(37), 48)
  assert.ok(Math.abs(ease(0)) < 1e-6)
  assert.ok(Math.abs(ease(1) - 1) < 1e-6)
  assert.ok(ease(0.5) > 0.5) // ease-out: ahead of linear at the midpoint
})
