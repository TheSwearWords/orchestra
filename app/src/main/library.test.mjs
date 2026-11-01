import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'fs'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { checkLibrary, loadLibrary, parseDoc } from './library.ts'

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
