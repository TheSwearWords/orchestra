import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadLibrary, checkLibrary } from './library.ts'
import { addToCrew, adopt, draftProblems } from './proposals.ts'

const prompt = 'You are the Trailer Musician. '.repeat(4)
const lib = {
  orchestrator: null,
  musicians: [{ id: 'website' }],
  instruments: [{ id: 'brief' }, { id: 'copywriter' }]
}

test('drafts from a model are checked before anything is written', () => {
  const good = {
    id: 'trailer',
    name: 'Trailer',
    deliverable: 'A 30s cut.',
    category: 'Motion',
    prerequisites: ['brief'],
    prompt
  }
  assert.deepEqual(draftProblems('musician', good, lib), [])
  const bad = draftProblems(
    'musician',
    { ...good, id: 'website', prerequisites: ['nope'], model: 'gpt', prompt: 'hi' },
    lib
  )
  assert.equal(bad.length, 4) // taken id, unknown Instrument, bad model, thin prompt
  const inst = {
    id: 'cutter',
    name: 'Cutter',
    job: 'Cuts.',
    output: '../outside.md',
    needs: ['cutter'],
    prompt
  }
  assert.equal(draftProblems('instrument', inst, lib).length, 3) // path escapes, unknown need, needs itself
})

test('approved drafts land in the library, and a new Instrument joins its Musician', async () => {
  const home = await mkdtemp(join(tmpdir(), 'orch-prop-'))
  try {
    await mkdir(join(home, 'library', 'musicians'), { recursive: true })
    await mkdir(join(home, 'library', 'instruments'), { recursive: true })
    await writeFile(join(home, 'library', 'orchestrator.md'), '---\nname: Orchestrator\n---\nHi')
    await writeFile(
      join(home, 'library', 'instruments', 'brief.md'),
      '---\nname: Brief\njob: x\noutput: prereqs/brief.md\nneeds: []\n---\nBrief.'
    )
    const musician = {
      id: 'trailer',
      name: 'Trailer',
      deliverable: 'A 30s cut.',
      category: 'Motion',
      prerequisites: ['brief'],
      prompt
    }
    await adopt(home, {
      id: 'musician:trailer',
      kind: 'musician',
      from: 'orchestrator',
      chat: 'general',
      status: 'pending',
      t: '',
      draft: musician
    })
    const inst = {
      id: 'cutter',
      name: 'Cutter',
      job: 'Cuts the edit.',
      output: 'cuts/edit.md',
      needs: ['brief'],
      model: 'sonnet',
      prompt
    }
    await adopt(home, {
      id: 'instrument:cutter',
      kind: 'instrument',
      from: 'trailer',
      chat: 'trailer',
      status: 'pending',
      t: '',
      draft: inst
    })

    const l = await loadLibrary(home)
    const t = l.musicians.find((m) => m.id === 'trailer')
    assert.equal(t.source, 'orchestrator')
    assert.deepEqual(t.prerequisites, ['brief'])
    assert.deepEqual(t.instruments, ['cutter'])
    assert.equal(l.instruments.find((i) => i.id === 'cutter').source, 'trailer')
    assert.deepEqual(checkLibrary(l), [])
    // never overwrites
    await assert.rejects(
      adopt(home, {
        id: 'musician:trailer',
        kind: 'musician',
        from: 'orchestrator',
        chat: 'general',
        status: 'pending',
        t: '',
        draft: musician
      })
    )
    assert.match(
      await readFile(join(home, 'library', 'musicians', 'trailer.md'), 'utf8'),
      /^---\nname: Trailer/
    )
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('addToCrew appends once, and adds the line when it is missing', () => {
  assert.match(addToCrew('---\nname: A\ninstruments: [x]\n---\nbody', 'y'), /instruments: \[x, y\]/)
  assert.equal(addToCrew('---\ninstruments: [y]\n---\n', 'y'), '---\ninstruments: [y]\n---\n')
  assert.match(addToCrew('---\nname: A\n---\nbody', 'y'), /name: A\ninstruments: \[y\]\n---/)
})
