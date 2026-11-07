import { app, dialog, net, protocol, screen, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Conductor, GENERAL, STUDIO, readChat, readLog } from './conductor'
import { agentPrompt, orchestratorPrompt, studioPrompt } from './prompts'
import { readSelection, saveSelection } from './deliverables'
import { interpret, readInterpretation } from './interpret'
import { onPath, providerStatus } from './connections'
import { readSetup, saveSetup } from './setup'
import {
  agentFile,
  checkLibrary,
  editAgent,
  loadLibrary,
  newInstrument,
  parseDoc,
  setField,
  type EditKey,
  type Role
} from './library'
import { runnableOrThrow } from './providers'
import { listOutputs, outputPath } from './outputs'
import { adopt } from './proposals'
import { graphs } from './graph'
import { ORCHESTRA_HOME, PROJECTS_DIR } from './paths'
import { createProject, editProject, listProjects, renameProject, type Project } from './projects'
import {
  addFiles,
  addLink,
  addSite,
  FILE_TYPES,
  listReferences,
  listSites,
  referenceFilePath,
  removeReference,
  updateReference,
  type Site,
  type Tag
} from './research'

// Create's agents: each chat's Orchestrator, and the Musicians and Instruments it sets to work.
// Their events go to every window; each window filters by project and chat.
// Each project's knowledge graph and the vault's, rebuilt in the background as work happens
const knowledge = graphs({
  home: ORCHESTRA_HOME,
  projectDir: (id) => projectDir(id),
  projects: async () => (await listProjects(PROJECTS_DIR)).map((p) => p.id)
})

const conductor = new Conductor({
  emit: (e) => {
    for (const w of BrowserWindow.getAllWindows())
      if (!w.isDestroyed()) w.webContents.send('chat:event', e)
    // a turn ended: the project may have new notes or files for its graph
    if (e.kind === 'busy' && !e.busy && e.project !== STUDIO) knowledge.touch(e.project)
  },
  queryGraph: (project, question) => knowledge.query(project, question),
  projectDir: (id) => chatHome(id),
  library: () => loadLibrary(ORCHESTRA_HOME),
  selected: (dir) => readSelection(dir),
  orchestratorModel: async () => {
    const o = (await loadLibrary(ORCHESTRA_HOME)).orchestrator
    if (o) runnableOrThrow(o)
    return o?.model ?? 'opus'
  },
  orchestratorPrompt: (id, chat) =>
    id === STUDIO
      ? studioPrompt(ORCHESTRA_HOME, PROJECTS_DIR)
      : orchestratorPrompt(ORCHESTRA_HOME, PROJECTS_DIR, id, chat),
  agentPrompt: (id, key) => agentPrompt(ORCHESTRA_HOME, PROJECTS_DIR, id, key),
  // the Studio's Orchestrator reads across every project
  extraDirs: (id) => [join(ORCHESTRA_HOME, 'library'), ...(id === STUDIO ? [PROJECTS_DIR] : [])],
  adopt: (p) => adopt(ORCHESTRA_HOME, p),
  addDeliverable: async (dir, id) => {
    const lib = await loadLibrary(ORCHESTRA_HOME)
    await saveSelection(dir, lib, [...new Set([...(await readSelection(dir)), id])])
  }
})

/** Where a chat lives: a project's folder, or the Studio's own (Orchestra/studio/) for the
 * chat above every project. */
function chatHome(id: string): string {
  if (id !== STUDIO) return projectDir(id)
  const dir = join(ORCHESTRA_HOME, 'studio')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** A project's folder, refusing ids that could point outside the vault. */
function projectDir(id: string): string {
  const dir = join(PROJECTS_DIR, id)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || !existsSync(dir)) throw new Error('Unknown project.')
  return dir
}

// Must be registered before the app is ready; "standard" makes orchestra://ref/a/b parse
// with a host and path like https URLs do.
protocol.registerSchemesAsPrivileged([
  { scheme: 'orchestra', privileges: { standard: true, secure: true } }
])

