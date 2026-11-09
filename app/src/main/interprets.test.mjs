import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { addGroup, renameGroup } from './research.ts'
import {
  addBox,
  connectBox,
  outputFor,
  readBoxes,
  refsFor,
  removeBox,
  renameBoxGroup
} from './interprets.ts'
import { tidyOptions } from './asks.ts'

const project = () => {
  const p = mkdtempSync(join(tmpdir(), 'orch-boxes-'))
  mkdirSync(join(p, 'references'))
  return p
}

test('a new project has one box wired to every group, writing research.md', async () => {
  const p = project()
  await addGroup(p, 'Type')
  const [box, ...rest] = await readBoxes(p)
  assert.equal(rest.length, 0)
  assert.deepEqual(box.groups, ['', 'Type'])
  assert.equal(outputFor(box.id), 'research.md')
})

test('groups can be wired to separate boxes, each with its own file', async () => {
  const p = project()
  await addGroup(p, 'Type')
  await addBox(p)
  await connectBox(p, 'main', 'Type', false)
  await connectBox(p, 'interpret-2', 'Type', true)
  const boxes = await readBoxes(p)
  assert.deepEqual(
    boxes.map((b) => b.groups),
    [[''], ['Type']]
  )
  assert.equal(outputFor('interpret-2'), 'research/interpret-2.md')
  const refs = [{ id: 'a' }, { id: 'b', group: 'Type' }]
  assert.deepEqual(
    refsFor(refs, boxes[1]).map((r) => r.id),
    ['b']
  )
  await renameGroup(p, 'Type', 'Typography')
  await renameBoxGroup(p, 'Type', 'Typography')
  assert.deepEqual((await readBoxes(p))[1].groups, ['Typography'])
  await assert.rejects(connectBox(p, 'main', 'Nope', true))
  await assert.rejects(removeBox(p, 'main'))
  await removeBox(p, 'interpret-2')
  assert.equal((await readBoxes(p)).length, 1)
})

test('option previews keep only safe fonts and images', () => {
  const [good, bad] = tidyOptions([
    { label: 'A', font: 'Playfair Display', sample: 'Aa', image: 'prereqs/logo/a.png' },
    { label: 'B', font: "x'); }", image: '../../secret.png' }
  ])
  assert.equal(good.font, 'Playfair Display')
  assert.equal(good.image, 'prereqs/logo/a.png')
  assert.equal(bad.font, undefined)
  assert.equal(bad.image, undefined)
  assert.equal(
    tidyOptions([{ label: 'C', image: 'https://a.com/x.jpg' }])[0].image,
    'https://a.com/x.jpg'
  )
  assert.equal(tidyOptions([{ label: 'D', image: 'http://a.com/x.jpg' }])[0].image, undefined)
})
