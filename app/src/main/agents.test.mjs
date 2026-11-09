import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { Conductor, parseAgent, readChat } from './conductor.ts'
import { startOrchestraMcp } from './orchestra-mcp.ts'

const lib = {
  musicians: [
    { id: 'website', name: 'Website', prerequisites: ['brief'], instruments: ['copywriter'] },
    { id: 'logo', name: 'Logo', prerequisites: ['brief'], instruments: ['logo-builder'] }
  ],
  instruments: [
    { id: 'brief', name: 'Product Brief', needs: [] },
    { id: 'copywriter', name: 'Copywriter', needs: [] },
    { id: 'logo-builder', name: 'Logo Builder', needs: [] }
  ]
}

function conductor(dir) {
  return new Conductor({
    emit: () => {},
    projectDir: () => dir,
    library: async () => lib,
    selected: async () => ['website'],
    orchestratorModel: async () => 'opus',
    orchestratorPrompt: async () => '',
    agentPrompt: async () => '',
    extraDirs: () => []
  })
}

/** Lists the tools an agent's session would see, through the real HTTP tool server. */
async function toolsFor(hub, agent) {
  const mcp = await startOrchestraMcp(hub)
  const { mcpServers } = JSON.parse(mcp.configFor('p', 'general', agent))
  const { url, headers } = mcpServers.orchestra
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  })
  const body = await res.json()
  mcp.close()
  return (body.result?.tools ?? []).map((t) => t.name).sort()
}

test('each level gets only its own tools', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-agents-'))
  try {
    const c = conductor(dir)
    assert.deepEqual(await toolsFor(c, 'orchestrator'), [
      'ask_graph',
      'brief_musician',
      'open_window',
      'propose_musician'
    ])
    assert.deepEqual(await toolsFor(c, 'website'), [
      'ask_graph',
      'propose_instrument',
      'report',
      'run_instrument',
      'set_preview'
    ])
    assert.deepEqual(await toolsFor(c, 'website--copywriter'), [])
    assert.deepEqual(await toolsFor(c, 'not-an-agent'), [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('roles, and who each agent may start', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-agents-'))
  try {
    await mkdir(join(dir, '.orchestra'), { recursive: true })
    const c = conductor(dir)
    assert.equal(await c.roleOf('p', 'orchestrator'), 'orchestrator')
    assert.equal(await c.roleOf('p', 'website'), 'musician')
    assert.equal(await c.roleOf('p', 'website--copywriter'), 'instrument')
    assert.equal(await c.roleOf('p', 'website--nope'), null)
    // the Orchestrator may brief chosen deliverables only
    assert.deepEqual(
      (await c.choices('p', 'orchestrator')).map((x) => x.id),
      ['website']
    )
    await assert.rejects(c.briefMusician('p', 'general', 'logo', 'Draw it'), /chosen deliverables/)
    // a Musician may run its own Instruments and its foundations, nobody else's
    assert.deepEqual((await c.choices('p', 'website')).map((x) => x.id).sort(), [
      'brief',
      'copywriter'
    ])
    await assert.rejects(
      c.runInstrument('p', 'general', 'website', 'logo-builder', 'x'),
      /isn't one of your Instruments/
    )
    assert.deepEqual(parseAgent('website--copywriter'), {
      musician: 'website',
      instrument: 'copywriter'
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a proposed Musician waits as a card; bad or repeated drafts are refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-agents-'))
  try {
    const c = conductor(dir)
    const draft = {
      id: 'trailer',
      name: 'Trailer',
      deliverable: 'A 30 second cut.',
      category: 'Motion',
      prerequisites: ['brief'],
      prompt: 'You are the Trailer Musician. '.repeat(4)
    }
    await assert.rejects(
      c.proposeMusician('p', 'general', { ...draft, id: 'website' }),
      /already exists/
    )
    await c.proposeMusician('p', 'general', draft)
    const p = (await c.proposals('p'))['musician:trailer']
    assert.equal(p.status, 'pending')
    assert.equal(p.from, 'orchestrator')
    const card = (await readChat(dir, 'general')).at(-1)
    assert.deepEqual([card.role, card.ref], ['proposal', 'musician:trailer'])
    await assert.rejects(c.proposeMusician('p', 'general', draft), /already waiting/)
    await assert.rejects(c.decide('p', 'general', 'musician:nope', true), /no longer exists/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
