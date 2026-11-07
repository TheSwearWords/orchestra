import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { answerAsk, askProblems, openAsk, readAsks } from './asks.ts'

const base = { id: 'colours', chat: 'general', title: 'Colours', question: 'Which palette?' }

test('a window needs an id, a title, a question and two to six options', () => {
  assert.deepEqual(askProblems({ ...base, options: ['Warm', 'Cool'] }), [])
  assert.equal(askProblems({ ...base, id: 'Bad Id', options: ['a', 'b'] }).length, 1)
  assert.equal(askProblems({ ...base, options: ['only one'] }).length, 1)
})

test('opening again updates the window; a pick answers it, a refinement does not', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asks-'))
  await openAsk(dir, { ...base, options: ['Warm', 'Cool'] })
  await openAsk(dir, { ...base, options: ['Warmer', 'Cooler', ' '] })
  assert.deepEqual((await readAsks(dir)).colours.options, ['Warmer', 'Cooler'])
  await answerAsk(dir, 'colours', 'less orange', false)
  assert.equal((await readAsks(dir)).colours.status, 'open')
  await answerAsk(dir, 'colours', 'Warmer', true)
  const a = (await readAsks(dir)).colours
  assert.equal(a.status, 'answered')
  assert.equal(a.answer, 'Warmer')
  await assert.rejects(openAsk(dir, { ...base, options: ['x'] }))
})
