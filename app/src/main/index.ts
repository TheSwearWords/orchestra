import { app, dialog, net, protocol, screen, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { Conductor, GENERAL, handoffFile, readChat, readLog } from './conductor'
import { readSelection, saveSelection } from './deliverables'
import { interpret, readInterpretation } from './interpret'
import { loadLibrary } from './library'
import { foundationOrder } from './plan'
import { listOutputs, outputPath } from './outputs'
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

// The Orchestrator: one Claude session per project, its replies broadcast to every window.
const conductor = new Conductor({
  emit: (e) => {
    for (const w of BrowserWindow.getAllWindows())
      if (!w.isDestroyed()) w.webContents.send('chat:event', e)
  },
  systemPrompt: async (id, chat) => {
    const dir = join(PROJECTS_DIR, id)
    const [lib, rules, projects, selected, handoff] = await Promise.all([
      loadLibrary(ORCHESTRA_HOME),
      readFile(join(ORCHESTRA_HOME, 'library', 'house-rules.md'), 'utf8').catch(() => ''),
      listProjects(PROJECTS_DIR),
      readSelection(dir),
      readFile(join(dir, handoffFile(chat)), 'utf8').catch(() => '')
    ])
    const name = projects.find((p) => p.id === id)?.name ?? id
    const catalogue = lib.musicians.map((m) => `- ${m.id}: ${m.name}. ${m.deliverable}`).join('\n')
    const focus = lib.musicians.find((m) => m.id === chat)
    const needs = focus
      ? foundationOrder(lib.musicians, lib.instruments, [focus.id]).map((f) => f.name)
      : []
    const thisChat =
      chat === GENERAL
        ? `## This chat: General
This is the project's General chat: the whole project, its overall plan, and adding deliverables. Each chosen deliverable also has its own chat in Orchestra, where its detailed work happens; when the user goes deep on one deliverable, suggest continuing in that deliverable's chat.`
        : focus
          ? `## This chat: ${focus.name}
This chat is only about the ${focus.name} deliverable (id ${focus.id}): ${focus.deliverable} Its Musician is defined in ${join(ORCHESTRA_HOME, 'library', 'musicians', `${focus.id}.md`)}. Shared foundations it needs first: ${needs.join(', ') || 'none'}. Keep to this deliverable. If the user brings up another deliverable, say it belongs in that deliverable's chat (or in the General chat if it isn't chosen yet).`
          : ''
    return [
      lib.orchestrator?.prompt ?? '',
      rules,
      thisChat,
      `## This project
You are working in the project "${name}"; your current directory is its folder. Read concept.md, research.md and deliverables.md before planning, and read deliverables.md again whenever the plan matters: the user can change it at any time. The agent library (Musicians and Instruments, as markdown) is at ${join(ORCHESTRA_HOME, 'library')}.

Deliverables chosen so far: ${selected.length ? selected.join(', ') : 'none yet'}.

## The conversation is open-ended
The user may start with no deliverables, add more at any point, or just think out loud with you. When they want something that one of the library's deliverables covers and it isn't chosen yet, say so, and end your reply with exactly one line of this form (ids from the list below, comma-separated):
Suggest deliverables: website, slide-deck
Orchestra turns that line into an "Add to deliverables" button; nothing is added until the user clicks it. If nothing in the library fits, say so and describe the Musician you would propose instead.

Library deliverables (id: name):
${catalogue}

## What you can do in this version of Orchestra
You can talk with the user, read files, and write files inside the project folder. Briefing Musicians is not connected yet: plan the work with the user, and say plainly that the Musicians start once that is connected. Never say a Musician or Instrument is working. Write foundation files into prereqs/ only when the user asks you to.`,
      handoff &&
        `## Your handoff note from the previous session (${handoffFile(chat)})
You wrote this before your last session ended. Continue from it.

${handoff}`
    ]
      .filter(Boolean)
      .join('\n\n')
  },
  model: async () => (await loadLibrary(ORCHESTRA_HOME)).orchestrator?.model ?? 'opus',
  extraDirs: [join(ORCHESTRA_HOME, 'library')]
})

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
    ...(process.platform === 'linux' ? { icon } : {}),
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

app.whenReady().then(() => {
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

  // Right-click on a project. Opening and deleting happen here; renaming is answered with
  // 'rename' so the sidebar can edit the name in place.
  ipcMain.handle('projects:menu', (e, id: string, name: string) => {
    const dir = projectDir(id)
    const win = BrowserWindow.fromWebContents(e.sender)!
    return new Promise<'rename' | 'side' | 'opened' | 'deleted' | null>((resolve) => {
      Menu.buildFromTemplate([
        { label: 'Rename', click: () => resolve('rename') },
        { label: 'Open to the side', click: () => resolve('side') },
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
  ipcMain.handle('research:interpret', (_, project: string) => interpret(projectDir(project)))
  ipcMain.handle('sites:add', (_, site: Site) => addSite(ORCHESTRA_HOME, site))

  ipcMain.handle('create:load', async (_, project: string) => {
    const dir = projectDir(project)
    const [lib, selected] = await Promise.all([loadLibrary(ORCHESTRA_HOME), readSelection(dir)])
    return { musicians: lib.musicians, instruments: lib.instruments, selected }
  })
  ipcMain.handle('create:save', async (_, project: string, ids: string[]) =>
    saveSelection(projectDir(project), await loadLibrary(ORCHESTRA_HOME), ids)
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
  ipcMain.handle('chat:load', async (_, project: string, chat: string) => ({
    messages: await readChat(projectDir(project), chat),
    log: await readLog(projectDir(project), chat),
    busy: conductor.isBusy(project, chat)
  }))
  ipcMain.handle('chat:send', (_, project: string, chat: string, text: string) =>
    conductor.send(project, chat, projectDir(project), String(text))
  )
  ipcMain.handle('chat:stop', (_, project: string, chat: string) =>
    conductor.stop(project, chat, projectDir(project))
  )
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
