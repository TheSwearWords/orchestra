import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitSuggestion } from './suggest.ts'

const known = new Set(['website', 'slide-deck', 'brand-kit'])

test('the closing suggestion line becomes ids and leaves the reply', () => {
  assert.deepEqual(
    splitSuggestion('A site and a deck both fit.\n\nSuggest deliverables: website, slide-deck', known),
    { body: 'A site and a deck both fit.', ids: ['website', 'slide-deck'] }
  )
  // formatting, a full stop, unknown ids and repeats are tolerated
  assert.deepEqual(
    splitSuggestion('Yes.\n**Suggest deliverables:** `Website`, trailer, website.', known).ids,
    ['website']
  )
})

test('no suggestion line, or one in the middle, changes nothing', () => {
  const text = 'Suggest deliverables: website\nBut first, the brief.'
  assert.deepEqual(splitSuggestion(text, known), { body: text, ids: [] })
  assert.deepEqual(splitSuggestion('Just talk.', known), { body: 'Just talk.', ids: [] })
})
