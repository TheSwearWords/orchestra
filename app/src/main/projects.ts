import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// A project is a vault folder; its name, client and concept live in concept.md so
// Obsidian and any agent can read them as plain markdown.
export interface Project {
  id: string // folder name
  name: string
  client: string
  concept: string
}

const SUBFOLDERS = ['references', 'prereqs', 'audits']

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseConcept(id: string, md: string): Project {
  const text = md.replace(/^\uFEFF/, '')
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  const fields: Record<string, string> = {}
  for (const line of front?.[1].split(/\r?\n/) ?? []) {
    const m = /^(\w+):\s*(.*)$/.exec(line)
    if (m) fields[m[1]] = m[2].trim()
  }
  const body = front ? text.slice(front[0].length) : text
  const concept = /## Concept\s*\r?\n([\s\S]*?)(?=\r?\n## |$)/.exec(body)?.[1].trim() ?? ''
  return {
    id,
    // folders made outside the app have no front matter: fall back to the folder name
    name: fields.name || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    client: fields.client ?? '',
    concept
  }
}

export function conceptMarkdown(p: Omit<Project, 'id'>): string {
  // one line per field: strip newlines so a pasted value can't break the front matter
  const line = (s: string): string => s.replace(/\s*\r?\n\s*/g, ' ').trim()
  return `---\nname: ${line(p.name)}\nclient: ${line(p.client)}\n---\n\n# ${line(p.name)}\n\n## Concept\n\n${p.concept.trim()}\n`
}

export async function listProjects(dir: string): Promise<Project[]> {
  await mkdir(dir, { recursive: true })
  const entries = await readdir(dir, { withFileTypes: true })
  const projects = await Promise.all(
    entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map(async (e) =>
        parseConcept(
          e.name,
          await readFile(join(dir, e.name, 'concept.md'), 'utf8').catch(() => '')
        )
      )
  )
  return projects.sort((a, b) => a.name.localeCompare(b.name))
}

/** Changes the display name in concept.md. The folder (id) keeps its name so paths and links hold;
 * the rest of the file, including anything written in Obsidian, is left as it was. */
export async function renameProject(dir: string, id: string, name: string): Promise<Project> {
  const clean = name.replace(/\s*\r?\n\s*/g, ' ').trim()
  if (!clean) throw new Error('Give the project a name.')
  const file = join(dir, id, 'concept.md')
  const md = (await readFile(file, 'utf8').catch(() => '')).replace(/^\uFEFF/, '')
  const old = parseConcept(id, md)
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md)
  let next: string
  if (!front) next = `---\nname: ${clean}\nclient: \n---\n\n${md}`
  else {
    const fields = /^name:.*$/m.test(front[1])
      ? front[1].replace(/^name:.*$/m, `name: ${clean}`)
      : `name: ${clean}\n${front[1]}`
    next = `---\n${fields}\n---\n` + md.slice(front[0].length)
  }
  // the title heading follows the name only while it still matches the old one
  next = next.replace(
    new RegExp(`^# ${old.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm'),
    `# ${clean}`
  )
  await writeFile(file, next)
  return parseConcept(id, next)
}

export async function createProject(dir: string, input: Omit<Project, 'id'>): Promise<Project> {
  const name = input.name.trim()
  const base = slugify(name)
  if (!base) throw new Error('Give the project a name with at least one letter or number.')
  const taken = new Set(await readdir(dir).catch(() => [] as string[]))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`

  const root = join(dir, id)
  await Promise.all(SUBFOLDERS.map((f) => mkdir(join(root, f), { recursive: true })))
  const project = { name, client: input.client.trim(), concept: input.concept }
  await writeFile(join(root, 'concept.md'), conceptMarkdown(project))
  return { id, ...project, concept: project.concept.trim() }
}
