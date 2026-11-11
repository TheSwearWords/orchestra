import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitDecision, waitingOnUser } from './decide.ts'

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

const say = (role, text, t = '1') => ({ t, role, text })
const none = new Set()

test('an open-ended question waits on the user, and stops once they answer', () => {
  const asked = [say('orchestrator', 'I read the brief. Who is it for? Tell me what to avoid.')]
  assert.deepEqual(waitingOnUser(asked, none, []), { t: '1', question: 'Who is it for?' })
  assert.equal(waitingOnUser([...asked, say('user', 'Designers')], none, []), null)
})

test('a report in between does not count as an answer', () => {
  const m = [say('orchestrator', 'Which logo?'), say('note', 'Stopped by you.')]
  assert.equal(waitingOnUser(m, none, [])?.question, 'Which logo?')
})

test('a statement, a link or code is not a question', () => {
  const m = [say('orchestrator', 'Done, see https://a.co/x?y=1 and `foo?` in the file.')]
  assert.equal(waitingOnUser(m, none, []), null)
})

test('a Decide block waits on the user', () => {
  const m = [say('orchestrator', 'Decide: Which palette\n- Warm\n- Cool')]
  assert.equal(waitingOnUser(m, none, [])?.question, 'Which palette')
})

test('suggested deliverables wait until they are all on the board', () => {
  const m = [say('orchestrator', 'I would add these.\nSuggest deliverables: site, deck')]
  const known = new Set(['site', 'deck'])
  assert.ok(waitingOnUser(m, known, ['site']))
  assert.equal(waitingOnUser(m, known, ['site', 'deck']), null)
})
