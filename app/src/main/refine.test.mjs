import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { approve, loadRefine, readRefine, reopen, saveRefine, signOff, stageOf } from './refine.ts'
import { setWork } from './work.ts'
import { checkAudit, saveAudit } from './audits.ts'

const none = { approved: [], signed: [] }

test('ready, signed off and reopened', () => {
  let s = approve(none, 'logo')
  assert.equal(stageOf(s, 'logo'), 'ready')
  assert.equal(stageOf(s, 'site'), 'draft')
  assert.deepEqual(approve(s, 'logo'), s)
  s = signOff(s, 'logo')
  assert.equal(stageOf(s, 'logo'), 'signed-off')
  assert.deepEqual(signOff(s, 'logo'), s)
  assert.throws(() => signOff(none, 'logo'), /ready for Refine/)
  // approving again after sign-off reopens the work for a new pass
  assert.equal(stageOf(approve(s, 'logo'), 'logo'), 'ready')
  assert.deepEqual(reopen(s, 'logo'), none)
  assert.deepEqual(reopen(none, 'logo'), none)
})

test('the saved file is cleaned, and the board only sees what is locked in', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-refine-'))
  try {
    assert.deepEqual(await readRefine(dir), none)
    await writeFile(
      join(dir, 'refine.json'),
      JSON.stringify({ approved: ['logo', 'Bad Id', 7, 'site'], signed: ['site', 'ghost'] })
    )
    assert.deepEqual(await readRefine(dir), { approved: ['logo', 'site'], signed: ['site'] })
    await saveRefine(dir, { approved: ['logo', 'site'], signed: ['site'] })
    await setWork(dir, 'logo', { ref: 'https://figma.com/design/abc' })
    await setWork(dir, 'old', { ref: 'https://example.com' })
    await saveAudit(dir, 'logo', checkAudit({ findings: [{ severity: 'low', note: 'x' }] }).audit)
    const v = await loadRefine(dir, ['logo', 'kit'])
    assert.deepEqual(v.state, { approved: ['logo'], signed: [] })
    assert.deepEqual(Object.keys(v.work), ['logo'])
    assert.deepEqual(Object.keys(v.audits), ['logo'])
    assert.equal(v.audits.logo.findings.length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
