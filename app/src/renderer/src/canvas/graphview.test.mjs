import { test } from 'node:test'
import assert from 'node:assert/strict'
import { neighbourhood, search, summarize } from './graphview.ts'

const g = {
  nodes: [
    { id: 'bodoni', label: 'Bodoni Moda', community: 0, community_name: 'Type' },
    { id: 'forma', label: 'Forma Editorial', community: 1, community_name: 'Projects' },
    { id: 'kiln', label: 'Kiln Coffee', community: 1, community_name: 'Projects' },
    { id: 'warm', label: 'Warm palette', community: 2 },
    { id: 'alone', label: 'Loose note' }
  ],
  links: [
    { source: 'forma', target: 'bodoni', relation: 'uses' },
    { source: 'kiln', target: 'bodoni', relation: 'uses' },
    { source: 'forma', target: 'warm', relation: 'uses' },
    { source: 'kiln', target: 'warm', relation: 'uses' },
    { source: 'warm', target: 'bodoni', relation: 'pairs_with' }
  ]
}

test('what keeps coming up: the best connected, and clusters by size', () => {
  const s = summarize(g, 2)
  assert.deepEqual(
    s.hubs.map((h) => [h.id, h.degree]),
    [
      ['bodoni', 3],
      ['warm', 3]
    ]
  )
  assert.deepEqual(s.clusters[0], { name: 'Projects', size: 2 })
  // Graphify only numbered this one, so it takes its best connected member's name
  assert.ok(s.clusters.some((c) => c.name === 'Warm palette'))
})

test('search matches every word, best connected first', () => {
  assert.deepEqual(
    search(g, 'o')
      .map((n) => n.id)
      .slice(0, 2),
    ['bodoni', 'forma']
  )
  assert.deepEqual(
    search(g, 'kiln coffee').map((n) => n.id),
    ['kiln']
  )
  assert.deepEqual(search(g, '  '), [])
})

test('a neighbourhood is one node and what links to it, either way', () => {
  const n = neighbourhood(g, 'bodoni')
  assert.equal(n.center.label, 'Bodoni Moda')
  assert.deepEqual(n.around.map((x) => x.node.id).sort(), ['forma', 'kiln', 'warm'])
  assert.equal(n.more, 0)
  assert.equal(neighbourhood(g, 'bodoni', 1).more, 2)
  assert.deepEqual(neighbourhood(g, 'alone').around, [])
})
