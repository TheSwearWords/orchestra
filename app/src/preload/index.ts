import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Project } from '../main/projects'
import type { AgentState, ChatEvent, ChatMessage, LogEntry } from '../main/conductor'
import type { Instrument, Library, Musician, Role } from '../main/library'
import type { Output } from '../main/outputs'
import type { Reference, Site, Tag } from '../main/research'

export type {
  AgentState,
  ChatEvent,
  ChatMessage,
  Instrument,
  Library,
  LogEntry,
  Musician,
  Output,
  Project,
  Reference,
  Role,
  Site,
  Tag
}

/** One chat in a project: General, or a chosen deliverable's. */
export interface ChatInfo {
  id: string
  title: string
  icon: string
  deliverable: boolean
  busy: boolean
  count: number // messages, not counting notes
  last: ChatMessage | null
}

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
  openWindow: (project?: string): Promise<void> => ipcRenderer.invoke('window:open', project),
  dragStart: (
    project: string,
    at: { x: number; y: number; width: number; height: number },
    alone: boolean
  ): Promise<void> => ipcRenderer.invoke('drag:start', project, at, alone),
  dragCancel: (): Promise<void> => ipcRenderer.invoke('drag:cancel'),
  dragArm: (): Promise<void> => ipcRenderer.invoke('drag:arm'),
  dragDisarm: (): Promise<void> => ipcRenderer.invoke('drag:disarm'),
  // whether this window could take a tab being dragged in another window, and if it's under it
  onDropState: (cb: (state: 'ready' | 'over' | null) => void): (() => void) => {
    const listener = (_: unknown, state: 'ready' | 'over' | null): void => cb(state)
    ipcRenderer.on('drop:state', listener)
    return () => ipcRenderer.removeListener('drop:state', listener)
  },
  dragEnd: (): Promise<'merged' | 'placed'> => ipcRenderer.invoke('drag:end'),
  // another window's tab was dropped on this one's tab strip
  onAdoptTab: (cb: (project: string) => void): (() => void) => {
    const listener = (_: unknown, project: string): void => cb(project)
    ipcRenderer.on('tabs:adopt', listener)
    return () => ipcRenderer.removeListener('tabs:adopt', listener)
  },
  menu: (
    items: { id: string; label: string; enabled?: boolean; separator?: boolean }[]
  ): Promise<string | null> => ipcRenderer.invoke('menu:popup', items),
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
  editProject: (
    id: string,
    change: { name?: string; client?: string; concept?: string }
  ): Promise<Project> => ipcRenderer.invoke('projects:edit', id, change),
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
    ipcRenderer.invoke('create:save', project, ids),
  listChats: (project: string): Promise<ChatInfo[]> => ipcRenderer.invoke('chats:list', project),
  loadChat: (
    project: string,
    chat: string
  ): Promise<{ messages: ChatMessage[]; log: LogEntry[]; busy: boolean }> =>
    ipcRenderer.invoke('chat:load', project, chat),
  sendChat: (project: string, chat: string, text: string): Promise<void> =>
    ipcRenderer.invoke('chat:send', project, chat, text),
  stopChat: (project: string, chat: string): Promise<void> =>
    ipcRenderer.invoke('chat:stop', project, chat),
  // every Musician's and Instrument's status in a project, keyed "musician" or "musician--instrument"
  agentStates: (project: string): Promise<Record<string, AgentState>> =>
    ipcRenderer.invoke('agents:states', project),
  // every project's Orchestrator events; callers filter by project
  onChatEvent: (cb: (e: ChatEvent) => void): (() => void) => {
    const listener = (_: unknown, e: ChatEvent): void => cb(e)
    ipcRenderer.on('chat:event', listener)
    return () => ipcRenderer.removeListener('chat:event', listener)
  },
  loadAgents: (): Promise<{ library: Library; problems: string[] }> =>
    ipcRenderer.invoke('agents:load'),
  readAgent: (role: Role, id: string): Promise<string> =>
    ipcRenderer.invoke('agents:read', role, id),
  writeAgent: (role: Role, id: string, text: string): Promise<void> =>
    ipcRenderer.invoke('agents:write', role, id, text),
  setAgentModel: (role: Role, id: string, model: string): Promise<void> =>
    ipcRenderer.invoke('agents:set', role, id, 'model', model),
  setCrew: (musician: string, instruments: string[]): Promise<void> =>
    ipcRenderer.invoke('agents:set', 'musician', musician, 'instruments', instruments),
  listOutputs: (project: string): Promise<Output[]> =>
    ipcRenderer.invoke('create:outputs', project),
  openOutput: (project: string, path: string): Promise<void> =>
    ipcRenderer.invoke('create:openOutput', project, path)
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
