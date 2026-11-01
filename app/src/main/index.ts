import { app, dialog, net, protocol, shell, BrowserWindow, ipcMain } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readSelection, saveSelection } from './deliverables'
import { interpret, readInterpretation } from './interpret'
import { loadLibrary } from './library'
import { ORCHESTRA_HOME, PROJECTS_DIR } from './paths'
import { createProject, listProjects, type Project } from './projects'
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

/** Opens an Orchestra window; with a project id it opens on that project (passed in the URL hash). */
function createWindow(project?: string): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
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
  ipcMain.handle('projects:list', () => listProjects(PROJECTS_DIR))
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
