// Pictures of the reference library's sites: each landing page, loaded in a window nobody sees,
// in <home>/sites/<host>.png. One at a time, because each is a whole web page.
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { siteHost, type Site } from './research.ts'

const SETTLE_MS = 2500 // for images and fonts after the page says it has loaded
const LOAD_MS = 15_000

export const shotFile = (home: string, url: string): string =>
  join(home, 'sites', `${siteHost(url)}.png`)

async function capture(url: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1440,
    height: 900,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  try {
    win.webContents.setAudioMuted(true)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    await Promise.race([
      win.loadURL(url),
      new Promise((_, no) => setTimeout(() => no(new Error('timed out')), LOAD_MS))
    ])
    await new Promise((r) => setTimeout(r, SETTLE_MS))
    return (await win.webContents.capturePage()).resize({ width: 720 }).toPNG()
  } finally {
    win.destroy()
  }
}

let running = false

/** Takes the pictures still missing. True if any new ones were made. */
export async function captureSites(home: string, sites: Site[]): Promise<boolean> {
  if (running) return false
  running = true
  let made = false
  try {
    await mkdir(join(home, 'sites'), { recursive: true })
    for (const s of sites) {
      const file = shotFile(home, s.url)
      if (existsSync(file)) continue
      try {
        await writeFile(file, await capture(s.url))
        made = true
      } catch (e) {
        // an unreachable site keeps its letter tile
        console.error(`screenshot of ${s.url}:`, (e as Error).message)
      }
    }
  } finally {
    running = false
  }
  return made
}
