import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  addManual,
  checkAudit,
  emptyAudit,
  openFindings,
  readAudit,
  saveAudit,
  setStatus,
  signOffCheck
} from './audits.ts'

const finding = (o = {}) => ({ severity: 'medium', note: 'Heading is off the grid.', ...o })

test('a good audit is kept, with ids and status filled in', () => {
  const { audit, problems } = checkAudit({
    score: 71.6,
    findings: [
      finding({ target: { kind: 'figma-node', ref: '12:34' } }),
      finding({ id: 'logo-gap' })
    ]
  })
  assert.deepEqual(problems, [])
  assert.equal(audit.score, 72)
  assert.deepEqual(
    audit.findings.map((f) => [f.id, f.status]),
    [
      ['f1', 'open'],
      ['logo-gap', 'open']
    ]
  )
  assert.deepEqual(audit.findings[0].target, { kind: 'figma-node', ref: '12:34' })
})

test('a bad audit says what is wrong and keeps nothing', () => {
  for (const input of [null, [], 'x', {}, { findings: 'no' }])
    assert.ok(checkAudit(input).problems.length)
  const r = checkAudit({
    score: 130,
    findings: [
      finding({ note: '' }),
      finding({ severity: 'terrible' }),
      finding({ status: 'maybe' }),
      finding({ target: { kind: 'x' } }),
      finding({ id: 'dup' }),
      finding({ id: 'dup' }),
      'nope'
    ]
  })
  assert.equal(r.audit, undefined)
  const text = r.problems.join('\n')
  for (const part of [
    'score',
    'Finding 1 needs',
    'severity',
    'status',
    'target',
    'used twice',
    'must be an object'
  ])
    assert.match(text, new RegExp(part))
  assert.equal(
    checkAudit({ findings: Array.from({ length: 101 }, () => finding()) }).audit,
    undefined
  )
})

test('open findings come worst first, and status changes only that finding', () => {
  let a = checkAudit({
    findings: [
      finding({ id: 'a', severity: 'low' }),
      finding({ id: 'b', severity: 'high' }),
      finding({ id: 'c', severity: 'medium' })
    ]
  }).audit
  assert.deepEqual(
    openFindings(a).map((f) => f.id),
    ['b', 'c', 'a']
  )
  a = setStatus(a, 'b', 'fixed')
  assert.deepEqual(
    openFindings(a).map((f) => f.id),
    ['c', 'a']
  )
  assert.equal(setStatus(a, 'missing', 'fixed'), a)
  assert.deepEqual(
    signOffCheck(a).open.map((f) => f.id),
    ['c', 'a']
  )
  assert.deepEqual(signOffCheck(setStatus(setStatus(a, 'c', 'dismissed'), 'a', 'fixed')).open, [])
})

test('manual findings get their own ids and respect the limits', () => {
  let a = emptyAudit()
  a = addManual(a, '  Kerning on the wordmark  ', 'high')
  a = addManual(a, 'Second note')
  a = addManual(a, '   ')
  assert.deepEqual(
    a.findings.map((f) => [f.id, f.severity, f.note]),
    [
      ['m1', 'high', 'Kerning on the wordmark'],
      ['m2', 'medium', 'Second note']
    ]
  )
})

test('audits are saved per deliverable and read back; a broken file is no audit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-audits-'))
  try {
    assert.deepEqual((await readAudit(dir, 'logo')).findings, [])
    const { audit } = checkAudit({ findings: [finding()] })
    await saveAudit(dir, 'logo', setStatus(audit, 'f1', 'dismissed'))
    const back = await readAudit(dir, 'logo')
    assert.equal(back.findings[0].status, 'dismissed')
    assert.equal(back.updated, (await readAudit(dir, 'logo')).updated)
    await assert.rejects(() => saveAudit(dir, '../logo', audit), /not a deliverable/)
    await assert.rejects(() => readAudit(dir, 'Logo'), /not a deliverable/)
    await mkdir(join(dir, 'audits'), { recursive: true })
    await writeFile(join(dir, 'audits', 'site.json'), '{ nope')
    assert.deepEqual((await readAudit(dir, 'site')).findings, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
