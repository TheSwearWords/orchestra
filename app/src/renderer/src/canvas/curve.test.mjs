import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curve } from './curve.ts'

test('a mostly vertical wire leaves and arrives vertically', () => {
  assert.equal(curve(0, 0, 40, 200), 'M0,0 C0,100 40,100 40,200')
})

test('a mostly horizontal wire leaves and arrives horizontally', () => {
  assert.equal(curve(0, 0, 300, -40), 'M0,0 C150,0 150,-40 300,-40')
})
