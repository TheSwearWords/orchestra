import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  groupByCategory,
  neededNames,
  researchChoices,
  startingResearch,
  toggled
} from './setupPick.ts'

test('research choices: the summary first, then each note in research/', () => {
  const out = [
    { path: 'research/b-mood.md' },
    { path: 'prereqs/x.md' },
    { path: 'research.md' },
    { path: 'research/art-direction.md' },
    { path: 'research/deep/x.md' }
  ]
  assert.deepEqual(
    researchChoices(out).map((c) => [c.path, c.label]),
    [
      ['research.md', 'Research summary'],
      ['research/art-direction.md', 'art direction'],
      ['research/b-mood.md', 'b mood']
    ]
  )
  assert.deepEqual(researchChoices([]), [])
})

test('research starts all ticked the first time, then as saved', () => {
  const choices = researchChoices([{ path: 'research.md' }, { path: 'research/a.md' }])
  assert.deepEqual(startingResearch([], choices), ['research.md', 'research/a.md'])
  assert.deepEqual(startingResearch(['research/a.md', 'research/gone.md'], choices), [
    'research/a.md'
  ])
  // everything saved has since gone: stay empty, don't re-tick it all
  assert.deepEqual(startingResearch(['research/gone.md'], choices), [])
})

test('deliverables group by category in project order, then alphabetically', () => {
  const m = (id, name, category) => ({ id, name, category })
  const groups = groupByCategory([
    m('z', 'Zine', 'Print'),
    m('c', 'Code', 'Code'),
    m('s', 'Slides', 'Brand'),
    m('k', 'Kit', 'Brand'),
    m('w', 'Site', 'Web'),
    m('a', 'Ads', 'Another')
  ])
  assert.deepEqual(
    groups.map((g) => [g.category, g.items.map((i) => i.id)]),
    [
      ['Brand', ['k', 's']],
      ['Web', ['w']],
      ['Code', ['c']],
      ['Another', ['a']],
      ['Print', ['z']]
    ]
  )
})

test('toggling: started work stays on', () => {
  assert.deepEqual(toggled(['a'], 'b', []), ['a', 'b'])
  assert.deepEqual(toggled(['a', 'b'], 'a', []), ['b'])
  assert.deepEqual(toggled(['a', 'b'], 'a', ['a']), ['a', 'b'])
  assert.deepEqual(toggled(['b'], 'a', ['a']), ['b', 'a'])
})

test('prerequisites follow the picks', () => {
  const inst = (id, needs = []) => ({
    id,
    name: id.toUpperCase(),
    needs,
    output: `prereqs/${id}.md`
  })
  const instruments = [inst('brief'), inst('spec', ['brief'])]
  const musicians = [
    { id: 'kit', prerequisites: ['spec'] },
    { id: 'site', prerequisites: ['brief'] }
  ]
  assert.deepEqual(neededNames(musicians, instruments, ['kit']), ['BRIEF', 'SPEC'])
  assert.deepEqual(neededNames(musicians, instruments, ['site']), ['BRIEF'])
  assert.deepEqual(neededNames(musicians, instruments, []), [])
})
