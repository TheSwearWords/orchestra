import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { readChat } from './conductor.ts'
import { listOutputs, outputPath } from './outputs.ts'

test('outputs list prereqs and exports, newest first, and paths stay inside the project', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-out-'))
  try {
    await mkdir(join(dir, 'prereqs', 'logo'), { recursive: true })
    await writeFile(join(dir, 'prereqs', 'brand-spec.md'), '# spec')
    await writeFile(join(dir, 'prereqs', 'logo', 'mark.svg'), '<svg/>')
    await writeFile(join(dir, 'prereqs', '.hidden'), 'x')
    await writeFile(join(dir, 'research.md'), '# r')
    const paths = (await listOutputs(dir)).map((o) => o.path).sort()
    assert.deepEqual(paths, ['prereqs/brand-spec.md', 'prereqs/logo/mark.svg', 'research.md'])
    assert.equal(outputPath(dir, 'prereqs/brand-spec.md'), join(dir, 'prereqs', 'brand-spec.md'))
    assert.throws(() => outputPath(dir, '../elsewhere.md'))
    assert.throws(() => outputPath(dir, 'C:/Windows/win.ini'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('readChat keeps good lines and skips a half-written one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-chat-'))
  try {
    assert.deepEqual(await readChat(dir), [])
    await mkdir(join(dir, '.orchestra'))
    const a = { t: '2026-11-01T10:00:00.000Z', role: 'user', text: 'Hero first.' }
    const b = { t: '2026-11-01T10:00:05.000Z', role: 'orchestrator', text: 'Agreed.' }
    await writeFile(
      join(dir, '.orchestra', 'chat.jsonl'),
      [JSON.stringify(a), JSON.stringify({ role: 'system', text: 'x' }), JSON.stringify(b), '{"t":"2026'].join('\n')
    )
    assert.deepEqual(await readChat(dir), [a, b])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
