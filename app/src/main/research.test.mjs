import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  addFiles,
  addLink,
  addSite,
  listReferences,
  listSites,
  normalizeUrl,
  parseReference,
  referenceFilePath,
  referenceMarkdown,
  removeReference,
  updateReference,
  DEFAULT_SITES
} from './research.ts'

test('normalizeUrl adds https and rejects other schemes', () => {
  assert.equal(normalizeUrl(' are.na/x '), 'https://are.na/x')
  assert.throws(() => normalizeUrl('javascript:alert(1)'))
  assert.throws(() => normalizeUrl('file:///C:/secret'))
  assert.throws(() => normalizeUrl('localhost'))
})

test('reference markdown round-trips and keeps the source on one line', () => {
  const r = {
    kind: 'link',
    source: 'https://a.co/x',
    note: 'Big serif\nheadlines',
    tag: 'asset',
    added: '2026-10-31T00:00:00.000Z'
  }
  assert.deepEqual(parseReference('a', referenceMarkdown(r)), { id: 'a', ...r })
  assert.equal(parseReference('b', '# not a reference'), null)
})

test('links, files, edits and removal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-research-'))
  try {
    const a = await addLink(dir, {
      url: 'www.are.na/quiet',
      note: 'Whitespace',
      tag: 'inspiration'
    })
    const b = await addLink(dir, { url: 'https://www.are.na/quiet', note: '', tag: 'asset' })
    assert.equal(a.id, 'are-na-quiet')
    assert.equal(b.id, 'are-na-quiet-2')

    const img = join(dir, 'Moodboard Final.PNG')
    await writeFile(img, 'png bytes')
    const [f] = await addFiles(dir, [img])
    assert.equal(f.source, 'moodboard-final.png')
    assert.equal(f.size, 9)
    await assert.rejects(addFiles(dir, [join(dir, 'notes.txt')]))

    await updateReference(dir, a.id, { note: 'Confident whitespace', tag: 'asset' })
    const list = await listReferences(dir)
    assert.equal(list.length, 3)
    assert.deepEqual(
      list.find((r) => r.id === a.id),
      { ...a, note: 'Confident whitespace', tag: 'asset' }
    )

    await removeReference(dir, f.id)
    assert.deepEqual(await readdir(join(dir, 'references', 'files')), [])
    await assert.rejects(removeReference(dir, '../concept'))
    assert.throws(() => referenceFilePath(dir, '../concept.md'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('sites: defaults first, then the user’s own', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-sites-'))
  try {
    assert.equal((await listSites(dir)).length, DEFAULT_SITES.length)
    await addSite(dir, { name: 'Godly', url: 'godly.website' })
    const sites = await listSites(dir)
    assert.deepEqual(sites.at(-1), { name: 'Godly', url: 'https://godly.website/' })
    await assert.rejects(addSite(dir, { name: ' ', url: 'x.com' }))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
