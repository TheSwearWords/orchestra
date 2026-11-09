// The AI providers an agent can run on, and their models. Pure data, shared with the renderer.
// shortcut: model lists are fixed here; upgrade to each provider's model list API when adapters land.

export type ProviderId = 'anthropic' | 'openai' | 'gemini'

export interface ProviderInfo {
  id: ProviderId
  name: string
  models: { id: string; name: string; hint: string }[]
  env: string[] // API key variables that count as connected
  cli: string // the provider's own CLI, which also counts
  connectHint: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      { id: 'opus', name: 'Opus', hint: 'Deepest thinking; the most expensive' },
      { id: 'sonnet', name: 'Sonnet', hint: 'Strong craft at a middle price' },
      { id: 'haiku', name: 'Haiku', hint: 'Fast and cheap, for menial work' }
    ],
    env: ['ANTHROPIC_API_KEY'],
    cli: 'claude',
    connectHint: 'Install Claude Code and sign in, or set ANTHROPIC_API_KEY.'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'gpt-5', name: 'GPT-5', hint: 'Deepest thinking' },
      { id: 'gpt-5-mini', name: 'GPT-5 mini', hint: 'Balanced' },
      { id: 'gpt-5-nano', name: 'GPT-5 nano', hint: 'Fast and cheap' }
    ],
    env: ['OPENAI_API_KEY'],
    cli: 'codex',
    connectHint: 'Install the Codex CLI and sign in, or set OPENAI_API_KEY.'
  },
  {
    id: 'gemini',
    name: 'Gemini',
    models: [
      { id: 'gemini-2.5-pro', name: '2.5 Pro', hint: 'Deepest thinking' },
      { id: 'gemini-2.5-flash', name: '2.5 Flash', hint: 'Balanced' },
      { id: 'gemini-2.5-flash-lite', name: '2.5 Flash-Lite', hint: 'Fast and cheap' }
    ],
    env: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    cli: 'gemini',
    connectHint: 'Install the Gemini CLI and sign in, or set GEMINI_API_KEY.'
  }
]

export const provider = (id: string): ProviderInfo | undefined => PROVIDERS.find((p) => p.id === id)

/** Orchestra runs agents through Claude Code only, so far. */
export const RUNNABLE: ProviderId[] = ['anthropic']

export type ProviderStatus = Record<ProviderId, { connected: boolean; via: string }>

export interface ProviderLink {
  connected: boolean | null // null: still checking this machine
  note: string
  undo?: 'key' | 'account' // what Disconnect removes; none means it isn't Orchestra's to remove
}

/** What Settings says about one provider. `via` is its ProviderStatus.via. */
export function providerLink(
  p: ProviderInfo,
  via: string,
  savedKey: boolean,
  signedIn: boolean | null,
  plan = ''
): ProviderLink {
  const envKey = p.env.includes(via)
  if (savedKey && envKey) {
    const first = p.id === 'anthropic' ? ' It’s used instead of any Claude subscription.' : ''
    return {
      connected: true,
      note: `Using the API key saved on this computer.${first}`,
      undo: 'key'
    }
  }
  if (savedKey)
    return {
      connected: false,
      note: 'The saved key can’t be read on this computer. Disconnect, then add it again.',
      undo: 'key'
    }
  if (envKey)
    return {
      connected: true,
      note: `Using ${via} from this computer’s environment. Change it there.`
    }
  if (signedIn === null) return { connected: null, note: 'Checking…' }
  if (!signedIn) return { connected: false, note: p.connectHint }
  if (p.id === 'anthropic')
    return { connected: true, note: `Signed in${plan ? ` · ${plan}` : ''}`, undo: 'account' }
  return {
    connected: true,
    note: `${p.cli} is installed. Orchestra can’t tell whether you’re signed in.`
  }
}

/** Refuses, with a reason the user can act on, to start an agent on a provider Orchestra can't
 * run yet, instead of passing a foreign model name to Claude Code. */
export function runnableOrThrow(agent: { name: string; provider: string }): void {
  if (RUNNABLE.includes((agent.provider || 'anthropic') as ProviderId)) return
  const p = provider(agent.provider)?.name ?? agent.provider
  throw new Error(
    `${agent.name} is set to run on ${p}, but Orchestra can only run agents on Anthropic so far. Switch it back on the Agents screen.`
  )
}
