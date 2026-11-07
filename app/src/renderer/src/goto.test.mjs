import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitGoTo } from './goto.ts'

const projects = new Set(['forma-editorial', 'kiln-coffee'])

test('trailing Go to lines become places, in order', () => {
  const r = splitGoTo(
    'Both use Bodoni.\n\nGo to: forma-editorial\nGo to: `kiln-coffee/create`.',
    projects
  )
  assert.equal(r.body, 'Both use Bodoni.')
  assert.deepEqual(r.places, [
    { project: 'forma-editorial', area: null },
    { project: 'kiln-coffee', area: 'create' }
  ])
})

test('an area alone means the project you are in', () => {
  const r = splitGoTo('Add links there.\nGo to: research', projects, 'kiln-coffee')
  assert.deepEqual(r.places, [{ project: 'kiln-coffee', area: 'research' }])
})

test('unknown places are dropped, other text is kept', () => {
  const r = splitGoTo('Hello.\nGo to: nowhere', projects)
  assert.equal(r.body, 'Hello.')
  assert.deepEqual(r.places, [])
  assert.deepEqual(splitGoTo('Go to the shop.', projects).places, [])
  assert.deepEqual(splitGoTo('No links here.', projects), { body: 'No links here.', places: [] })
})
