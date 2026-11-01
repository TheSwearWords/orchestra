import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { slugify, parseConcept, createProject, listProjects } from './projects.ts'

test('slugify', () => {
  assert.equal(slugify('  Hermès Rebrand / 2026 '), 'hermes-rebrand-2026')
  assert.equal(slugify('!!!'), '')
})

test('parseConcept reads front matter, falls back to folder name, strips BOM', () => {
  const p = parseConcept(
    'x',
    '---\nname: Still House\nclient: Atelier\n---\n\n# Still House\n\n## Concept\n\nQuiet rooms.\n\n## References\n'
  )
  assert.deepEqual(p, { id: 'x', name: 'Still House', client: 'Atelier', concept: 'Quiet rooms.' })
  assert.equal(
    parseConcept('orchestration-brand', '\uFEFF# Brand\n\n## Concept\n\n').name,
    'Orchestration Brand'
  )
})

test('createProject makes the vault folder and never overwrites', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-'))
  try {
    const a = await createProject(dir, {
      name: 'Forma',
      client: 'A\nB',
      concept: 'Line one\nline two'
    })
    const b = await createProject(dir, { name: 'forma', client: '', concept: '' })
    assert.equal(a.id, 'forma')
    assert.equal(b.id, 'forma-2')
    assert.deepEqual((await readdir(join(dir, 'forma'))).sort(), [
      'audits',
      'concept.md',
      'prereqs',
      'references'
    ])
    assert.match(
      await readFile(join(dir, 'forma', 'concept.md'), 'utf8'),
      /^---\nname: Forma\nclient: A B\n---/
    )
    const list = await listProjects(dir)
    assert.deepEqual(list.map((p) => [p.id, p.concept]).sort(), [
      ['forma', 'Line one\nline two'],
      ['forma-2', '']
    ])
    await assert.rejects(createProject(dir, { name: '  ', client: '', concept: '' }))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
