import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMPTY, closeTab, focused, openTab, openToSide, prune, unsplit } from './tabs.ts'

test('opening tabs shows them in the focused pane, once each', () => {
  let t = openTab(EMPTY, 'a')
  t = openTab(t, 'b')
  t = openTab(t, 'a')
  assert.deepEqual(t, { open: ['a', 'b'], panes: ['a'], focus: 0 })
  assert.equal(focused(t), 'a')
})

test('in a split, a tab click changes the focused pane; the same project twice collapses it', () => {
  const t = { open: ['a', 'b'], panes: ['b', 'a'], focus: 1 }
  assert.deepEqual(openTab(t, 'c').panes, ['b', 'c'])
  assert.deepEqual(openTab(t, 'b'), { open: ['a', 'b'], panes: ['b'], focus: 0 })
  assert.deepEqual(unsplit(t, 0), { open: ['a', 'b'], panes: ['b'], focus: 0 })
})

test('open to the side splits, or fills the other pane', () => {
  const one = openTab(EMPTY, 'a')
  assert.deepEqual(openToSide(one, 'b'), { open: ['a', 'b'], panes: ['a', 'b'], focus: 1 })
  assert.deepEqual(openToSide(one, 'a'), one)
  const two = openToSide(one, 'b') // focus on the right
  assert.deepEqual(openToSide(two, 'c'), { open: ['a', 'b', 'c'], panes: ['c', 'b'], focus: 0 })
})

test('closing a tab moves its pane to a free neighbour, or closes the pane', () => {
  const t = { open: ['a', 'b', 'c'], panes: ['b', 'c'], focus: 0 }
  assert.deepEqual(closeTab(t, 'b'), { open: ['a', 'c'], panes: ['a', 'c'], focus: 0 })
  const two = { open: ['a', 'b'], panes: ['a', 'b'], focus: 1 }
  assert.deepEqual(closeTab(two, 'b'), { open: ['a'], panes: ['a'], focus: 0 })
  assert.deepEqual(closeTab(closeTab(two, 'b'), 'a'), EMPTY)
  assert.deepEqual(closeTab(two, 'zzz'), two)
})

test('prune drops deleted projects', () => {
  const t = { open: ['a', 'b', 'c'], panes: ['a', 'c'], focus: 1 }
  assert.deepEqual(
    prune(t, (id) => id !== 'c'),
    { open: ['a', 'b'], panes: ['a', 'b'], focus: 1 }
  )
})
