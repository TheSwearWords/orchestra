import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { Conductor, parseAgent } from './conductor.ts'
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
    extraDirs: []
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
    assert.deepEqual(await toolsFor(c, 'orchestrator'), ['brief_musician'])
    assert.deepEqual(await toolsFor(c, 'website'), ['report', 'run_instrument'])
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
