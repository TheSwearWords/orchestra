import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Project } from '../main/projects'
import type { AgentState, ChatEvent, ChatMessage, LogEntry } from '../main/conductor'
import type { EditKey, Instrument, Library, Musician, Role } from '../main/library'
import type { ProviderStatus } from '../main/providers'
import type { Setup } from '../main/setup'
import type { Usage } from '../main/session'
import type { MachineCheck } from '../main/onboard'
import type { InterpretBox } from '../main/interprets'
import type { Cover } from '../main/covers'
import type { Preview, Previews } from '../main/previews'
import type { Output } from '../main/outputs'
import type { Proposal } from '../main/proposals'
import type { Ask } from '../main/asks'
import type { Groups, Kind, Reference, Site, Tag } from '../main/research'

export type {
  AgentState,
  EditKey,
  ProviderStatus,
  Setup,
  Kind,
  Cover,
  Preview,
  Previews,
  Usage,
  MachineCheck,
  ChatEvent,
  ChatMessage,
  Instrument,
  Library,
  LogEntry,
  Musician,
  Output,
  Project,
  Proposal,
  Reference,
  Role,
  Site,
  Tag,
  Ask
}

/** One chat in a project: General, or a chosen deliverable's. */
/** Studio arrangement (Orchestra/studio.json): each cover's [x, y, rotation°], and free labels. */
export interface StudioLayout {
  covers: Record<string, [number, number, number]>
  labels: { x: number; y: number; text: string }[]
  groups?: { name: string; ids: string[] }[] // projects put together on the shelf
}

/** A board's cards (projects/<id>/boards/<board>.json): place, size, collapsed. */
export type BoardLayout = Record<
  string,
  { x: number; y: number; w: number; h?: number; collapsed?: boolean }
>

/** One of the bar's conversations with the Orchestrator. */
export interface Thread {
  id: string
  title: string
  count: number
  updated: string
  busy: boolean
}

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
  groups: Groups
  boxes: (InterpretBox & { text: string | null })[]
}

