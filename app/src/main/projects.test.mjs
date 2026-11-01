import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  slugify,
  parseConcept,
  createProject,
  editProject,
  listProjects,
  renameProject
} from './projects.ts'

test('editProject changes name, client and concept and keeps the rest of the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-edit-'))
  try {
    await createProject(dir, { name: 'Forma', client: 'Atelier', concept: 'Quiet.' })
    const file = join(dir, 'forma', 'concept.md')
    // notes added in Obsidian below the concept must survive
    await writeFile(file, (await readFile(file, 'utf8')) + '\n## References\n\nAre.na board.\n')
    const p = await editProject(dir, 'forma', {
      name: 'Forma Editorial',
      client: 'North\nStudio',
      concept: 'Loud type, $1 budget.'
    })
    assert.deepEqual(p, {
      id: 'forma',
      name: 'Forma Editorial',
      client: 'North Studio',
      concept: 'Loud type, $1 budget.'
    })
    const md = await readFile(file, 'utf8')
    assert.match(md, /## References\n\nAre.na board./)
    assert.equal(md.match(/## Concept/g).length, 1)
    // a file without a concept section gets one
    await writeFile(file, '---\nname: X\nclient: \n---\n\n# X\n')
    assert.equal((await editProject(dir, 'forma', { concept: 'New.' })).concept, 'New.')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
import { writeFile } from 'fs/promises'

test('renameProject changes the name, keeps the folder and the rest of the file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-rename-'))
  try {
    const p = await createProject(dir, { name: 'Forma', client: 'Atelier', concept: 'Quiet.' })
    const r = await renameProject(dir, p.id, 'Forma Editorial\n')
    assert.deepEqual(r, {
      id: 'forma',
      name: 'Forma Editorial',
      client: 'Atelier',
      concept: 'Quiet.'
    })
    const md = await readFile(join(dir, 'forma', 'concept.md'), 'utf8')
    assert.match(md, /^---\nname: Forma Editorial\nclient: Atelier\n---\n\n# Forma Editorial\n/)
    await assert.rejects(renameProject(dir, p.id, '  '))
    // a hand-made file without front matter gains it, and its own heading is left alone
    await writeFile(join(dir, 'forma', 'concept.md'), '# My notes\n\n## Concept\n\nHi.\n')
    const s = await renameProject(dir, p.id, 'Still')
    assert.equal(s.name, 'Still')
    assert.match(await readFile(join(dir, 'forma', 'concept.md'), 'utf8'), /# My notes/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

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