// Where the cursor sits on a torn-off window: over its tab strip, as if still holding the tab
const GRIP = { x: 300, y: 20 }
// How far down a window's content its tab strip reaches, for dropping a dragged tab onto it
const STRIP_DEPTH = 48

/** Opens an Orchestra window; with a project id it opens on that project (passed in the URL hash),
 * and with a screen point (a tab dragged out of a window) it opens there. */
function createWindow(
  project?: string,
  at?: { x: number; y: number; width?: number; height?: number }
): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: Math.round(at?.width ?? 1440),
    height: Math.round(at?.height ?? 900),
    ...(at ? { x: Math.round(at.x) - GRIP.x, y: Math.round(at.y) - GRIP.y } : {}),
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#FFFFFF',
    title: 'Orchestra',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Links (reference sites, Figma files) open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const hash = project ? `project=${encodeURIComponent(project)}` : ''
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + (hash && `#${hash}`))
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
  return mainWindow
}

/** The other Orchestra window whose tab strip is under a screen point, if any. */
function stripUnder(point: { x: number; y: number }, except: BrowserWindow): BrowserWindow | null {
  return (
    BrowserWindow.getAllWindows().find((w) => {
      if (w === except || w.isDestroyed() || !w.isVisible()) return false
      const b = w.getContentBounds()
      return (
        point.x >= b.x && point.x < b.x + b.width && point.y >= b.y && point.y < b.y + STRIP_DEPTH
      )
    }) ?? null
  )
}

// A tab being dragged outside its window. The window under the cursor (a new one torn off for
// the tab, or the tab's own window when it was the only tab) follows the cursor until release.
let drag: {
  project: string
  follower: BrowserWindow
  created: boolean // torn off for this drag, so closed if the drag is cancelled or merged
  grip: { x: number; y: number }
  target: BrowserWindow | null
  timer: NodeJS.Timeout
} | null = null

function endDrag(): void {
  if (!drag) return
  clearInterval(drag.timer)
  if (!drag.follower.isDestroyed()) drag.follower.setOpacity(1)
  drag = null
}

/** Tells every Orchestra window except `except` whether a tab could be dropped on it now:
 * 'ready' while any tab is being dragged, 'over' for the one under the cursor, null after. */
function dropState(state: 'ready' | null, except?: BrowserWindow): void {
  for (const w of BrowserWindow.getAllWindows())
    if (w !== except && !w.isDestroyed()) w.webContents.send('drop:state', state)
}

