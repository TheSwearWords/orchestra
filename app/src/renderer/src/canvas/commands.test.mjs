import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchCommands } from './commands.ts'

const all = [
  { id: 'agents', label: 'Agents', hint: '' },
  { id: 'mcps', label: 'MCPs and providers', hint: '' },
  { id: 'create deliverable', label: 'Create deliverable', hint: '' },
  { id: 'create instrument', label: 'Create instrument', hint: '' },
  { id: 'chat', label: 'New conversation', hint: '' }
]
const ids = (t) => matchCommands(t, all).map((c) => c.id)

test('a bare slash lists everything', () => {
  assert.deepEqual(ids('/'), ['agents', 'mcps', 'create deliverable', 'create instrument', 'chat'])
})

test('prefix matches come first, then anything containing it', () => {
  assert.deepEqual(ids('/c'), ['create deliverable', 'create instrument', 'chat', 'mcps'])
  assert.deepEqual(ids('/provid'), ['mcps'])
})

test('ordinary text and finished words with spaces match nothing', () => {
  assert.deepEqual(ids('hello'), [])
  assert.deepEqual(ids('/agents please'), [])
  assert.deepEqual(ids('/zzz'), [])
})

test('a command can be two words', () => {
  assert.deepEqual(ids('/create'), ['create deliverable', 'create instrument'])
  assert.deepEqual(ids('/create inst'), ['create instrument'])
})
