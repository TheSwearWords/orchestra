import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findClusters, layout3d, project } from './graphspace.ts'

const graph = {
  nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id })),
  links: [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'c' },
    { source: 'd', target: 'e' },
    { source: 'nope', target: 'a' }
  ]
}
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)

test('layout3d is repeatable, fits the unit sphere and pulls linked nodes closer', () => {
  const one = layout3d(graph)
  assert.deepEqual(one, layout3d(graph))
  for (const p of one) assert.ok(Math.hypot(p.x, p.y, p.z) <= 1.0001)
  const at = Object.fromEntries(one.map((p) => [p.id, p]))
  assert.ok(dist(at.a, at.b) < dist(at.a, at.e))
})

test('layout3d handles empty and single-node graphs', () => {
  assert.deepEqual(layout3d({ nodes: [], links: [] }), [])
  assert.equal(layout3d({ nodes: [{ id: 'x' }], links: [] }).length, 1)
})

test('project turns about the centre and shows nearer points larger', () => {
  const still = project({ x: 0, y: 0, z: 0 }, 1, 1, 100, 50, 40)
  assert.ok(Math.abs(still.sx - 100) < 1e-9 && Math.abs(still.sy - 50) < 1e-9)
  const near = project({ x: 0, y: 0, z: -1 }, 0, 0, 0, 0, 40)
  const far = project({ x: 0, y: 0, z: 1 }, 0, 0, 0, 0, 40)
  assert.ok(near.scale > far.scale)
})

test('findClusters names each cluster after its best connected member', () => {
  const g = {
    nodes: [
      { id: 'hub', label: 'Brand concept', community: 1 },
      { id: 'b', label: 'B', community: 1 },
      { id: 'c', label: 'C', community: 1 },
      { id: 'd', label: 'D', community: 2 },
      { id: 'e', label: 'E', community: 2 },
      { id: 'x', label: 'No cluster' }
    ],
    links: [
      { source: 'hub', target: 'b' },
      { source: 'hub', target: 'c' },
      { source: 'd', target: 'e' }
    ]
  }
  const { clusters, of } = findClusters(g, layout3d(g))
  assert.equal(clusters.length, 1) // the pair is shaded, not titled
  assert.equal(clusters[0].name, 'Brand concept')
  assert.equal(clusters[0].ids.length, 3)
  assert.equal(of.get('hub'), of.get('c'))
  assert.notEqual(of.get('hub'), of.get('d'))
  assert.equal(of.get('x'), undefined)
})

test('findClusters keeps the same community number in two projects apart', () => {
  const g = {
    nodes: [
      { id: 'p/a', community: 0, cluster: 'p:0' },
      { id: 'q/a', community: 0, cluster: 'q:0' }
    ],
    links: []
  }
  const { of } = findClusters(g, layout3d(g))
  assert.notEqual(of.get('p/a'), of.get('q/a'))
})

test('a flat layout has no depth', () => {
  for (const p of layout3d(graph, 120, true)) assert.equal(p.z, 0)
})
