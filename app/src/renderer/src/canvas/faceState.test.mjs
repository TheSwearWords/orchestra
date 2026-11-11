import test from 'node:test'
import assert from 'node:assert/strict'
import { DONE_MS, SENT_MS, pickFace } from './faceState.ts'

const rest = {
  typing: false,
  sentAt: 0,
  busy: false,
  error: false,
  working: 0,
  needs: 0,
  doneAt: 0
}
const NOW = 1_000_000

test('nothing happening is idle; typing is listening', () => {
  assert.equal(pickFace(rest, NOW), 'idle')
  assert.equal(pickFace({ ...rest, typing: true }, NOW), 'listening')
})

test('sent shows briefly, then thinking while the Orchestrator answers', () => {
  const s = { ...rest, busy: true, sentAt: NOW }
  assert.equal(pickFace(s, NOW + 100), 'sent')
  assert.equal(pickFace(s, NOW + SENT_MS + 1), 'thinking')
})

test('working Musicians outrank thinking; done holds, then rests', () => {
  assert.equal(pickFace({ ...rest, busy: true, working: 2 }, NOW), 'working')
  const done = { ...rest, doneAt: NOW }
  assert.equal(pickFace(done, NOW + 500), 'done')
  assert.equal(pickFace(done, NOW + DONE_MS + 1), 'idle')
})

test('needs you outranks everything but an error', () => {
  const s = { ...rest, needs: 1, working: 3, busy: true, typing: true }
  assert.equal(pickFace(s, NOW), 'needs')
  assert.equal(pickFace({ ...s, error: true }, NOW), 'error')
})
