import { test } from 'node:test'
import assert from 'node:assert/strict'
import { H_GAP, V_GAP, treeLayout } from './tree.ts'

const node = (id, parent, w = 240, h = 240, extra = {}) => ({
  id,
  parent,
  x: 0,
  y: 0,
  w,
  h,
  ...extra
})

test('children sit in a row under their parent, centred on it', () => {
  const at = treeLayout([node('a', undefined, 240), node('b', 'a'), node('c', 'a')])
  assert.equal(at.b.y, 240 + V_GAP)
  assert.equal(at.c.x - at.b.x, 240 + H_GAP)
  assert.equal((at.b.x + at.c.x + 240) / 2, at.a.x + 120)
})

test('a wide subtree pushes its neighbours clear, and no two windows overlap', () => {
  const nodes = [
    node('root', undefined, 480, 480),
    node('one', 'root'),
    node('two', 'root'),
    node('a', 'one', 480, 720),
    node('b', 'one', 480),
    node('c', 'two', 240)
  ]
  const at = treeLayout(nodes)
  for (const p of nodes)
    for (const q of nodes) {
      if (p === q) continue
      const apart =
        at[p.id].x + p.w <= at[q.id].x ||
        at[q.id].x + q.w <= at[p.id].x ||
        at[p.id].y + p.h <= at[q.id].y ||
        at[q.id].y + q.h <= at[p.id].y
      assert.ok(apart, `${p.id} overlaps ${q.id}`)
    }
})

test('rows line up across branches, below the tallest window in the row above', () => {
  const at = treeLayout([
    node('root'),
    node('short', 'root', 240, 240),
    node('tall', 'root', 240, 720),
    node('x', 'short'),
    node('y', 'tall')
  ])
  assert.equal(at.x.y, at.y.y)
  assert.equal(at.x.y, at.tall.y + 720 + V_GAP)
})

test('side windows sit beside their parent and count toward its row height', () => {
  const at = treeLayout([
    node('root', undefined, 240, 240),
    node('r', 'root', 240, 960, { side: 'right' }),
    node('l', 'root', 240, 240, { side: 'left' }),
    node('kid', 'root')
  ])
  assert.deepEqual(at.r, { x: 240 + H_GAP, y: 0 })
  assert.deepEqual(at.l, { x: -H_GAP - 240, y: 0 })
  assert.equal(at.kid.y, 960 + V_GAP)
})

test('a band sits in its own row between a parent and its children', () => {
  const at = treeLayout([
    node('root', undefined, 240, 240),
    node('p1', 'root', 240, 480, { side: 'band' }),
    node('p2', 'root', 240, 240, { side: 'band' }),
    node('kid', 'root')
  ])
  assert.equal(at.p1.y, 240 + V_GAP)
  assert.equal(at.p2.y, at.p1.y)
  assert.equal(at.kid.y, at.p1.y + 480 + V_GAP)
  assert.equal(at.p2.x - at.p1.x, 240 + H_GAP)
})
