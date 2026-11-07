// What the canvas components share: constants, types and small pure helpers.
import type { Project, StudioLayout } from '../../../preload'
import type { AsciiName } from '../components/Ascii'
import { fit, type Camera, type Rect } from './camera'

export const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches

export const chip =
  'flex h-[46px] items-center border border-chip-line bg-chip shadow-float text-link'

export type Area = 'research' | 'create' | 'refine'
export const AREAS: { id: Area; numeral: string; name: string }[] = [
  { id: 'research', numeral: 'I', name: 'Research' },
  { id: 'create', numeral: 'II', name: 'Create' },
  { id: 'refine', numeral: 'III', name: 'Refine' }
]

export const COVER = { w: 300, h: 400 }

export type CoverColor = 'blue' | 'white' | 'ink'
const ART: AsciiName[] = ['apollo', 'violin', 'hand', 'concert']

function hash(s: string): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0
  return Math.abs(h)
}
// shortcut: colour and art are picked from the id until project.json holds the Auto/manual
// cover settings (canvas spec §2.3); upgrade when the cover editor gets its Cover settings.
export const coverColor = (id: string): CoverColor =>
  (['blue', 'ink', 'white'] as const)[hash(id) % 3]
export const coverArt = (id: string): AsciiName => ART[hash(id + 'art') % ART.length]
/** A slight tilt, ±4°, the same every time for the same project. */
export const coverTilt = (id: string): number => ((hash(id + 'tilt') % 81) - 40) / 10

export interface CoverInfo {
  id: string
  name: string
  client: string
  no: number
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
  client: p.client,
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
const BOTTOM = 96 // the Orchestrator bar and the pages, under a board

/** The camera that shows `r` in the space between the top bar and the bottom row. */
export function fitBelow(r: Rect, maxZ = 1): Camera {
  const c = fit(r, innerWidth, innerHeight - TOP_BAR - BOTTOM, 56, maxZ)
  return { ...c, y: c.y - TOP_BAR / c.z }
}
