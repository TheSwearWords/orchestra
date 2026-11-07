import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { cleanSetup, readSetup, saveSetup } from './setup.ts'

test('setup keeps only known providers, tidy tool ids and a trimmed name', () => {
  const s = cleanSetup({
    done: 'yes',
    name: '  John  ',
    providers: ['anthropic', 'anthropic', 'skynet'],
    tools: ['figma', '../etc'],
    memory: true
  })
  assert.equal(s.done, false)
  assert.equal(s.name, 'John')
  assert.deepEqual(s.providers, ['anthropic'])
  assert.deepEqual(s.tools, ['figma'])
  assert.equal(s.memory, true)
  assert.equal(s.github, false)
})

test('setup reads back what was saved, and starts empty', async () => {
  const home = await mkdtemp(join(tmpdir(), 'orch-setup-'))
  assert.equal((await readSetup(home)).done, false)
  await saveSetup(home, { done: true, name: 'John', providers: ['openai'] })
  const s = await readSetup(home)
  assert.equal(s.done, true)
  assert.deepEqual(s.providers, ['openai'])
})
