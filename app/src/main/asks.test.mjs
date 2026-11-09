import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { answerAsk, askProblems, openAsk, readAsks } from './asks.ts'

const base = { id: 'colours', chat: 'general', title: 'Colours', question: 'Which palette?' }

test('a window needs an id, a title, a question and two to six options', () => {
  assert.deepEqual(askProblems({ ...base, options: ['Warm', 'Cool'] }), [])
  assert.equal(askProblems({ ...base, id: 'Bad Id', options: ['a', 'b'] }).length, 1)
  assert.equal(askProblems({ ...base, options: ['only one'] }).length, 1)
})

test('opening again updates the window; any answer closes it, and it can be opened again', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asks-'))
  await openAsk(dir, { ...base, options: ['Warm', 'Cool'] })
  await openAsk(dir, { ...base, options: ['Warmer', 'Cooler', ' '] })
  assert.deepEqual(
    (await readAsks(dir)).colours.options.map((o) => o.label),
    ['Warmer', 'Cooler']
  )
  await answerAsk(dir, 'colours', 'less orange')
  const a = (await readAsks(dir)).colours
  assert.equal(a.status, 'answered')
  assert.equal(a.answer, 'less orange')
  await openAsk(dir, { ...base, options: ['Warmer', 'Cooler'] })
  assert.equal((await readAsks(dir)).colours.status, 'open')
  await assert.rejects(openAsk(dir, { ...base, options: ['x'] }))
})

test('options can show swatches; bad colours are dropped', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asks-'))
  const a = await openAsk(dir, {
    ...base,
    options: [
      { label: 'Warm', colors: ['#0538FF', 'red', '#ff5a1f'], detail: 'Blue and signal' },
      'Cool'
    ]
  })
  assert.deepEqual(a.options, [
    { label: 'Warm', colors: ['#0538FF', '#ff5a1f'], detail: 'Blue and signal' },
    { label: 'Cool' }
  ])
})

test('windows saved with plain-word options still have labels', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'asks-'))
  await mkdir(join(dir, '.orchestra'), { recursive: true })
  await writeFile(
    join(dir, '.orchestra', 'asks.json'),
    JSON.stringify({
      old: { ...base, id: 'old', status: 'open', t: '', options: ['Warm', 'Cool'] }
    })
  )
  assert.deepEqual(
    (await readAsks(dir)).old.options.map((o) => o.label),
    ['Warm', 'Cool']
  )
})
