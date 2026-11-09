// How each thing in first-time setup really gets connected. Pure data, shared with the renderer;
// main runs a step only by its id from this list, so the page can't ask for any other command.
import type { ProviderId } from './providers.ts'

export interface SetupStep {
  id: string
  text: string
  // run: Orchestra runs it. terminal: it needs you, so it opens in a terminal.
  // open: a web page. manual: something you do in another app.
  how: 'run' | 'terminal' | 'open' | 'manual'
  cmd?: string
  url?: string
}

export interface ToolRecipe {
  id: string
  mcp: string // its name in `claude mcp list`, lower case
  local?: boolean // runs on this machine: being added is enough, the app needn't be open
  steps: SetupStep[]
}

const remote = (id: string, label: string, url: string): ToolRecipe => ({
  id,
  mcp: id,
  steps: [
    {
      id: `${id}-add`,
      text: `Add ${label} to Claude Code.`,
      how: 'run',
      cmd: `claude mcp add --scope user --transport http ${id} ${url}`
    },
    {
      id: `${id}-auth`,
      text: `Sign in. In the terminal, type /mcp, choose ${id}, choose Authenticate, then allow access in your browser.`,
      how: 'terminal',
      cmd: 'claude'
    }
  ]
})

export const RECIPES: ToolRecipe[] = [
  remote('figma', 'Figma', 'https://mcp.figma.com/mcp'),
  remote('notion', 'Notion', 'https://mcp.notion.com/mcp'),
  remote('elevenlabs', 'ElevenLabs', 'https://api.elevenlabs.io/v1/mcp'),
  {
    id: 'google-drive',
    mcp: 'google drive',
    steps: [
      {
        id: 'google-drive-open',
        text: 'Turn on Google Drive in your Claude connectors.',
        how: 'open',
        url: 'https://claude.ai/settings/connectors'
      }
    ]
  },
  {
    id: 'blender',
    mcp: 'blender',
    local: true,
    steps: [
      {
        id: 'blender-uv',
        text: 'Install uv, which runs the connector. Skip this if you have it.',
        how: 'terminal',
        cmd: 'winget install --id=astral-sh.uv -e'
      },
      {
        id: 'blender-add',
        text: 'Add Blender to Claude Code.',
        how: 'run',
        cmd: 'claude mcp add --scope user blender uvx mcp-for-blender'
      },
      {
        id: 'blender-addon',
        text: 'Copy the add-on into Blender.',
        how: 'terminal',
        cmd: 'uvx mcp-for-blender install-addon'
      },
      {
        id: 'blender-enable',
        text: 'In Blender, open Edit → Preferences → Add-ons and enable Interface: MCP for Blender. Then press N in the 3D viewport, open the MCP for Blender tab and click Start MCP Server.',
        how: 'manual'
      }
    ]
  }
]

export interface Account {
  brand: string
  subscription: string // what signing in with an account is called
  install: SetupStep
  login: SetupStep
  getKey: SetupStep
}

const account = (
  id: ProviderId,
  brand: string,
  subscription: string,
  pkg: string,
  login: string,
  keys: string
): Account => ({
  brand,
  subscription,
  install: {
    id: `${id}-install`,
    text: `Install the ${brand} command line tool.`,
    how: 'terminal',
    cmd: `npm install -g ${pkg}`
  },
  login: { id: `${id}-login`, text: 'Sign in with your account.', how: 'terminal', cmd: login },
  getKey: { id: `${id}-key`, text: 'Create a key.', how: 'open', url: keys }
})

export const ACCOUNTS: Record<ProviderId, Account> = {
  anthropic: account(
    'anthropic',
    'Claude',
    'Claude subscription',
    '@anthropic-ai/claude-code',
    'claude auth login',
    'https://console.anthropic.com/settings/keys'
  ),
  openai: account(
    'openai',
    'ChatGPT',
    'ChatGPT subscription',
    '@openai/codex',
    'codex login',
    'https://platform.openai.com/api-keys'
  ),
  gemini: account(
    'gemini',
    'Gemini',
    'Google account',
    '@google/gemini-cli',
    'gemini',
    'https://aistudio.google.com/apikey'
  )
}

export const GITHUB: { install: SetupStep; login: SetupStep } = {
  install: {
    id: 'gh-install',
    text: 'Install the GitHub command line tool.',
    how: 'terminal',
    cmd: 'winget install --id GitHub.cli -e'
  },
  login: {
    id: 'gh-login',
    text: 'Sign in. Choose GitHub.com, HTTPS, then log in with a web browser.',
    how: 'terminal',
    cmd: 'gh auth login'
  }
}

export const GRAPHIFY: SetupStep = {
  id: 'graphify-install',
  text: 'Install Graphify. It needs Python.',
  how: 'terminal',
  cmd: 'pip install graphifyy'
}

export const SIGN_OUT: SetupStep = {
  id: 'anthropic-logout',
  text: 'Sign Claude Code out on this computer.',
  how: 'run',
  cmd: 'claude auth logout'
}

export const ALL_STEPS: SetupStep[] = [
  SIGN_OUT,
  ...RECIPES.flatMap((r) => r.steps),
  ...Object.values(ACCOUNTS).flatMap((a) => [a.install, a.login, a.getKey]),
  GITHUB.install,
  GITHUB.login,
  GRAPHIFY
]

export const findStep = (id: string): SetupStep | undefined => ALL_STEPS.find((s) => s.id === id)
