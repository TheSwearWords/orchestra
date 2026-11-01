import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { describeTool, handoffFile, readChat, readLog } from './conductor.ts'
import { listOutputs, outputPath } from './outputs.ts'

test('readChat keeps good lines, skips a half-written one, and refuses odd chat ids', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-chat-'))
  try {
    assert.deepEqual(await readChat(dir, 'website'), [])
    await mkdir(join(dir, '.orchestra', 'chats', 'website'), { recursive: true })
    const a = { t: '2026-11-01T10:00:00.000Z', role: 'user', text: 'Hero first.' }
    const b = { t: '2026-11-01T10:00:05.000Z', role: 'orchestrator', text: 'Agreed.' }
    await writeFile(
      join(dir, '.orchestra', 'chats', 'website', 'chat.jsonl'),
      [
        JSON.stringify(a),
        JSON.stringify({ role: 'system', text: 'x' }),
        JSON.stringify(b),
        '{"t":"2026'
      ].join('\n')
    )
    assert.deepEqual(await readChat(dir, 'website'), [a, b])
    assert.deepEqual(await readLog(dir, 'website'), [])
    await assert.rejects(readChat(dir, '../escape'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the old single conversation becomes the general chat', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'orchestra-migrate-'))
  try {
    const m = { t: '2026-11-01T10:00:00.000Z', role: 'user', text: 'Hello' }
    await mkdir(join(dir, '.orchestra'))
    await writeFile(join(dir, '.orchestra', 'chat.jsonl'), JSON.stringify(m) + '\n')
    await writeFile(join(dir, '.orchestra', 'session.json'), '{"id":"abc"}')
    assert.deepEqual(await readChat(dir, 'general'), [m])
    assert.equal(
      await readFile(join(dir, '.orchestra', 'chats', 'general', 'session.json'), 'utf8'),
      '{"id":"abc"}'
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('agent channel lines and handoff files read plainly', () => {
  assert.equal(
    describeTool('Read', { file_path: 'C:\\v\\projects\\hermes\\concept.md' }),
    'read projects/hermes/concept.md'
  )
  assert.equal(
    describeTool('WebSearch', { query: 'quiet geometry' }),
    'searched the web for "quiet geometry"'
  )
  assert.equal(describeTool('mcp__orchestra__brief_musician'), 'brief musician')
  assert.equal(handoffFile('general'), 'notes/orchestrator.md')
  assert.equal(handoffFile('website'), 'notes/orchestrator-website.md')
})

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
