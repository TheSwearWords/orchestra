import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Project } from '../main/projects'
import type { Instrument, Musician } from '../main/library'
import type { Reference, Site, Tag } from '../main/research'

export type { Instrument, Musician, Project, Reference, Site, Tag }

export interface ResearchState {
  references: Reference[]
  interpretation: string | null
  sites: Site[]
}

export interface CreateState {
  musicians: Musician[]
  instruments: Instrument[]
  selected: string[] // deliverable (Musician) ids saved in deliverables.md
}

const api = {
  openWindow: (project?: string, at?: { x: number; y: number }): Promise<void> =>
    ipcRenderer.invoke('window:open', project, at),
  menu: (
    items: { id: string; label: string; enabled?: boolean; separator?: boolean }[]
  ): Promise<string | null> => ipcRenderer.invoke('menu:popup', items),
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
  renameProject: (id: string, name: string): Promise<Project> =>
    ipcRenderer.invoke('projects:rename', id, name),
  projectMenu: (
    id: string,
    name: string
  ): Promise<'rename' | 'side' | 'opened' | 'deleted' | null> =>
    ipcRenderer.invoke('projects:menu', id, name),
  createProject: (input: Omit<Project, 'id'>): Promise<Project> =>
    ipcRenderer.invoke('projects:create', input),

  loadResearch: (project: string): Promise<ResearchState> =>
    ipcRenderer.invoke('research:load', project),
  addLink: (project: string, input: { url: string; note: string; tag: Tag }): Promise<Reference> =>
    ipcRenderer.invoke('research:addLink', project, input),
  addFiles: (project: string, files: File[]): Promise<Reference[]> =>
    ipcRenderer.invoke(
      'research:addFiles',
      project,
      files.map((f) => webUtils.getPathForFile(f))
    ),
  pickFiles: (project: string): Promise<Reference[]> =>
    ipcRenderer.invoke('research:pickFiles', project),
  updateReference: (
    project: string,
    id: string,
    change: { note?: string; tag?: Tag }
  ): Promise<Reference> => ipcRenderer.invoke('research:update', project, id, change),
  removeReference: (project: string, id: string): Promise<void> =>
    ipcRenderer.invoke('research:remove', project, id),
  openReferenceFile: (project: string, file: string): Promise<void> =>
    ipcRenderer.invoke('research:openFile', project, file),
  interpret: (project: string): Promise<string> =>
    ipcRenderer.invoke('research:interpret', project),
  addSite: (site: Site): Promise<Site[]> => ipcRenderer.invoke('sites:add', site),

  loadCreate: (project: string): Promise<CreateState> => ipcRenderer.invoke('create:load', project),
  saveDeliverables: (project: string, ids: string[]): Promise<string[]> =>
    ipcRenderer.invoke('create:save', project, ids)
}

export type OrchestraApi = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
