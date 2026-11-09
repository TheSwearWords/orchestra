import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** "Are you sure?" over the whole window. Esc or Cancel backs out. */
export function ConfirmModal({
  title,
  body,
  confirm,
  onConfirm,
  onCancel
}: {
  title: string
  body: string
  confirm: string // what the button does, e.g. "Deactivate"
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onCancel()
    }
    addEventListener('keydown', key, true)
    return () => removeEventListener('keydown', key, true)
  }, [onCancel])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-inverse/40 p-6">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="flex w-full max-w-[440px] flex-col gap-3 border border-chip-line bg-card p-8 text-link shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
      >
        <h2 id="confirm-title" className="type-heading-m">
          {title}
        </h2>
        <p className="type-body-m text-fg">{body}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            autoFocus
            onClick={onCancel}
            className="serif-on h-10 border-[1.5px] border-brand px-4 type-label-m text-link hover:bg-selected"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="serif-on h-10 bg-brand px-4 type-label-m text-on-brand hover:bg-inverse"
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
