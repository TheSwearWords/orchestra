// The in-app browser: one web page per Orchestra window, drawn by Electron over the space the
// renderer's browser panel leaves for it (BrowserPanel.tsx). The page runs sandboxed, in its own
// session, with no access to the app: it can't open windows, ask for permissions or leave http.
import { BrowserWindow, WebContentsView, session, shell } from 'electron'

export interface PageState {
  url: string
  title: string
  back: boolean
  forward: boolean
  loading: boolean
}

const PARTITION = 'persist:browser' // cookies and logins kept apart from the app's own
const views = new Map<BrowserWindow, WebContentsView>()
export const isWeb = (url: string): boolean => /^https?:\/\//i.test(url)

let guarded = false
function guard(): void {
  if (guarded) return
  guarded = true
  // camera, microphone, location, notifications…: a reference site never needs them
  session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, _p, answer) => answer(false))
}

function viewFor(win: BrowserWindow): WebContentsView {
  const had = views.get(win)
  if (had) return had
  guard()
  const view = new WebContentsView({
    webPreferences: { partition: PARTITION, sandbox: true, contextIsolation: true }
  })
  const page = view.webContents
  // a link meant for a new tab opens in the panel instead
  page.setWindowOpenHandler(({ url }) => {
    if (isWeb(url)) void page.loadURL(url)
    return { action: 'deny' }
  })
  page.on('will-navigate', (e, url) => {
    if (!isWeb(url)) e.preventDefault()
  })
  const report = (): void => {
    if (win.isDestroyed()) return
    const state: PageState = {
      url: page.getURL(),
      title: page.getTitle(),
      back: page.navigationHistory.canGoBack(),
      forward: page.navigationHistory.canGoForward(),
      loading: page.isLoading()
    }
    win.webContents.send('browser:state', state)
  }
  page.on('did-navigate', report)
  page.on('did-navigate-in-page', report)
  page.on('page-title-updated', report)
  page.on('did-start-loading', report)
  page.on('did-stop-loading', report)
  win.contentView.addChildView(view)
  win.once('closed', () => closePage(win))
  views.set(win, view)
  return view
}

/** Shows a web page in the window's panel, at the place the panel last gave. */
export function openPage(win: BrowserWindow, url: string): void {
  if (!isWeb(url)) throw new Error('Only web pages (http or https) open in the browser panel.')
  void viewFor(win).webContents.loadURL(url)
}

/** Where the page goes: the panel's body, in window pixels. */
export function placePage(win: BrowserWindow, r: unknown): void {
  const o = (r ?? {}) as Record<string, unknown>
  const n = (v: unknown): number => (Number.isFinite(v) ? Math.max(0, Math.round(v as number)) : 0)
  views.get(win)?.setBounds({ x: n(o.x), y: n(o.y), width: n(o.width), height: n(o.height) })
}

/** Closes the page for good: its sounds stop and its memory is freed. */
export function closePage(win: BrowserWindow): void {
  const view = views.get(win)
  if (!view) return
  views.delete(win)
  if (!win.isDestroyed()) win.contentView.removeChildView(view)
  view.webContents.close()
}

export function stepPage(win: BrowserWindow, how: unknown): void {
  const page = views.get(win)?.webContents
  if (!page) return
  if (how === 'back') page.navigationHistory.goBack()
  else if (how === 'forward') page.navigationHistory.goForward()
  else if (how === 'reload') page.reload()
  else if (how === 'external' && isWeb(page.getURL())) void shell.openExternal(page.getURL())
}
