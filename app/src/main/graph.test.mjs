import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IGNORE, due, queryArgs } from './graph.ts'

test('a rebuild waits while one runs, and spaces itself out', () => {
  const now = 1_000_000_000
  assert.equal(due(undefined, false, now), 0) // never built: now
  assert.equal(due(now, true, now), null) // running: not now
  assert.equal(due(now - 60_000, false, now), 9 * 60_000) // built a minute ago: 9 more
  assert.equal(due(now - 60 * 60_000, false, now), 0) // long ago: now
})

test('the query asks one graph, briefly', () => {
  assert.deepEqual(queryArgs('which fonts?', '/p/graphify-out/graph.json'), [
    'query',
    'which fonts?',
    '--graph',
    '/p/graphify-out/graph.json',
    '--budget',
    '1500'
  ])
})

test('Orchestra keeps its own working files out of the graph', () => {
  for (const p of ['.orchestra/', 'graphify-out/', 'boards/']) assert.ok(IGNORE.includes(p))
})
