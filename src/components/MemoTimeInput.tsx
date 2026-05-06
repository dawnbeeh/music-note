import { useEffect, useState } from 'react'
import { formatTimeMs, parseTimeInput } from '../lib/format'

interface Props {
  value: number
  onCommit: (sec: number) => void
  className?: string
  ariaLabel?: string
}

export function MemoTimeInput({ value, onCommit, className, ariaLabel }: Props) {
  const [text, setText] = useState(formatTimeMs(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(formatTimeMs(value))
  }, [value, editing])

  function flush() {
    setEditing(false)
    const parsed = parseTimeInput(text)
    if (parsed === null || Math.abs(parsed - value) < 0.0005) {
      setText(formatTimeMs(value))
      return
    }
    onCommit(parsed)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={flush}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.currentTarget as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setText(formatTimeMs(value))
          setEditing(false)
          ;(e.currentTarget as HTMLInputElement).blur()
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={className}
    />
  )
}
