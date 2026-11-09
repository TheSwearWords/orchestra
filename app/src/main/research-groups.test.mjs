import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  addGroup,
  addLink,
  ensureSite,
  listReferences,
  listSites,
  readGroups,
  removeGroup,
  renameGroup,
  saveText,
  updateReference
} from './research.ts'
import { interpretPrompt } from './interpret.ts'

const temp = () => mkdtempSync(join(tmpdir(), 'orch-groups-'))
const link = (p) => addLink(p, { url: 'https://example.com/a', note: '', tag: 'inspiration' })

test('renaming a group refiles its references; deleting sends them to the default', async () => {
  const p = temp()
  await addGroup(p, 'Type')
  const r = await link(p)
  await updateReference(p, r.id, { group: 'Type' })
  await renameGroup(p, 'Type', 'Typography')
  assert.equal((await listReferences(p))[0].group, 'Typography')
  assert.deepEqual((await readGroups(p)).others, ['Typography'])
  await removeGroup(p, 'Typography')
  assert.equal((await listReferences(p))[0].group, undefined)
})

test('groups refuse unknown names, number duplicates, and rename the default without moving', async () => {
  const p = temp()
  const r = await link(p)
  await assert.rejects(updateReference(p, r.id, { group: 'Nope' }))
  await assert.rejects(addGroup(p, '   '))
  await addGroup(p, 'Color')
  assert.deepEqual((await addGroup(p, 'Color')).others, ['Color', 'Color 2'])
  assert.equal((await renameGroup(p, null, 'Imagery')).default, 'Imagery')
  assert.equal((await listReferences(p))[0].group, undefined)
})

test('ensureSite adds a new website once and leaves known ones alone', async () => {
  const home = temp()
  const before = (await listSites(home)).length
  await ensureSite(home, 'https://www.fontsinuse.com/uses/1')
  await ensureSite(home, 'https://fontsinuse.com/uses/2')
  await ensureSite(home, 'https://www.rawpixel.com/image/1')
  const sites = await listSites(home)
  assert.equal(sites.length, before + 1)
  assert.deepEqual(
    { name: sites.at(-1).name, url: sites.at(-1).url },
    { name: 'Fontsinuse', url: 'https://www.fontsinuse.com/' }
  )
})

test('interpretPrompt hands the model each group by name', () => {
  const ref = (source, group) => ({
    id: source,
    kind: 'link',
    source,
    note: '',
    tag: 'inspiration',
    added: '',
    group
  })
  const text = interpretPrompt('c', [ref('https://a.com'), ref('https://b.com', 'Typography')], {
    default: null,
    others: ['Typography']
  })
  assert.match(text, /Group: General research\n1\. https:\/\/a\.com/)
  assert.match(text, /Group: Typography\n1\. https:\/\/b\.com/)
})

test('a window of one kind keeps it through a rename, and its text is one note', async () => {
  const p = temp()
  await addGroup(p, 'Notes', ['text', 'nonsense'])
  assert.deepEqual((await readGroups(p)).kinds, { Notes: ['text'] })
  await saveText(p, 'Notes', 'Warm and strange')
  await saveText(p, 'Notes', 'Warmer')
  const notes = await listReferences(p)
  assert.equal(notes.length, 1)
  assert.equal(notes[0].kind, 'text')
  assert.equal(notes[0].note, 'Warmer')
  await renameGroup(p, 'Notes', 'Mood')
  assert.deepEqual((await readGroups(p)).kinds, { Mood: ['text'] })
  assert.equal((await listReferences(p))[0].group, 'Mood')
  await assert.rejects(saveText(p, 'Nope', 'x'))
  const told = interpretPrompt('c', await listReferences(p), await readGroups(p))
  assert.ok(told.includes('Written by the user:') && told.includes('Warmer'))
  await saveText(p, 'Mood', '   ')
  assert.equal((await listReferences(p)).length, 0)
  await saveText(p, 'Mood', 'again')
  await removeGroup(p, 'Mood')
  assert.equal((await listReferences(p)).length, 0)
})
