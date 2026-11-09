import { spawn } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { outputFor, readBoxes, refsFor } from './interprets.ts'
import { listReferences, readGroups, type Groups, type Reference } from './research.ts'

// Interpret: the Orchestrator reads the concept and every reference (looking at uploaded
// images, opening links) and writes research.md, its reading of what the user is after.
// One headless Claude Code call; the app writes the file, so Claude only gets read tools.

const TIMEOUT_MS = 5 * 60 * 1000

export function interpretPrompt(
  concept: string,
  refs: Reference[],
  groups: Groups = { default: null, others: [], kinds: {} }
): string {
  const line = (r: Reference, i: number): string => {
    if (r.kind === 'text') return `${i + 1}. Written by the user:\n   ${r.note}`
    const where = r.kind === 'link' ? r.source : `references/files/${r.source}`
    const tag = r.tag === 'asset' ? 'usable asset' : 'inspiration'
    return `${i + 1}. ${where} (${tag})\n   What I like: ${r.note || '(no note)'}`
  }
  // grouped under the names the user gave, which say what part of the project each is for
  const lines = [
    { name: groups.default ?? 'General research', refs: refs.filter((r) => !r.group) },
    ...groups.others.map((name) => ({ name, refs: refs.filter((r) => r.group === name) }))
  ]
    .filter((g) => g.refs.length > 0)
    .map((g) => `Group: ${g.name}\n${g.refs.map(line).join('\n')}`)
  return `You are the Orchestrator in Orchestra, a design tool. Before any design work starts, read
this project's research and write down what the user is really after.

Project concept (concept.md):
${concept.trim() || '(not written yet)'}

References, with the user's own notes, in the groups the user made. A group's name says what
part of the project its references are for, so read them as evidence for that part:
${lines.join('\n\n')}

Look at every reference yourself: Read the image and PDF files, and fetch the links. Weigh
the user's notes most heavily; they say what matters. Then write the interpretation as
markdown with exactly these sections:

## Direction
Two or three sentences: the feeling and point of view the work should have.

## What keeps coming up
Bullets on recurring qualities across references: type, color, composition, imagery, mood.
Name which references show each one.

## Type, color and composition
Concrete starting points for the foundations (typefaces or type traits, palette traits,
layout and grid traits). Flag anything that needs a license.

## Questions for you
Up to three questions where the references disagree or the user's intent is unclear.

Reply with the markdown only, no preamble.`
}

function runClaude(prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'claude',
      ['-p', '--output-format', 'text', '--allowedTools=Read,Glob,WebFetch'],
      { cwd }
    )
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      // taskkill the whole tree on Windows so tool subprocesses die too
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'])
      else proc.kill()
      reject(new Error('The interpretation took longer than 5 minutes and was stopped.'))
    }, TIMEOUT_MS)
    proc.stdout.setEncoding('utf8').on('data', (c: string) => (out += c))
    proc.stderr.setEncoding('utf8').on('data', (c: string) => (err += c))
    proc.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(
        new Error(e.code === 'ENOENT' ? 'Claude Code isn’t installed or isn’t on PATH.' : e.message)
      )
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0 && out.trim()) resolve(out.trim())
      else reject(new Error(err.trim().split('\n').pop() || `Claude exited with code ${code}.`))
    })
    proc.stdin.end(prompt)
  })
}

export async function readInterpretation(project: string): Promise<string | null> {
  return readFile(join(project, 'research.md'), 'utf8').catch(() => null)
}

export async function interpret(project: string, boxId = 'main'): Promise<string> {
  const box = (await readBoxes(project)).find((b) => b.id === boxId)
  if (!box) throw new Error('That Interpret box is gone.')
  const refs = refsFor(await listReferences(project), box)
  if (refs.length === 0) throw new Error('Connect a group with references to this box first.')
  const concept = await readFile(join(project, 'concept.md'), 'utf8').catch(() => '')
  const body = await runClaude(interpretPrompt(concept, refs, await readGroups(project)), project)
  const md = `# Research interpretation\n\n_Written by the Orchestrator from ${refs.length} reference${refs.length === 1 ? '' : 's'} on ${new Date().toISOString().slice(0, 10)}._\n\n${body}\n`
  const out = join(project, outputFor(box.id))
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, md)
  return md
}
