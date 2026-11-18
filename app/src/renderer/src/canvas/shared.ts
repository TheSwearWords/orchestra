// What the canvas components share: constants, types and small pure helpers.
import { createContext } from 'react'
import type { Cover, Project, Role, StudioLayout } from '../../../preload'
import { fit, type Camera, type Rect } from './camera'
import { openMenu } from './menuStore'

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

export const chip =
  'flex h-[46px] items-center rounded-lg border border-chip-line bg-chip shadow-float text-link'

export type Area = 'research' | 'create' | 'refine'
export const AREAS: { id: Area; numeral: string; name: string }[] = [
  { id: 'research', numeral: 'I', name: 'Research' },
  { id: 'create', numeral: 'II', name: 'Create' },
  { id: 'refine', numeral: 'III', name: 'Refine' }
]

export const COVER = { w: 300, h: 400 }

/** The backdrops a cover can use: the plates in assets/landscapes (see Landscape.tsx). */
export const LANDSCAPE_NAMES = ['sunset', 'alpine', 'desert', 'hills', 'coast'] as const
export type Landscape = (typeof LANDSCAPE_NAMES)[number]
/** The longest a project description may be; main/projects.ts enforces the same number. */
export const MAX_CONCEPT = 300

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}
/** Which backdrop a cover uses: the one chosen, or else the same one every time for the id. */
export const coverLandscape = (id: string, chosen?: string): Landscape =>
  LANDSCAPE_NAMES.includes(chosen as Landscape)
    ? (chosen as Landscape)
    : LANDSCAPE_NAMES[hash(id + 'land') % LANDSCAPE_NAMES.length]
/** A slight tilt, ±4°, the same every time for the same project. */
export const coverTilt = (id: string): number => ((hash(id + 'tilt') % 81) - 40) / 10

export interface CoverInfo {
  id: string
  name: string
  concept: string
  no: number
  cover?: Cover
}

// Studio shelf: the default row of covers
export const GAP = 72
export const ROW_Y = 120

export function studioPlace(
  layout: StudioLayout,
  ids: string[]
): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  ids.forEach((id, i) => {
    out[id] = layout.covers[id] ?? [96 + i * (COVER.w + GAP), ROW_Y, coverTilt(id)]
  })
  return out
}

export const coverInfo = (p: Project, all: Project[]): CoverInfo => ({
  id: p.id,
  name: p.name,
  concept: p.concept,
  cover: p.cover,
  // shortcut: issue numbers follow the alphabetical list until project.json stores `no`
  no: all.findIndex((q) => q.id === p.id) + 1
})

/** True when a key press belongs to a field or an open dialog, not to the canvas. */
export function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement
  return (
    e.defaultPrevented ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey ||
    !!t.closest?.('input, textarea, select, [contenteditable=true]') ||
    !!document.querySelector('dialog[open], [aria-modal=true]')
  )
}

// Chats the bar and the stage address (conductor.ts): a project's whole-project chat, and the
// one above every project, in the Studio (no project folder can have this name).
export const GENERAL = 'general'
export const STUDIO = '_studio'

export const TOP_BAR = 52 // the breadcrumb strip's height
export const DOCK_TOP = TOP_BAR + 14 // a floating panel's top edge
export const DOCK_GAP = 14 // and its distance from the window's right edge
const BOTTOM = 96 // the Orchestrator bar and the pages, under a board

/** The camera that shows `r` in the space between the top bar and the bottom row. */
export function fitBelow(r: Rect, maxZ = 1): Camera {
  const c = fit(r, innerWidth, innerHeight - TOP_BAR - BOTTOM, 56, maxZ)
  return { ...c, y: c.y - TOP_BAR / c.z }
}

/** A card the Needs you list wants shown: App sets it and navigates, the board takes it once
 * it is mounted (or hears 'orchestra:focus' if it already is). */
export const pendingFocus: { current: { project: string; card: string } | null } = {
  current: null
}
export function requestFocus(project: string, card: string): void {
  pendingFocus.current = { project, card }
  dispatchEvent(new Event('orchestra:focus'))
}

/** "/create instrument" in the bar: App sets it and goes to Create, which takes it once mounted
 * (or hears 'orchestra:new-instrument' if it already is) and asks which deliverable it is for. */
export const pendingInstrument: { current: string | null } = { current: null }
export function requestNewInstrument(project: string): void {
  pendingInstrument.current = project
  dispatchEvent(new Event('orchestra:new-instrument'))
}

/** Opens an agent's markdown file as a window on the artboard (the Studio provides it); with
 * none, the Agents screen falls back to its modal. */
export interface AgentFileRef {
  role: Role
  id: string
  name: string
}
export const AgentFileOpener = createContext<((f: AgentFileRef) => void) | null>(null)

/** A right-click menu entry: what it says and what it does. With no `run` it shows greyed. */
export interface MenuItem {
  label: string
  run?: () => void
  enabled?: boolean
  separator?: boolean
  heading?: boolean // a small caps title over the entries that follow; not clickable
  icon?: string // an icon from assets/icons
  hint?: string // a word on the right: a shortcut, or what it leads to
  danger?: boolean // removes or deletes something, so it reads red
}
// where the pointer last went down, so a menu opens beside it wherever popMenu is called from
let pointer = { x: innerWidth / 2, y: innerHeight / 2 }
const track = (e: MouseEvent): void => {
  pointer = { x: e.clientX, y: e.clientY }
}
addEventListener('pointerdown', track, true)
addEventListener('contextmenu', track, true)
/** Shows the app's right-click menu (ContextMenu.tsx) and runs whatever is picked. */
export function popMenu(items: MenuItem[]): Promise<void> {
  return openMenu(items, pointer.x, pointer.y)
}
/** The Orchestrator bar's field, when this screen has the bar. */
export const barInput = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('input[aria-label^="Message the Orchestrator"]')
