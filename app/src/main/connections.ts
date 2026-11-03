import { existsSync } from 'fs'
import { delimiter, join } from 'path'
import { PROVIDERS, type ProviderStatus } from './providers.ts'

/** Whether a command is on PATH, without running it. */
export function onPath(cmd: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : ['']
  return (env.PATH ?? env.Path ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => exts.some((x) => existsSync(join(dir, cmd + x))))
}

/** A provider counts as connected when its API key is set or its CLI is installed. */
export function providerStatus(env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  const out = {} as ProviderStatus
  for (const p of PROVIDERS) {
    const key = p.env.find((k) => env[k])
    out[p.id] = key
      ? { connected: true, via: key }
      : onPath(p.cli, env)
        ? { connected: true, via: `${p.cli} CLI` }
        : { connected: false, via: '' }
  }
  return out
}
