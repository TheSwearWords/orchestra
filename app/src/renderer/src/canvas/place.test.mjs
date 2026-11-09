import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freeSpot, settle, separate } from './place.ts'

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

test('a free card stays where it is', () => {
  const r = { x: 0, y: 0, w: 100, h: 100 }
  assert.deepEqual(freeSpot(r, [{ x: 500, y: 0, w: 100, h: 100 }]), r)
})

test('a card dropped on another moves beside it, the nearest way', () => {
  const t = { x: 0, y: 0, w: 408, h: 192 }
  const r = freeSpot({ x: 360, y: 24, w: 200, h: 100 }, [t])
  assert.ok(!overlap(r, t))
  assert.equal(r.x, 480) // just right of it, past the 72px gap
  assert.equal(r.y, 24)
})

test('settle leaves no two cards overlapping', () => {
  const cards = [
    { id: 'a', x: 0, y: 0, w: 300, h: 300 },
    { id: 'b', x: 48, y: 48, w: 300, h: 300 },
    { id: 'c', x: 96, y: 96, w: 300, h: 300 }
  ]
  const fixed = [{ x: 0, y: 400, w: 1000, h: 100 }]
  const out = settle(cards, fixed)
  const all = [...out, ...fixed]
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i], all[j]), `${i} and ${j}`)
  assert.deepEqual(out[0], cards[0]) // the first one was free already
})

test('separate moves whole groups until none touch, and leaves fixed ones alone', () => {
  const blocks = [
    { ids: ['a', 'a2'], rect: { x: 0, y: 0, w: 400, h: 400 } },
    { ids: ['b'], rect: { x: 300, y: 100, w: 400, h: 400 } },
    { ids: ['c'], rect: { x: 350, y: 150, w: 100, h: 100 }, fixed: true }
  ]
  const moved = separate(blocks)
  assert.equal(moved.c, undefined)
  assert.deepEqual(moved.a, moved.a2)
  const placed = blocks.map((b) => {
    const d = moved[b.ids[0]] ?? { dx: 0, dy: 0 }
    return { ...b.rect, x: b.rect.x + d.dx, y: b.rect.y + d.dy }
  })
  for (const p of placed) for (const q of placed) if (p !== q) assert.ok(!overlap(p, q))
})

test('separate leaves groups that are already apart where they are', () => {
  assert.deepEqual(
    separate([
      { ids: ['a'], rect: { x: 0, y: 0, w: 100, h: 100 } },
      { ids: ['b'], rect: { x: 400, y: 0, w: 100, h: 100 } }
    ]),
    {}
  )
})
