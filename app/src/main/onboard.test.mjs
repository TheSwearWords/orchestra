import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { moveHome, parseClaudeAuth, parseMcpList } from './onboard.ts'
import { ALL_STEPS } from './recipes.ts'
import { EMPTY } from './setup.ts'

test('parseMcpList reads names and statuses, connectors included', () => {
  const found = parseMcpList(`Checking MCP server health…

claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ✔ Connected
claude.ai Cloudflare GraphQL: https://graphql.mcp.cloudflare.com/mcp - ! Needs authentication
figma: https://mcp.figma.com/mcp (HTTP) - ✔ Connected
blender: uvx mcp-for-blender - ✘ Failed to connect`)
  assert.deepEqual(found, {
    'google drive': 'connected',
    'cloudflare graphql': 'auth',
    figma: 'connected',
    blender: 'failed'
  })
})

test('parseClaudeAuth survives output that is not JSON', () => {
  assert.equal(parseClaudeAuth('{"loggedIn":true,"subscriptionType":"pro"}').plan, 'pro')
  assert.equal(parseClaudeAuth('command not found').loggedIn, false)
})

test('setup steps are unique, safe to run without a shell, and link only to https', () => {
  const ids = ALL_STEPS.map((s) => s.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const s of ALL_STEPS) {
    if (s.how === 'run') assert.doesNotMatch(s.cmd, /["'|&;<>]/, s.id)
    if (s.how === 'open') assert.match(s.url, /^https:\/\//, s.id)
  }
})

test('moveHome copies the library, keeps what is there, and writes the pointer', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orch-move-'))
  const from = join(root, 'old')
  const to = join(root, 'new')
  mkdirSync(join(from, 'library'), { recursive: true })
  writeFileSync(join(from, 'library', 'a.md'), 'from old')
  mkdirSync(join(to, 'library'), { recursive: true })
  writeFileSync(join(to, 'library', 'b.md'), 'already here')
  const pointer = join(root, 'dot', 'home')
  await moveHome(from, to, { ...EMPTY, done: true, name: 'A' }, pointer)
  assert.equal(readFileSync(join(to, 'library', 'a.md'), 'utf8'), 'from old')
  assert.equal(readFileSync(join(to, 'library', 'b.md'), 'utf8'), 'already here')
  assert.ok(existsSync(join(to, 'projects')))
  assert.equal(JSON.parse(readFileSync(join(to, 'setup.json'), 'utf8')).name, 'A')
  assert.equal(readFileSync(pointer, 'utf8'), to)
  await assert.rejects(moveHome(from, 'relative/path', EMPTY, pointer))
})
