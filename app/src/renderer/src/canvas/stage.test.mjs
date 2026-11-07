import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PODIUM, SEAT, besideSeat, filesFor, outputPaths, ring, seatArc } from './stage.ts'

test('seats run left to right by category, ending with the Add seat', () => {
  const seats = seatArc([
    { id: 'site', category: 'Web', name: 'Website' },
    { id: 'kit', category: 'Brand', name: 'Brand Kit' },
    { id: 'copy', category: 'Brand', name: 'Brand Copy' }
  ])
  assert.deepEqual(
    seats.map((s) => s.id),
    ['copy', 'kit', 'site', 'add']
  )
  assert.ok(seats.every((s, i) => i === 0 || s.x > seats[i - 1].x))
  assert.ok(seats.every((s) => s.y <= PODIUM.y + 1e-9)) // none below the podium
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

test('a seat card opens on the side away from the podium', () => {
  const left = besideSeat({ x: -600, y: -300 }, 520)
  const right = besideSeat({ x: 600, y: -300 }, 520)
  assert.ok(left.x + 520 <= -600 - SEAT.w / 2)
  assert.ok(right.x >= 600 + SEAT.w / 2)
})
