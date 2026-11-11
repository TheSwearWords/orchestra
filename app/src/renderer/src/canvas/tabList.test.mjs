import test from 'node:test'
import assert from 'node:assert/strict'
import { closeTab, moveTab, openTab } from './tabList.ts'

test('opening a book adds its tab once', () => {
  assert.deepEqual(openTab(['a'], 'b'), ['a', 'b'])
  assert.deepEqual(openTab(['a', 'b'], 'a'), ['a', 'b'])
})

test('closing goes to the tab on the left, then the first left, then Home', () => {
  assert.deepEqual(closeTab(['a', 'b', 'c'], 'b'), { tabs: ['a', 'c'], next: 'a' })
  assert.deepEqual(closeTab(['a', 'b'], 'a'), { tabs: ['b'], next: 'b' })
  assert.deepEqual(closeTab(['a'], 'a'), { tabs: [], next: null })
  assert.deepEqual(closeTab(['a'], 'x'), { tabs: ['a'], next: 'a' })
})

test('a dragged tab takes the place of the one it is dropped on', () => {
  assert.deepEqual(moveTab(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a'])
  assert.deepEqual(moveTab(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'])
  assert.deepEqual(moveTab(['a', 'b'], 'a', 'a'), ['a', 'b'])
  assert.deepEqual(moveTab(['a', 'b'], 'x', 'a'), ['a', 'b'])
})