export interface CreateState {
  musicians: Musician[]
  instruments: Instrument[]
  selected: string[] // deliverable (Musician) ids saved in deliverables.md
  locked: string[] // the ones the user has locked in; only these can be briefed
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
    name: string,
    groups: { id: string; label: string }[] = []
  ): Promise<string | null> => ipcRenderer.invoke('projects:menu', id, name, groups),
  setCover: (id: string, cover: Cover): Promise<Cover> =>
    ipcRenderer.invoke('projects:setCover', id, cover),
  pickCover: (id: string): Promise<string | null> => ipcRenderer.invoke('projects:pickCover', id),
  loadStudio: (): Promise<StudioLayout> => ipcRenderer.invoke('studio:load'),
  saveStudio: (layout: StudioLayout): Promise<void> => ipcRenderer.invoke('studio:save', layout),
  loadBoard: (project: string, board: string): Promise<BoardLayout> =>
    ipcRenderer.invoke('board:load', project, board),
  saveBoard: (project: string, board: string, layout: BoardLayout): Promise<void> =>
    ipcRenderer.invoke('board:save', project, board, layout),
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
    change: { note?: string; tag?: Tag; group?: string | null }
  ): Promise<Reference> => ipcRenderer.invoke('research:update', project, id, change),
  addGroup: (project: string, name: string, kinds?: Kind[]): Promise<Groups> =>
    ipcRenderer.invoke('research:addGroup', project, name, kinds),
  saveText: (project: string, group: string, text: string): Promise<void> =>
    ipcRenderer.invoke('research:saveText', project, group, text),
  captureSites: (): Promise<boolean> => ipcRenderer.invoke('sites:capture'),
  renameGroup: (project: string, from: string | null, name: string): Promise<Groups> =>
    ipcRenderer.invoke('research:renameGroup', project, from, name),
  removeGroup: (project: string, name: string): Promise<Groups> =>
    ipcRenderer.invoke('research:removeGroup', project, name),
  removeReference: (project: string, id: string): Promise<void> =>
    ipcRenderer.invoke('research:remove', project, id),
  openReferenceFile: (project: string, file: string): Promise<void> =>
    ipcRenderer.invoke('research:openFile', project, file),
  interpret: (project: string, box: string): Promise<string> =>
    ipcRenderer.invoke('research:interpret', project, box),
  addBox: (project: string): Promise<{ id: string }[]> =>
    ipcRenderer.invoke('research:addBox', project),
  renameBox: (project: string, id: string, name: string): Promise<void> =>
    ipcRenderer.invoke('research:renameBox', project, id, name),
  removeBox: (project: string, id: string): Promise<void> =>
    ipcRenderer.invoke('research:removeBox', project, id),
  connectBox: (project: string, id: string, group: string, on: boolean): Promise<void> =>
    ipcRenderer.invoke('research:connectBox', project, id, group, on),
  readUsage: (): Promise<{ at: number; windows: Usage } | null> => ipcRenderer.invoke('usage:read'),
  addSite: (site: Site): Promise<Site[]> => ipcRenderer.invoke('sites:add', site),
  removeSite: (url: string): Promise<Site[]> => ipcRenderer.invoke('sites:remove', url),

  loadCreate: (project: string): Promise<CreateState> => ipcRenderer.invoke('create:load', project),
  lockDeliverables: (project: string, ids: string[]): Promise<string[]> =>
    ipcRenderer.invoke('create:lock', project, ids),
  listAsks: (project: string): Promise<Record<string, Ask>> =>
    ipcRenderer.invoke('asks:list', project),
  answerAsk: (project: string, id: string, text: string, final: boolean): Promise<void> =>
    ipcRenderer.invoke('ask:answer', project, id, text, final),
  saveDeliverables: (project: string, ids: string[]): Promise<string[]> =>
    ipcRenderer.invoke('create:save', project, ids),
  listChats: (project: string): Promise<ChatInfo[]> => ipcRenderer.invoke('chats:list', project),
  listThreads: (project: string): Promise<Thread[]> => ipcRenderer.invoke('chats:threads', project),
  graphBuiltAt: (project: string): Promise<number | null> =>
    ipcRenderer.invoke('graph:builtAt', project),
  graphStatus: (project: string): Promise<'none' | 'building' | 'ready'> =>
    ipcRenderer.invoke('graph:status', project),
  loadGraph: (project: string | null): Promise<unknown> =>
    ipcRenderer.invoke('graph:load', project),
  buildGraph: (project: string | null): Promise<void> => ipcRenderer.invoke('graph:build', project),
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
  // new agents proposed in a project's chats, keyed "<kind>:<id>"
  listProposals: (project: string): Promise<Record<string, Proposal>> =>
    ipcRenderer.invoke('proposals:list', project),
  decideProposal: (project: string, chat: string, id: string, approve: boolean): Promise<void> =>
    ipcRenderer.invoke('proposal:decide', project, chat, id, approve),
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
  // name, description, provider or model; checked and written in main (library.ts editAgent)
  editAgent: (role: Role, id: string, key: EditKey, value: string): Promise<void> =>
    ipcRenderer.invoke('agents:set', role, id, key, value),
  providerStatus: (): Promise<ProviderStatus> => ipcRenderer.invoke('providers:status'),
  loadSetup: (): Promise<{ setup: Setup; home: string }> => ipcRenderer.invoke('setup:load'),
  checkSetup: (): Promise<MachineCheck> => ipcRenderer.invoke('setup:check'),
  runSetupStep: (id: string): Promise<{ ok: boolean; out: string }> =>
    ipcRenderer.invoke('setup:run', id),
  openSetupStep: (id: string): Promise<void> => ipcRenderer.invoke('setup:open', id),
  pickFolder: (current: string): Promise<string | null> =>
    ipcRenderer.invoke('setup:pickFolder', current),
  saveKey: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('setup:saveKey', provider, key),
  forgetKey: (provider: string): Promise<void> => ipcRenderer.invoke('setup:forgetKey', provider),
  savedKeys: (): Promise<string[]> => ipcRenderer.invoke('setup:savedKeys'),
  finishSetup: (s: Setup): Promise<void> => ipcRenderer.invoke('setup:finish', s),
  // a blank Instrument in a Musician's crew; returns its id
  newInstrument: (musician: string): Promise<string> =>
    ipcRenderer.invoke('agents:newInstrument', musician),
  setAgentList: (
    musician: string,
    key: 'prerequisites' | 'tools',
    value: string[]
  ): Promise<void> => ipcRenderer.invoke('agents:set', 'musician', musician, key, value),
  setCrew: (musician: string, instruments: string[]): Promise<void> =>
    ipcRenderer.invoke('agents:set', 'musician', musician, 'instruments', instruments),
  listOutputs: (project: string): Promise<Output[]> =>
    ipcRenderer.invoke('create:outputs', project),
  listPreviews: (project: string): Promise<Previews> =>
    ipcRenderer.invoke('previews:list', project),
  openPreview: (project: string, deliverable: string, label: string): Promise<void> =>
    ipcRenderer.invoke('previews:open', project, deliverable, label),
  readOutput: (project: string, path: string): Promise<string> =>
    ipcRenderer.invoke('create:readOutput', project, path),
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
