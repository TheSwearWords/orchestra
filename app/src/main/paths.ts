import { join, resolve } from 'path'

// Orchestra's data root: the Obsidian vault that holds projects/. Defaults to the
// Orchestra/ folder beside app/; ORCHESTRA_HOME overrides it, e.g. for a throwaway test root.
export const ORCHESTRA_HOME =
  process.env.ORCHESTRA_HOME ?? resolve(process.cwd(), '..', 'Orchestra')
export const PROJECTS_DIR = join(ORCHESTRA_HOME, 'projects')
