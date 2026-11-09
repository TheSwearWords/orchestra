import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PROVIDERS, providerLink } from './providers.ts'

const claude = PROVIDERS.find((p) => p.id === 'anthropic')
const gemini = PROVIDERS.find((p) => p.id === 'gemini')

test('a saved key in use can be disconnected, and wins over being signed in', () => {
  const l = providerLink(claude, 'ANTHROPIC_API_KEY', true, true, 'max')
  assert.equal(l.connected, true)
  assert.equal(l.undo, 'key')
})

test('a saved key that did not load still offers Disconnect', () => {
  const l = providerLink(claude, 'claude CLI', true, true)
  assert.equal(l.connected, false)
  assert.equal(l.undo, 'key')
})

test('a key from the system environment is not Orchestra’s to remove', () => {
  const l = providerLink(gemini, 'GOOGLE_API_KEY', false, false)
  assert.equal(l.connected, true)
  assert.equal(l.undo, undefined)
})

test('an installed CLI is not connected until the sign-in check says so', () => {
  assert.equal(providerLink(claude, 'claude CLI', false, null).connected, null)
  assert.equal(providerLink(claude, 'claude CLI', false, false).connected, false)
  const l = providerLink(claude, 'claude CLI', false, true, 'max')
  assert.equal(l.connected, true)
  assert.equal(l.undo, 'account')
  assert.match(l.note, /max/)
})
