import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'fs'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  agentFile,
  checkLibrary,
  editAgent,
  loadLibrary,
  newInstrument,
  parseDoc,
  setField
} from './library.ts'
import { providerStatus } from './connections.ts'

test('parseDoc reads strings and lists', () => {
  const doc = parseDoc('---\nname: Brand Kit\nneeds: [a, b ,]\nempty: []\n---\n\nYou are…')
  assert.deepEqual(doc, {
    fields: { name: 'Brand Kit', needs: ['a', 'b'], empty: [] },
    body: 'You are…'
  })
  assert.equal(parseDoc('# no front matter'), null)
})

test('loads a library and reports missing and circular Instruments', async () => {
  const home = await mkdtemp(join(tmpdir(), 'orchestra-library-'))
  const lib = join(home, 'library')
  try {
    await mkdir(join(lib, 'musicians'), { recursive: true })
    await mkdir(join(lib, 'instruments'), { recursive: true })
    await writeFile(join(lib, 'orchestrator.md'), '---\nname: Orchestrator\n---\nHi')
    await writeFile(
      join(lib, 'musicians', 'kit.md'),
      '---\nname: Kit\nprerequisites: [spec]\ninstruments: [ghost]\n---\nBuild'
    )
    await writeFile(join(lib, 'instruments', 'spec.md'), '---\nname: Spec\nneeds: [loop]\n---\n')
    await writeFile(join(lib, 'instruments', 'loop.md'), '---\nname: Loop\nneeds: [spec]\n---\n')

    const loaded = await loadLibrary(home)
    assert.equal(loaded.orchestrator?.prompt, 'Hi')
    // no model line: each tier gets its default
    assert.equal(loaded.orchestrator?.model, 'opus')
    assert.equal(loaded.musicians[0].model, 'sonnet')
    assert.equal(loaded.instruments[0].model, 'haiku')
    assert.deepEqual(loaded.musicians[0].prerequisites, ['spec'])
    assert.equal(loaded.musicians[0].category, 'Other')
    const problems = checkLibrary(loaded)
    assert.ok(problems.some((p) => p.includes('ghost')))
    assert.ok(problems.some((p) => p.startsWith('Circular')))
    assert.equal(problems.length, 2)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

// The real library in the vault, next to the app.
const vault = join(import.meta.dirname, '..', '..', '..', 'Orchestra')
test('the vault library is consistent', { skip: !existsSync(join(vault, 'library')) }, async () => {
  const lib = await loadLibrary(vault)
  assert.deepEqual(checkLibrary(lib), [])
  assert.ok(lib.musicians.length > 0)
})

test('setField replaces or adds one front-matter line and keeps the body', () => {
  const md = '---\nname: Kit\nmodel: sonnet\n---\n\nmodel: not this one'
  assert.equal(
    setField(md, 'model', 'opus'),
    '---\nname: Kit\nmodel: opus\n---\n\nmodel: not this one'
  )
  assert.deepEqual(parseDoc(setField(md, 'instruments', ['a', 'b'])).fields.instruments, ['a', 'b'])
  assert.throws(() => setField('no front matter', 'model', 'opus'))
})

test('agentFile only accepts plain ids', () => {
  assert.ok(agentFile('h', 'musician', 'brand-kit').endsWith(join('musicians', 'brand-kit.md')))
  assert.throws(() => agentFile('h', 'instrument', '../secrets'))
})

test('editAgent checks each edit and writes it to the right field', () => {
  const md = '---\nname: Kit\ndeliverable: A kit.\nmodel: opus\n---\nBody'
  const f = (x) => parseDoc(x).fields
  assert.equal(f(editAgent(md, 'musician', 'name', '  Brand   Kit ')).name, 'Brand Kit')
  assert.equal(f(editAgent(md, 'musician', 'description', 'The kit.')).deliverable, 'The kit.')
  assert.equal(f(editAgent(md, 'instrument', 'description', 'One job.')).job, 'One job.')
  assert.equal(f(editAgent(md, 'orchestrator', 'description', 'Leads.')).description, 'Leads.')
  // provider and model are set together, and the model must be that provider's
  const openai = editAgent(md, 'musician', 'runsOn', 'openai/gpt-5-mini')
  assert.deepEqual([f(openai).provider, f(openai).model], ['openai', 'gpt-5-mini'])
  assert.throws(() => editAgent(md, 'musician', 'runsOn', 'openai/opus'), /OpenAI/)
  assert.throws(() => editAgent(md, 'musician', 'runsOn', 'mistral/large'))
  assert.throws(() => editAgent(md, 'musician', 'name', ' '))
  assert.equal(parseDoc(editAgent(md, 'musician', 'name', 'X')).body, 'Body')
})

test('providers count as connected by API key or by their CLI on PATH', () => {
  const s = providerStatus({ PATH: '', OPENAI_API_KEY: 'x' })
  assert.deepEqual(s.openai, { connected: true, via: 'OPENAI_API_KEY' })
  assert.equal(s.gemini.connected, false)
  assert.equal(s.anthropic.connected, false)
})

test('newInstrument adds a blank Instrument to a Musician, with a free id', async () => {
  const home = await mkdtemp(join(tmpdir(), 'orch-lib-'))
  try {
    await mkdir(join(home, 'library', 'musicians'), { recursive: true })
    await mkdir(join(home, 'library', 'instruments'), { recursive: true })
    await writeFile(
      join(home, 'library', 'musicians', 'kit.md'),
      '---\nname: Kit\ninstruments: [a]\n---\nBody'
    )
    await writeFile(
      join(home, 'library', 'instruments', 'new-instrument.md'),
      '---\nname: Old\n---\nx'
    )
    const id = await newInstrument(home, 'kit')
    assert.equal(id, 'new-instrument-2')
    const lib = await loadLibrary(home)
    assert.deepEqual(lib.musicians[0].instruments, ['a', 'new-instrument-2'])
    const inst = lib.instruments.find((i) => i.id === id)
    assert.deepEqual(
      [inst.name, inst.model, inst.provider, inst.source],
      ['New Instrument', 'haiku', 'anthropic', 'kit']
    )
    await assert.rejects(newInstrument(home, 'missing'))
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
