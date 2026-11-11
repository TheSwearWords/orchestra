// In the Action box: a question from the Orchestrator with no options to pick, answered in words.
import { useState } from 'react'
import { primary } from '../canvas/Setup'

export function OpenQuestion({
  question,
  disabled,
  onSend
}: {
  question: string
  disabled: boolean
  onSend: (answer: string) => Promise<boolean>
}): React.JSX.Element {
  const [answer, setAnswer] = useState('')
  const [sending, setSending] = useState(false)
  async function send(): Promise<void> {
    setSending(true)
    if (await onSend(answer.trim())) setAnswer('')
    setSending(false)
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-m-strong text-link">{question}</p>
      <textarea
        rows={3}
        aria-label="Your answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Your answer"
        className="w-full resize-none border border-hair p-2 type-body-s text-link outline-none placeholder:text-placeholder focus:border-brand"
      />
      <button
        disabled={disabled || sending || !answer.trim()}
        onClick={() => void send()}
        className={`${primary} self-start`}
      >
        Send
      </button>
    </div>
  )
}
