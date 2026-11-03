import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitDecision } from './decide.ts'

test('a closing Decide block becomes a question with options', () => {
  const { body, decision } = splitDecision(
    'Two directions came back.\n\n**Decide:** Which palette?\n- Warm editorial (recommended)\n* `Cool technical`'
  )
  assert.equal(body, 'Two directions came back.')
  assert.deepEqual(decision, {
    question: 'Which palette?',
    options: [
      { label: 'Warm editorial', recommended: true },
      { label: 'Cool technical', recommended: false }
    ]
  })
})

test('ordinary lists and one-option blocks are left alone', () => {
  const list = 'Next steps:\n- palette\n- type'
  assert.deepEqual(splitDecision(list), { body: list, decision: null })
  const one = 'Decide: go ahead?\n- Yes'
  assert.deepEqual(splitDecision(one), { body: one, decision: null })
  // a block that isn't at the end isn't a decision
  const mid = 'Decide: which?\n- A\n- B\n\nThen I will start.'
  assert.equal(splitDecision(mid).decision, null)
})
