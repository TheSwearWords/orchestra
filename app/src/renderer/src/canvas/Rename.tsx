import { useEffect, useRef, useState } from 'react'

/** A name in edit mode: outlined, text selected. Enter or clicking away saves, Esc cancels. */
export function Rename({
  value,
  onDone,
  className = ''
}: {
  value: string
  onDone: (name: string | null) => void // null: nothing changed
  className?: string
}): React.JSX.Element {
  const [text, setText] = useState(value)
  const input = useRef<HTMLInputElement>(null)
  const closed = useRef(false)
  useEffect(() => input.current?.select(), [])
  function finish(save: boolean): void {
    if (closed.current) return
    closed.current = true
    const name = text.trim()
    onDone(save && name && name !== value ? name : null)
  }
  return (
    <input
      ref={input}
      autoFocus
      value={text}
      maxLength={60}
      aria-label="Rename"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
      className={`bg-card text-link outline-2 outline-brand select-text ${className}`}
    />
  )
}
