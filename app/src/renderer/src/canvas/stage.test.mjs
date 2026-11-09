import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SEAT,
  WINDOW_W,
  filesFor,
  mcpState,
  mcpsOf,
  outputPaths,
  ring,
  prereqSpots,
  seatColumns,
  toolsFor,
  windowX
} from './stage.ts'

test('seats stack by category, five to a column, then on the left', () => {
  const seven = seatColumns(
    Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, category: 'Brand', name: `M${i}` }))
  )
  assert.ok(seven.slice(0, 5).every((s) => s.x === 0))
  assert.ok(seven[5].x <= -SEAT.w)
  assert.equal(seven[5].y, seven[0].y)
  const seats = seatColumns([
    { id: 'site', category: 'Web', name: 'Website' },
    { id: 'kit', category: 'Brand', name: 'Brand Kit' },
    { id: 'copy', category: 'Brand', name: 'Brand Copy' }
  ])
  assert.deepEqual(
    seats.map((s) => s.id),
    ['copy', 'kit', 'site']
  )
  assert.ok(seats.every((s) => s.x === 0))
  assert.ok(seats[1].y - seats[0].y >= SEAT.h)
})

test('prerequisites stack in one column, centred on the middle', () => {
  const spots = prereqSpots(3, 500)
  assert.ok(spots.every((s) => s.x === spots[0].x))
  assert.ok(spots[0].x - SEAT.w / 2 > 0) // clear of the seats
  assert.equal(spots[1].y, 500)
  assert.equal(spots[0].y + spots[2].y, 1000)
})

test("a deliverable's connections come from its tools, read and write as one", () => {
  assert.deepEqual(mcpsOf(['files', 'shell', 'figma-read', 'figma-write', 'blender']), [
    'figma',
    'blender'
  ])
  assert.deepEqual(mcpsOf(['files']), [])
  assert.deepEqual(toolsFor(['figma'], ['files', 'blender']), [
    'files',
    'figma-read',
    'figma-write'
  ])
})

test('mcpState reads what Claude Code reports', () => {
  assert.equal(mcpState('figma', { figma: 'connected' }), 'connected')
  assert.equal(mcpState('figma', { figma: 'auth' }), 'auth')
  assert.equal(mcpState('figma', { figma: 'failed' }), 'failed')
  assert.equal(mcpState('figma', {}), 'missing')
  assert.equal(mcpState('google-drive', { 'google drive': 'connected' }), 'connected')
  assert.equal(mcpState('blender', { blender: 'failed' }), 'connected') // only answers with Blender open
})

test('ring starts at the top', () => {
  const [p] = ring(4, 0, 0, 10)
  assert.ok(Math.abs(p.x) < 1e-9 && p.y === -10)
})

test('outputPaths reads paths out of an output line', () => {
  assert.deepEqual(outputPaths('prereqs/brand-spec.md and prereqs/tokens.json'), [
    'prereqs/brand-spec.md',
    'prereqs/tokens.json'
  ])
  assert.deepEqual(outputPaths("Renders or GLB files in the project's exports/ folder"), [
    'exports/'
  ])
  assert.deepEqual(outputPaths('Figma variables, styles and components'), [])
})

test('filesFor keeps only the files its instruments and foundations name', () => {
  const instruments = [
    { id: 'spec', output: 'prereqs/brand-spec.md and prereqs/tokens.json' },
    { id: 'logo', output: 'Logo frames in Figma, final files in prereqs/logo/' },
    { id: 'deck', output: 'prereqs/deck-outline.md' }
  ]
  const outputs = [
    { path: 'prereqs/brand-spec.md' },
    { path: 'prereqs/logo/mark.svg' },
    { path: 'prereqs/deck-outline.md' },
    { path: 'prereqs/brand-spec.md.bak' }
  ]
  const got = filesFor({ instruments: ['logo'], prerequisites: ['spec'] }, instruments, outputs)
  assert.deepEqual(
    got.map((o) => o.path),
    ['prereqs/brand-spec.md', 'prereqs/logo/mark.svg']
  )
})

test('windows under the circle are centred and never touch', () => {
  const xs = [0, 1, 2].map((i) => windowX(i, 3))
  assert.ok(Math.abs(xs[0] + WINDOW_W + xs[2]) <= 24) // symmetric about the middle
  assert.ok(xs[1] - xs[0] > WINDOW_W)
  assert.ok(Math.abs(windowX(0, 1) + WINDOW_W / 2) <= 12) // one window sits under the centre
})
