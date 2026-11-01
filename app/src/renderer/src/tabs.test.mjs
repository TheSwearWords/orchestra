import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPTY,
  closeTab,
  focused,
  moveTab,
  openTab,
  openToSide,
  pairsOf,
  prune,
  ungroup,
  unsplit
} from './tabs.ts'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const three = () => ['a', 'b', 'c'].reduce(openTab, EMPTY)

test('opening tabs shows each alone, once each', () => {
  const t = openTab(three(), 'a')
  assert.deepEqual(t, { open: ['a', 'b', 'c'], panes: ['a'], focus: 0, pairs: [] })
  assert.equal(focused(t), 'a')
})

test('a split is a group: other tabs show alone, the group comes back intact', () => {
  const split = openToSide(openTab(three(), 'a'), 'b') // a | b
  assert.deepEqual(split.panes, ['a', 'b'])
  assert.equal(split.focus, 1)
  const alone = openTab(split, 'c')
  assert.deepEqual(alone.panes, ['c'], 'c shows by itself')
  assert.deepEqual(pairsOf(alone), [['a', 'b']], 'the group is untouched')
  const back = openTab(alone, 'a')
  assert.deepEqual([back.panes, back.focus], [['a', 'b'], 0], 'clicking a member shows the group')
  assert.equal(openTab(alone, 'b').focus, 1)
})

test('splitting regroups: each tab is in one group at most', () => {
  const ab = openToSide(openTab(three(), 'a'), 'b')
  const bc = openToSide(ab, 'c') // b is focused, so b | c; a leaves its group
  assert.deepEqual(pairsOf(bc), [['b', 'c']])
  assert.deepEqual(openTab(bc, 'a').panes, ['a'])
  assert.deepEqual(openToSide(openTab(three(), 'a'), 'a').panes, ['a'])
})

test('unsplit ends the group and keeps the chosen side', () => {
  const t = unsplit(openToSide(openTab(three(), 'a'), 'b'), 0)
  assert.deepEqual([t.panes, pairsOf(t)], [['a'], []])
  assert.deepEqual(openTab(t, 'b').panes, ['b'], 'b is a normal tab again')
})

test('ungroup ends a group whether or not it is on screen', () => {
  const split = openToSide(openTab(three(), 'a'), 'b')
  const shown = ungroup(split, 'b')
  assert.deepEqual([shown.panes, pairsOf(shown)], [['b'], []])
  const hidden = ungroup(openTab(split, 'c'), 'a')
  assert.deepEqual([hidden.panes, pairsOf(hidden)], [['c'], []])
  assert.equal(ungroup(split, 'c'), split)
})

test('closing a tab ends its group; a lone tab gives way to its neighbour', () => {
  const split = openToSide(openTab(three(), 'a'), 'b')
  const closed = closeTab(split, 'b')
  assert.deepEqual([closed.open, closed.panes, pairsOf(closed)], [['a', 'c'], ['a'], []])
  const hidden = closeTab(openTab(split, 'c'), 'a') // group off screen, c showing
  assert.deepEqual([hidden.panes, pairsOf(hidden)], [['c'], []])
  const lone = closeTab(openTab(three(), 'b'), 'b')
  assert.deepEqual(lone.panes, ['c'])
  assert.deepEqual(['a'].reduce(openTab, EMPTY).open.reduce(closeTab, openTab(EMPTY, 'a')), EMPTY)
  assert.equal(closeTab(split, 'zzz'), split)
})

test('a group shows again when one of its members slides into a closed tab’s place', () => {
  const t = openTab(openToSide(openTab(three(), 'b'), 'c'), 'a') // a alone, b | c grouped
  assert.deepEqual(closeTab(t, 'a').panes, ['b', 'c'])
})

test('state saved before groups counts an on-screen split as a group', () => {
  const old = { open: ['a', 'b', 'c'], panes: ['b', 'a'], focus: 1 }
  assert.deepEqual(pairsOf(old), [['b', 'a']])
  assert.deepEqual(openTab(old, 'c').panes, ['c'])
  assert.deepEqual(openTab(openTab(old, 'c'), 'a').panes, ['b', 'a'])
})

test('moveTab puts a tab in another tab’s place, either direction', () => {
  const t = { open: ['a', 'b', 'c', 'd'], panes: ['a'], focus: 0 }
  assert.deepEqual(moveTab(t, 'a', 'c').open, ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveTab(t, 'd', 'b').open, ['a', 'd', 'b', 'c'])
  assert.equal(moveTab(t, 'b', 'b'), t)
})

test('prune drops deleted projects', () => {
  const t = openTab(openToSide(openTab(three(), 'a'), 'c'), 'a')
  const p = prune(t, (id) => id !== 'c')
  assert.deepEqual([p.open, p.panes, pairsOf(p)], [['a', 'b'], ['a'], []])
})
