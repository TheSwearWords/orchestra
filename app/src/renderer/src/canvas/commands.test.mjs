import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchCommands } from './commands.ts'

const all = [
  { id: 'agents', label: 'Agents', hint: '' },
  { id: 'mcps', label: 'MCPs and providers', hint: '' },
  { id: 'create', label: 'II Create', hint: '' },
  { id: 'chat', label: 'New conversation', hint: '' }
]
const ids = (t) => matchCommands(t, all).map((c) => c.id)

test('a bare slash lists everything', () => {
  assert.deepEqual(ids('/'), ['agents', 'mcps', 'create', 'chat'])
})

test('prefix matches come first, then anything containing it', () => {
  assert.deepEqual(ids('/c'), ['create', 'chat', 'mcps'])
  assert.deepEqual(ids('/provid'), ['mcps'])
})

test('ordinary text and finished words with spaces match nothing', () => {
  assert.deepEqual(ids('hello'), [])
  assert.deepEqual(ids('/agents please'), [])
  assert.deepEqual(ids('/zzz'), [])
})
