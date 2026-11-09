// API keys from setup: checked with the provider, encrypted by the OS, kept in the app's own data
// folder and never in the workspace, which can be a git repo. Saved keys go into process.env, so
// the CLIs Orchestra spawns and providerStatus both see them.
import { app, net, safeStorage } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { provider, type ProviderId } from './providers.ts'

type Saved = Partial<Record<ProviderId, string>> // base64 of the encrypted key

const file = (): string => join(app.getPath('userData'), 'keys.json')
const read = (): Promise<Saved> =>
  readFile(file(), 'utf8').then(
    (t) => JSON.parse(t) as Saved,
    () => ({})
  )

const CHECK: Record<ProviderId, (key: string) => [string, Record<string, string>]> = {
  anthropic: (k) => [
    'https://api.anthropic.com/v1/models',
    { 'x-api-key': k, 'anthropic-version': '2023-06-01' }
  ],
  openai: (k) => ['https://api.openai.com/v1/models', { Authorization: `Bearer ${k}` }],
  gemini: (k) => [
    'https://generativelanguage.googleapis.com/v1beta/models',
    { 'x-goog-api-key': k }
  ]
}

export async function loadKeys(): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) return
  for (const [id, enc] of Object.entries(await read())) {
    const p = provider(id)
    if (p && enc) process.env[p.env[0]] = safeStorage.decryptString(Buffer.from(enc, 'base64'))
  }
}

export async function saveKey(id: string, raw: unknown): Promise<void> {
  const p = provider(id)
  const key = typeof raw === 'string' ? raw.trim() : ''
  if (!p || !key || key.length > 500) throw new Error('That doesn’t look like an API key.')
  if (!safeStorage.isEncryptionAvailable())
    throw new Error('This computer can’t encrypt the key, so Orchestra won’t store it.')
  const [url, headers] = CHECK[p.id](key)
  const res = await net.fetch(url, { headers }).catch(() => null)
  if (!res) throw new Error(`Couldn’t reach ${p.name}. Check your connection.`)
  if (res.status === 401 || res.status === 403) throw new Error(`${p.name} refused that key.`)
  if (!res.ok) throw new Error(`${p.name} answered ${res.status}. Try again in a moment.`)
  const saved = await read()
  saved[p.id] = safeStorage.encryptString(key).toString('base64')
  await writeFile(file(), JSON.stringify(saved))
  process.env[p.env[0]] = key
}

export async function forgetKey(id: string): Promise<void> {
  const p = provider(id)
  if (!p) return
  const saved = await read()
  delete saved[p.id]
  await writeFile(file(), JSON.stringify(saved))
  delete process.env[p.env[0]]
}
