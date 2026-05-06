import { useEffect, useState } from 'react'

interface Props {
  value: number
  onCommit: (rate: number) => void
  min?: number
  max?: number
  disabled?: boolean
}

function format(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/\.?0+$/, '')
}

export function SpeedInput({
  value,
  onCommit,
  min = 0.25,
  max = 4,
  disabled,
}: Props) {
  const [text, setText] = useState(format(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(format(value))
  }, [value, editing])

  function commit() {
    setEditing(false)
    const cleaned = text.replace(/[×x*]/gi, '').trim()
    const n = parseFloat(cleaned)
    if (!Number.isFinite(n) || n <= 0) {
      setText(format(value))
      return
    }
    const clamped = Math.max(min, Math.min(max, n))
    if (Math.abs(clamped - value) < 0.001) {
      setText(format(value))
      return
    }
    onCommit(clamped)
  }

  return (
    <div className="flex items-center gap-1 text-xs text-text-muted">
      <span>Speed</span>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')
            (e.currentTarget as HTMLInputElement).blur()
          else if (e.key === 'Escape') {
            setText(format(value))
            setEditing(false)
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        className="w-16 rounded border border-line bg-bg-elev px-2 py-1 text-right font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none disabled:opacity-50"
      />
      <span>×</span>
    </div>
  )
}
