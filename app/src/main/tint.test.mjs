import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brandTint } from './tint.ts'

// n pixels of one colour, in BGRA order
const fill = (n, [r, g, b]) => Uint8Array.from({ length: n * 4 }, (_, i) => [b, g, r, 255][i % 4])

test('the panel takes the picture’s own hue, kept dark', () => {
  assert.equal(brandTint(fill(16, [255, 0, 0])), 'hsl(0 70% 18% / 0.62)') // red stays red, darkened
  assert.equal(brandTint(fill(16, [0, 0, 255])), 'hsl(240 70% 18% / 0.62)') // blue stays blue
})

test('a colourful accent wins over the white page around it', () => {
  const page = new Uint8Array([...fill(12, [255, 255, 255]), ...fill(4, [255, 0, 0])])
  assert.equal(brandTint(page), 'hsl(0 70% 18% / 0.62)')
})

test('a page with no colour keeps the neutral panel', () => {
  assert.equal(brandTint(fill(16, [240, 240, 240])), undefined)
  assert.equal(brandTint(fill(16, [10, 10, 10])), undefined)
  assert.equal(brandTint(new Uint8Array()), undefined)
})
