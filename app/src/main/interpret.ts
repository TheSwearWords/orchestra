import { spawn } from 'child_process'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { listReferences, type Reference } from './research'

// Interpret: the Orchestrator reads the concept and every reference (looking at uploaded
// images, opening links) and writes research.md, its reading of what the user is after.
// One headless Claude Code call; the app writes the file, so Claude only gets read tools.

const TIMEOUT_MS = 5 * 60 * 1000

export function interpretPrompt(concept: string, refs: Reference[]): string {
  const lines = refs.map((r, i) => {
    const where = r.kind === 'link' ? r.source : `references/files/${r.source}`
    const tag = r.tag === 'asset' ? 'usable asset' : 'inspiration'
    return `${i + 1}. ${where} (${tag})\n   What I like: ${r.note || '(no note)'}`
  })
  return `You are the Orchestrator in Orchestra, a design tool. Before any design work starts, read
this project's research and write down what the user is really after.

Project concept (concept.md):
${concept.trim() || '(not written yet)'}

References, with the user's own notes:
${lines.join('\n')}

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

export async function interpret(project: string): Promise<string> {
  const refs = await listReferences(project)
  if (refs.length === 0) throw new Error('Add at least one reference first.')
  const concept = await readFile(join(project, 'concept.md'), 'utf8').catch(() => '')
  const body = await runClaude(interpretPrompt(concept, refs), project)
  const md = `# Research interpretation\n\n_Written by the Orchestrator from ${refs.length} reference${refs.length === 1 ? '' : 's'} on ${new Date().toISOString().slice(0, 10)}._\n\n${body}\n`
  await writeFile(join(project, 'research.md'), md)
  return md
}
