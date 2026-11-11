import test from 'node:test'
import assert from 'node:assert/strict'
import { dockAgents, dockStatus, latestNotes } from './dock.ts'

const musicians = [
  { id: 'logo', name: 'Logo' },
  { id: 'brand-kit', name: 'Brand Kit' },
  { id: 'website', name: 'Website' }
]

test('a selected Musician with no state is idle; an unselected one is left out', () => {
  assert.deepEqual(dockAgents(musicians, ['logo'], {}), [
    { id: 'logo', name: 'Logo', status: 'idle' }
  ])
})

test('the Instruments of a Musician roll into its dot, most urgent first', () => {
  const states = {
    logo: { status: 'working' },
    'logo--sketcher': { status: 'waiting' },
    'brand-kit': { status: 'done' },
    'brand-kit--palette': { status: 'error' },
    'website--sitemap': { status: 'done' }
  }
  assert.deepEqual(
    dockAgents(musicians, [], states).map((a) => a.status),
    ['needs-you', 'error', 'done']
  )
})

test('stopped and unknown statuses read as idle', () => {
  assert.equal(dockStatus('stopped'), 'idle')
  assert.equal(dockStatus('something-new'), 'idle')
  assert.equal(dockStatus(undefined), 'idle')
})

test('the latest log line of a Musician or its Instruments is its note', () => {
  const log = [
    { agent: 'orchestrator', text: 'Briefing Logo' },
    { agent: 'logo', text: 'Reading the brand spec' },
    { agent: 'logo--sketcher', text: 'Drafting lockups\nsecond line' },
    { agent: 'brand-kit', text: '  ' }
  ]
  assert.deepEqual(latestNotes(log), { logo: 'Drafting lockups' })
})
