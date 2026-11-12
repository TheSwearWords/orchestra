import { useState } from 'react'
import { Rename } from './Rename'

/** A group's name on the top edge of its frame, the same size at any zoom. Drag it to move the
 * group; double-click to rename it. */
export function GroupLabel({
  name,
  z,
  onRename,
  onDrag,
  onDrop,
  onMenu
}: {
  name: string
  z: number
  onRename?: (to: string) => void // leave it out for a name that can't change
  // leave these out for a group that stays where it is
  onDrag?: (dx: number, dy: number) => void
  onDrop?: (dx: number, dy: number) => void
  onMenu?: () => void // right-click
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  function down(e: React.PointerEvent): void {
    if (e.button !== 0 || !onDrag) return
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const [sx, sy] = [e.clientX, e.clientY]
    let moved = false
    const move = (m: PointerEvent): void => {
      moved = true
      onDrag?.((m.clientX - sx) / z, (m.clientY - sy) / z)
    }
    const up = (u: PointerEvent): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      if (moved) onDrop?.((u.clientX - sx) / z, (u.clientY - sy) / z)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }
  return (
    <div
      className="pointer-events-auto absolute bottom-full left-0 origin-bottom-left pb-2"
      style={{ transform: `scale(${1 / z})` }}
    >
      {editing ? (
        <Rename
          value={name}
          className="field-sizing-content min-w-24 px-2 py-0.5 type-body-s"
          onDone={(to) => {
            setEditing(false)
            if (to) onRename?.(to)
          }}
        />
      ) : (
        <span
          onPointerDown={down}
          onDoubleClick={() => onRename && setEditing(true)}
          onContextMenu={(e) => {
            if (!onMenu) return
            e.preventDefault()
            e.stopPropagation()
            onMenu()
          }}
          title={
            onRename ? 'Drag to move the group. Double-click to rename.' : 'Drag to move the group.'
          }
          className={`group-tab block px-3 py-1 type-label-s whitespace-nowrap ${onDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          {name}
        </span>
      )}
    </div>
  )
}
