import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { cleanPreview, readPreviews, savePreview, saveThumbnail } from './previews.ts'
import { addCoverImage, cleanCover, readCover, saveCover } from './covers.ts'

const temp = () => mkdtempSync(join(tmpdir(), 'orch-preview-'))
const figma = 'https://www.figma.com/design/abc/Brand?node-id=1-2'

test('cleanPreview accepts real places and refuses the rest', () => {
  assert.equal(cleanPreview({ label: 'Brand kit', url: figma }).url, figma)
  const site = cleanPreview({
    label: 'Site',
    url: 'http://localhost:3000',
    dev: 'npm run dev',
    dir: 'exports/site'
  })
  assert.equal(site.dev, 'npm run dev')
  assert.throws(() => cleanPreview({ label: 'x', url: 'http://example.com' }))
  assert.throws(() => cleanPreview({ label: 'x', url: 'file:///etc/passwd' }))
  assert.throws(() => cleanPreview({ label: '', url: figma }))
  const local = { label: 'x', url: 'http://localhost:3000' }
  assert.throws(() => cleanPreview({ ...local, dev: 'npm run dev; rm -rf /' }))
  assert.throws(() => cleanPreview({ ...local, dev: 'node evil.js' }))
  assert.throws(() => cleanPreview({ ...local, dev: 'npm run dev', dir: '../..' }))
  assert.throws(() => cleanPreview({ ...local, dev: 'npm run dev', dir: 'C:/Windows' }))
  assert.throws(() => cleanPreview({ label: 'x', url: figma, dev: 'npm run dev' }))
})

test('a preview with the same label is replaced and keeps its thumbnail', async () => {
  const p = temp()
  await savePreview(p, 'brand-kit', { label: 'Kit', url: figma })
  await saveThumbnail(p, 'brand-kit', 'Kit', Buffer.from('png'))
  const image = (await readPreviews(p))['brand-kit'][0].image
  assert.match(image, /^\.orchestra\/previews\/brand-kit-kit-/)
  await savePreview(p, 'brand-kit', { label: 'Kit', url: `${figma}0` })
  const after = await readPreviews(p)
  assert.equal(after['brand-kit'].length, 1)
  assert.equal(after['brand-kit'][0].image, image)
  await assert.rejects(
    savePreview(p, 'brand-kit', { label: 'K2', url: figma, image_url: 'http://a.com/x.png' })
  )
})

test('covers keep only known settings and uploads get a new name', async () => {
  assert.deepEqual(cleanCover({ color: 'ink', art: 'violin', image: '../x.png', junk: 1 }), {
    color: 'ink',
    art: 'violin'
  })
  assert.deepEqual(cleanCover({ color: 'pink', image: 'cover/a.png' }), { image: 'cover/a.png' })
  const p = temp()
  assert.deepEqual(await readCover(p), {})
  await saveCover(p, { color: 'blue' })
  assert.equal((await readCover(p)).color, 'blue')
  await assert.rejects(addCoverImage(p, 'C:/x/evil.exe'))
})
