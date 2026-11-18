import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { cleanWork, inferKind, openTarget, readWork, setWork } from './work.ts'

test('the kind comes from the link', () => {
  assert.equal(inferKind('https://www.figma.com/design/abc/Brand?node-id=1-2'), 'figma')
  assert.equal(inferKind('https://example.com/site'), 'url')
  assert.equal(inferKind('/Users/me/models/vase.blend'), 'blender')
  assert.equal(inferKind('~/Work/site'), 'folder')
  assert.equal(inferKind('exports/site'), 'folder')
  assert.equal(inferKind('C:\\Work\\logo.ai'), 'other')
  assert.equal(inferKind('http://example.com'), 'other')
})

test('only https links and plain paths get through', () => {
  assert.deepEqual(cleanWork({ ref: ' https://figma.com/design/abc ' }), {
    kind: 'figma',
    ref: 'https://figma.com/design/abc'
  })
  assert.deepEqual(cleanWork({ ref: '/Users/me/vase.blend', note: ' v2 ' }), {
    kind: 'blender',
    ref: '/Users/me/vase.blend',
    note: 'v2'
  })
  assert.deepEqual(cleanWork({ ref: 'C:\\Work\\vase.blend' }), {
    kind: 'blender',
    ref: 'C:\\Work\\vase.blend'
  })
  for (const ref of [
    'http://example.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'ftp://x.com',
    '../elsewhere/site',
    'exports/../../etc',
    'line\nbreak',
    '',
    'x'.repeat(2001)
  ])
    assert.equal(cleanWork({ ref }), null, ref.slice(0, 30))
  assert.equal(cleanWork(null), null)
  assert.equal(cleanWork('https://figma.com/x'), null)
  assert.equal(cleanWork({ ref: 42 }), null)
})

test('a stated kind has to fit the link', () => {
  assert.equal(cleanWork({ kind: 'figma', ref: 'https://example.com/x' }), null)
  assert.equal(cleanWork({ kind: 'figma', ref: '/Users/me/x' }), null)
  assert.equal(cleanWork({ kind: 'blender', ref: 'https://example.com/x.blend' }), null)
  assert.equal(cleanWork({ kind: 'url', ref: '/Users/me/x' }), null)
  assert.equal(cleanWork({ kind: 'nonsense', ref: 'https://example.com' }).kind, 'url')
  assert.equal(cleanWork({ kind: 'other', ref: 'https://example.com' }).kind, 'other')
})

test('opening a link means the browser, a path means the file manager', () => {
  const w = (ref) => cleanWork({ ref })
  assert.deepEqual(openTarget(w('https://example.com/a'), '/p'), { url: 'https://example.com/a' })
  assert.deepEqual(openTarget(w('/Users/me/vase.blend'), '/p'), { path: '/Users/me/vase.blend' })
  assert.deepEqual(openTarget(w('~/Work/site'), '/p', '/home/me'), {
    path: join('/home/me', 'Work/site')
  })
  assert.deepEqual(openTarget(w('exports/site'), '/p'), { path: join('/p', 'exports/site') })
})

test('links are kept per deliverable, cleaned on the way in and out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-work-'))
  try {
    assert.deepEqual(await readWork(dir), {})
    await setWork(dir, 'logo', { ref: 'https://figma.com/design/abc' })
    await setWork(dir, 'render-3d', { ref: '/Users/me/vase.blend' })
    assert.deepEqual(Object.keys(await readWork(dir)).sort(), ['logo', 'render-3d'])
    await assert.rejects(
      () => setWork(dir, 'logo', { ref: 'javascript:alert(1)' }),
      /not a work link/
    )
    await assert.rejects(
      () => setWork(dir, '../logo', { ref: 'https://x.com' }),
      /not a deliverable/
    )
    assert.equal((await readWork(dir)).logo.kind, 'figma') // the refused one changed nothing
    await setWork(dir, 'logo', null)
    assert.deepEqual(Object.keys(await readWork(dir)), ['render-3d'])
    // a hand-edited file with a bad entry loses only that entry
    const { writeFile } = await import('fs/promises')
    await writeFile(
      join(dir, 'work.json'),
      JSON.stringify({
        ok: { ref: 'https://x.com' },
        bad: { ref: 'file:///etc/passwd' },
        'Bad Id': { ref: 'https://x.com' }
      })
    )
    assert.deepEqual(Object.keys(await readWork(dir)), ['ok'])
    await writeFile(join(dir, 'work.json'), 'not json')
    assert.deepEqual(await readWork(dir), {})
    assert.match(await readFile(join(dir, 'work.json'), 'utf8'), /not json/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