app.whenReady().then(async () => {
  await conductor.init() // Orchestra's tool server for agents
  electronApp.setAppUserModelId('com.orchestra.app')

  // F12 opens DevTools in development; Ctrl+R is ignored in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('window:open', (_, project?: string) => {
    if (project !== undefined) projectDir(project) // only real projects
    createWindow(project)
  })

  // Tear-off: a tab dragged past its window's edge. `alone` means it was the window's only
  // tab, so the window itself follows the cursor instead of a new one.
  ipcMain.handle(
    'drag:start',
    (e, project: string, at: { x: number; y: number; width: number; height: number }, alone) => {
      projectDir(project)
      if (![at.x, at.y, at.width, at.height].every(Number.isFinite)) throw new Error('Bad point.')
      endDrag()
      const own = BrowserWindow.fromWebContents(e.sender)!
      const follower = alone ? own : createWindow(project, at)
      const [wx, wy] = own.getPosition()
      const grip = alone ? { x: at.x - wx, y: at.y - wy } : GRIP
      const timer = setInterval(() => {
        if (!drag || drag.follower.isDestroyed()) return endDrag()
        const p = screen.getCursorScreenPoint()
        drag.follower.setPosition(Math.round(p.x - drag.grip.x), Math.round(p.y - drag.grip.y))
        // over another window's tab strip: dropping here merges, so show the window as see-through
        const target = stripUnder(p, drag.follower)
        if (target !== drag.target) {
          drag.follower.setOpacity(target ? 0.55 : 1)
          if (drag.target && !drag.target.isDestroyed())
            drag.target.webContents.send('drop:state', 'ready')
          target?.webContents.send('drop:state', 'over')
        }
        drag.target = target
      }, 16)
      drag = { project, follower, created: !alone, grip, target: null, timer }
    }
  )
  // A tab started moving in some window: the others show they can take it. Disarm when the
  // drag ends without leaving its window.
  ipcMain.handle('drag:arm', (e) => dropState('ready', BrowserWindow.fromWebContents(e.sender)!))
  ipcMain.handle('drag:disarm', () => dropState(null))
  // Back inside the window it came from before release: the torn-off window goes away, and the
  // tab is still being dragged inside that window, so the others stay ready.
  ipcMain.handle('drag:cancel', () => {
    if (drag?.created && !drag.follower.isDestroyed()) drag.follower.close()
    if (drag?.target && !drag.target.isDestroyed())
      drag.target.webContents.send('drop:state', 'ready')
    endDrag()
  })
  // Released. Over another window's tab strip, the tab joins that window and the dragged window
  // closes; anywhere else, the window stays where it was dropped.
  ipcMain.handle('drag:end', (): 'merged' | 'placed' => {
    if (!drag) return 'placed'
    const { project, follower, target } = drag
    endDrag()
    dropState(null)
    if (target && !target.isDestroyed()) {
      target.webContents.send('tabs:adopt', project)
      target.focus()
      if (!follower.isDestroyed()) follower.close()
      return 'merged'
    }
    if (!follower.isDestroyed()) follower.focus()
    return 'placed'
  })

  // A native context menu built from the renderer's items; resolves to the chosen id, or null.
  ipcMain.handle(
    'menu:popup',
    (e, items: { id: string; label: string; enabled?: boolean; separator?: boolean }[]) => {
      const win = BrowserWindow.fromWebContents(e.sender)!
      return new Promise<string | null>((resolve) => {
        Menu.buildFromTemplate(
          items.map((it) =>
            it.separator
              ? { type: 'separator' as const }
              : {
                  label: String(it.label),
                  enabled: it.enabled !== false,
                  click: () => resolve(String(it.id))
                }
          )
        ).popup({ window: win, callback: () => setTimeout(() => resolve(null), 200) })
      })
    }
  )
  ipcMain.handle('projects:list', () => listProjects(PROJECTS_DIR))
  ipcMain.handle(
    'projects:edit',
    (_, id: string, change: { name?: string; client?: string; concept?: string }) => {
      projectDir(id)
      if (change.name !== undefined && !String(change.name).trim())
        throw new Error('Give the project a name.')
      return editProject(PROJECTS_DIR, id, {
        name: change.name === undefined ? undefined : String(change.name),
        client: change.client === undefined ? undefined : String(change.client),
        concept: change.concept === undefined ? undefined : String(change.concept)
      })
    }
  )
  ipcMain.handle('projects:rename', (_, id: string, name: string) => {
    projectDir(id)
    return renameProject(PROJECTS_DIR, id, name)
  })

  // Right-click on a cover. Opening a window and deleting happen here; Enter and Edit are
  // answered so the Studio can play the opening or zoom into the cover editor.
  ipcMain.handle('projects:menu', (e, id: string, name: string) => {
    const dir = projectDir(id)
    const win = BrowserWindow.fromWebContents(e.sender)!
    return new Promise<'enter' | 'edit' | 'opened' | 'deleted' | null>((resolve) => {
      Menu.buildFromTemplate([
        { label: 'Enter project', click: () => resolve('enter') },
        { label: 'Edit project', click: () => resolve('edit') },
        {
          label: 'Open in new window',
          click: () => {
            createWindow(id)
            resolve('opened')
          }
        },
        { type: 'separator' },
        {
          label: 'Delete…',
          click: async () => {
            const { response } = await dialog.showMessageBox(win, {
              type: 'warning',
              message: `Move “${name}” to the Recycle Bin?`,
              detail:
                'Its references, research and deliverables go with it. You can restore it from the Recycle Bin.',
              buttons: ['Move to Recycle Bin', 'Cancel'],
              defaultId: 1,
              cancelId: 1
            })
            if (response !== 0) return resolve(null)
            await shell.trashItem(dir)
            resolve('deleted')
          }
        }
      ]).popup({
        window: win,
        // closing without a choice; a click resolves first, so this is ignored then
        callback: () => setTimeout(() => resolve(null), 200)
      })
    })
  })
  // The Studio's arrangement: where each cover sits, and the free labels.
  const studioFile = join(ORCHESTRA_HOME, 'studio.json')
  ipcMain.handle('studio:load', async () => {
    try {
      return JSON.parse(await readFile(studioFile, 'utf8'))
    } catch {
      return { covers: {}, labels: [] } // none yet, or unreadable: the default layout
    }
  })
  ipcMain.handle('studio:save', (_, layout: unknown) => {
    const l = layout as { covers?: unknown; labels?: unknown }
    const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
    const covers = Object.entries((l?.covers ?? {}) as Record<string, unknown>).filter(
      ([, v]) => Array.isArray(v) && v.length === 3 && v.every(num)
    )
    const labels = (Array.isArray(l?.labels) ? l.labels : []).filter(
      (b: { x?: unknown; y?: unknown; text?: unknown }) =>
        num(b?.x) && num(b?.y) && typeof b?.text === 'string'
    )
    const out = { covers: Object.fromEntries(covers), labels }
    return writeFile(studioFile, JSON.stringify(out, null, 2) + '\n')
  })
  // A board's arrangement (an area's or a deliverable's): each card's place, size and whether
  // it is collapsed. One file per board, so boards saved at once never overwrite each other.
  const boardFile = (project: string, board: string): string => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(board)) throw new Error('Unknown board.')
    // the Studio's own boards (first-time setup) live in studio/, beside its chat
    const dir = project === STUDIO ? join(ORCHESTRA_HOME, 'studio') : projectDir(project)
    return join(dir, 'boards', `${board}.json`)
  }
  ipcMain.handle('board:load', async (_, project: string, board: string) => {
    try {
      return JSON.parse(await readFile(boardFile(project, board), 'utf8'))
    } catch {
      return {} // none yet: the board's default layout
    }
  })
  ipcMain.handle('board:save', async (_, project: string, board: string, layout: unknown) => {
    const file = boardFile(project, board)
    const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
    const cards = Object.entries((layout ?? {}) as Record<string, Record<string, unknown>>)
      .filter(([id, c]) => /^[\w-]+$/.test(id) && num(c?.x) && num(c?.y) && num(c?.w))
      .map(([id, c]) => [
        id,
        { x: c.x, y: c.y, w: c.w, ...(num(c.h) ? { h: c.h } : {}), collapsed: c.collapsed === true }
      ])
    await mkdir(join(file, '..'), { recursive: true })
    return writeFile(file, JSON.stringify(Object.fromEntries(cards), null, 2) + '\n')
  })
  ipcMain.handle('projects:create', (_, input: Omit<Project, 'id'>) =>
    createProject(PROJECTS_DIR, input)
  )

  ipcMain.handle('research:load', async (_, project: string) => {
    const dir = projectDir(project)
    const [references, interpretation, sites] = await Promise.all([
      listReferences(dir),
      readInterpretation(dir),
      listSites(ORCHESTRA_HOME)
    ])
    return { references, interpretation, sites }
  })
  ipcMain.handle(
    'research:addLink',
    (_, project: string, input: { url: string; note: string; tag: Tag }) =>
      addLink(projectDir(project), input)
  )
  ipcMain.handle('research:addFiles', (_, project: string, paths: string[]) =>
    addFiles(projectDir(project), paths)
  )
  ipcMain.handle('research:pickFiles', async (e, project: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const { filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images and PDFs', extensions: FILE_TYPES }]
    })
    return addFiles(projectDir(project), filePaths)
  })
  ipcMain.handle(
    'research:update',
    (_, project: string, id: string, change: { note?: string; tag?: Tag }) =>
      updateReference(projectDir(project), id, change)
  )
  ipcMain.handle('research:remove', (_, project: string, id: string) =>
    removeReference(projectDir(project), id)
  )
  ipcMain.handle('research:openFile', async (_, project: string, file: string) => {
    const error = await shell.openPath(referenceFilePath(projectDir(project), file))
    if (error) throw new Error(error)
  })
  ipcMain.handle('research:interpret', async (_, project: string) => {
    const result = await interpret(projectDir(project))
    knowledge.touch(project) // research.md is the graph's best source
    return result
  })
  ipcMain.handle('graph:status', (_, project: string) => {
    projectDir(project)
    return knowledge.status(project)
  })
  // the Knowledge window: a graph to draw (a project's, or every project's), and builds on demand
  ipcMain.handle('graph:load', (_, project: string | null) => {
    if (project !== null) projectDir(project)
    return knowledge.load(project)
  })
  ipcMain.handle('graph:build', async (_, project: string | null) => {
    const ids = project === null ? (await listProjects(PROJECTS_DIR)).map((p) => p.id) : [project]
    ids.forEach((id) => {
      projectDir(id)
      knowledge.touch(id)
    })
  })
  ipcMain.handle('sites:add', (_, site: Site) => addSite(ORCHESTRA_HOME, site))

  ipcMain.handle('create:load', async (_, project: string) => {
    const dir = projectDir(project)
    const [lib, selected] = await Promise.all([loadLibrary(ORCHESTRA_HOME), readSelection(dir)])
    return { musicians: lib.musicians, instruments: lib.instruments, selected }
  })
  ipcMain.handle('create:save', async (_, project: string, ids: string[]) => {
    const saved = await saveSelection(projectDir(project), await loadLibrary(ORCHESTRA_HOME), ids)
    knowledge.touch(project)
    return saved
  })

  // The Agents screen: the whole library, raw agent files, and the fields it edits in place.
  ipcMain.handle('agents:load', async () => {
    const library = await loadLibrary(ORCHESTRA_HOME)
    return { library, problems: checkLibrary(library) }
  })
  ipcMain.handle('agents:read', (_, role: Role, id: string) =>
    readFile(agentFile(ORCHESTRA_HOME, role, id), 'utf8')
  )
  ipcMain.handle('agents:write', async (_, role: Role, id: string, text: string) => {
    const file = agentFile(ORCHESTRA_HOME, role, id)
    if (!existsSync(file)) throw new Error('That agent file no longer exists.')
    if (!parseDoc(text)) throw new Error('Keep the --- front matter at the top of the file.')
    await writeFile(file, text)
  })
  ipcMain.handle('agents:set', async (_, role: Role, id: string, key: string, value: unknown) => {
    const file = agentFile(ORCHESTRA_HOME, role, id)
    const md = await readFile(file, 'utf8')
    if (key === 'instruments') {
      if (!Array.isArray(value) || !value.every((v) => /^[\w-]+$/.test(String(v))))
        throw new Error('Not a list of Instrument ids.')
      return writeFile(file, setField(md, 'instruments', value.map(String)))
    }
    if (!['name', 'description', 'runsOn'].includes(key)) throw new Error(`Can't set ${key}.`)
    await writeFile(file, editAgent(md, role, key as EditKey, String(value)))
  })
  ipcMain.handle('providers:status', () => providerStatus())
  // first-time setup, plus what this machine already has, so the cards can say so
  ipcMain.handle('setup:load', async () => ({
    setup: await readSetup(ORCHESTRA_HOME),
    home: ORCHESTRA_HOME,
    gh: onPath('gh'),
    obsidian:
      onPath('obsidian') ||
      existsSync(join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Obsidian', 'Obsidian.exe'))
  }))
  ipcMain.handle('setup:save', (_, v: unknown) => saveSetup(ORCHESTRA_HOME, v))
  ipcMain.handle('agents:newInstrument', (_, musician: string) =>
    newInstrument(ORCHESTRA_HOME, String(musician))
  )

  // A project's chats: General, then one per chosen deliverable, in library order. A deliverable
  // taken out of the plan keeps its history on disk and comes back if it's chosen again.
  ipcMain.handle('chats:list', async (_, project: string) => {
    const dir = projectDir(project)
    const [lib, selected] = await Promise.all([loadLibrary(ORCHESTRA_HOME), readSelection(dir)])
    const chats = [
      { id: GENERAL, title: 'General', icon: 'chat-3-line', deliverable: false },
      ...lib.musicians
        .filter((m) => selected.includes(m.id))
        .map((m) => ({ id: m.id, title: m.name, icon: m.icon, deliverable: true }))
    ]
    return Promise.all(
      chats.map(async (c) => {
        const messages = await readChat(dir, c.id)
        return {
          ...c,
          busy: conductor.isBusy(project, c.id),
          count: messages.filter((m) => m.role !== 'note').length,
          last: messages.filter((m) => m.role !== 'note').at(-1) ?? null
        }
      })
    )
  })
  // The bar's conversations with the Orchestrator: General, then each new one ("t-…"), the
  // latest first. Deliverables' chats belong to their windows on the stage, not here.
  ipcMain.handle('chats:threads', async (_, project: string) => {
    const dir = chatHome(project)
    const ids = await readdir(join(dir, '.orchestra', 'chats')).catch(() => [] as string[])
    const threads = await Promise.all(
      [GENERAL, ...ids.filter((id) => id.startsWith('t-'))].map(async (id) => {
        const messages = (await readChat(dir, id)).filter((m) => m.role !== 'note')
        const first = messages.find((m) => m.role === 'user')?.text.replace(/\s+/g, ' ')
        return {
          id,
          title: id === GENERAL ? 'General' : (first?.slice(0, 64) ?? 'New conversation'),
          count: messages.length,
          updated: messages.at(-1)?.t ?? '',
          busy: conductor.isBusy(project, id)
        }
      })
    )
    return [threads[0], ...threads.slice(1).sort((a, b) => b.updated.localeCompare(a.updated))]
  })
  ipcMain.handle('chat:load', async (_, project: string, chat: string) => ({
    messages: await readChat(chatHome(project), chat),
    log: await readLog(chatHome(project), chat),
    busy: conductor.isBusy(project, chat)
  }))
  ipcMain.handle('chat:send', (_, project: string, chat: string, text: string) => {
    chatHome(project)
    return conductor.send(project, chat, String(text))
  })
  ipcMain.handle('chat:stop', (_, project: string, chat: string) => {
    chatHome(project)
    return conductor.stop(project, chat)
  })
  ipcMain.handle('proposals:list', (_, project: string) => {
    projectDir(project)
    return conductor.proposals(project)
  })
  ipcMain.handle(
    'proposal:decide',
    (_, project: string, chat: string, id: string, approve: boolean) => {
      projectDir(project)
      return conductor.decide(project, chat, String(id), approve === true)
    }
  )
  ipcMain.handle('asks:list', (_, project: string) => {
    projectDir(project)
    return conductor.asks(project)
  })
  ipcMain.handle('ask:answer', (_, project: string, id: string, text: string, final: boolean) => {
    projectDir(project)
    return conductor.answerWindow(project, String(id), String(text), final === true)
  })
  ipcMain.handle('agents:states', (_, project: string) => {
    projectDir(project)
    return conductor.agentStates(project)
  })
  ipcMain.handle('create:outputs', (_, project: string) => listOutputs(projectDir(project)))
  ipcMain.handle('create:openOutput', async (_, project: string, rel: string) => {
    const error = await shell.openPath(outputPath(projectDir(project), String(rel)))
    if (error) throw new Error(error)
  })

  // orchestra://ref/<project>/<file> serves uploaded reference files for thumbnails, and
  // nothing else: both parts are validated by projectDir and referenceFilePath.
  protocol.handle('orchestra', (req) => {
    try {
      const { host, pathname } = new URL(req.url)
      const [project, file] = pathname.slice(1).split('/').map(decodeURIComponent)
      if (host !== 'ref') throw new Error()
      return net.fetch(pathToFileURL(referenceFilePath(projectDir(project), file)).href)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => conductor.stopAll())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
