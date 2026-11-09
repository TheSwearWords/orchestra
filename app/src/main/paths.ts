import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'

// the folder chosen in setup, kept outside every workspace so it can be found at launch
export const HOME_POINTER = join(homedir(), '.orchestra', 'home')
function chosenHome(): string | undefined {
  try {
    return readFileSync(HOME_POINTER, 'utf8').trim() || undefined
  } catch {
    return undefined
  }
}

// Orchestra's data root: the Obsidian vault that holds projects/. The folder chosen in setup, or
// else the Orchestra/ folder beside app/; ORCHESTRA_HOME overrides both, e.g. for a test root.
export const ORCHESTRA_HOME =
  process.env.ORCHESTRA_HOME ?? chosenHome() ?? resolve(process.cwd(), '..', 'Orchestra')
export const PROJECTS_DIR = join(ORCHESTRA_HOME, 'projects')
