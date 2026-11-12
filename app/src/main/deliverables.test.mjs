import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { lockDeliverables, readLocked, readSelection, saveSelection } from './deliverables.ts'
import { foundationOrder } from './plan.ts'

const inst = (id, needs = []) => ({ id, name: id.toUpperCase(), needs, output: `prereqs/${id}.md` })
const lib = {
  orchestrator: null,
  instruments: [
    inst('brief'),
    inst('spec', ['brief']),
    inst('concepts', ['brief']),
    inst('logo', ['concepts'])
  ],
  musicians: [
    {
      id: 'kit',
      name: 'Kit',
      deliverable: 'The kit.',
      prerequisites: ['spec', 'logo'],
      instruments: []
    },
    {
      id: 'site',
      name: 'Site',
      deliverable: 'The site.',
      prerequisites: ['brief', 'spec'],
      instruments: []
    }
  ]
}

test('foundations come once each, needs first', () => {
  const ids = (chosen) => foundationOrder(lib.musicians, lib.instruments, chosen).map((i) => i.id)
  assert.deepEqual(ids(['site', 'kit']), ['brief', 'spec', 'concepts', 'logo'])
  assert.deepEqual(ids(['site']), ['brief', 'spec'])
  assert.deepEqual(ids([]), [])
})

test('selection saves to deliverables.md and reads back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-deliverables-'))
  try {
    assert.deepEqual(await readSelection(dir), [])
    assert.deepEqual(await saveSelection(dir, lib, ['site', 'kit', 'kit']), ['kit', 'site'])
    assert.deepEqual(await readSelection(dir), ['kit', 'site'])
    const md = await readFile(join(dir, 'deliverables.md'), 'utf8')
    assert.match(md, /1\. \*\*BRIEF\*\*: prereqs\/brief\.md/)
    assert.match(md, /- \*\*Kit\*\*: The kit\. Needs SPEC, LOGO\./)
    await assert.rejects(saveSelection(dir, lib, ['../escape']), /Unknown deliverable/)
    assert.deepEqual(await saveSelection(dir, lib, []), [])
    assert.deepEqual(await readSelection(dir), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('lock-in only adds, only chosen deliverables, and survives a new selection', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-locked-'))
  try {
    await saveSelection(dir, lib, ['kit', 'site'])
    assert.deepEqual(await readLocked(dir), [])
    assert.deepEqual(await lockDeliverables(dir, lib, ['kit', 'nope']), ['kit'])
    assert.deepEqual(await lockDeliverables(dir, lib, ['site']), ['kit', 'site'])
    await saveSelection(dir, lib, ['site'])
    assert.deepEqual(await readLocked(dir), ['site'])
    await saveSelection(dir, lib, ['kit', 'site'])
    assert.deepEqual(await readLocked(dir), ['site'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
