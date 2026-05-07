import { useEffect, useState } from 'react'

interface Props {
  value: number
  base: number
  max: number
  onCommit: (zoom: number) => void
  disabled?: boolean
}

function format(value: number, base: number): string {
  if (value === 0) return 'fit'
  const ratio = value / base
  return Number.isInteger(ratio)
    ? `${ratio}`
    : ratio.toFixed(2).replace(/\.?0+$/, '')
}

export function ZoomInput({ value, base, max, onCommit, disabled }: Props) {
  const [text, setText] = useState(format(value, base))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(format(value, base))
  }, [value, base, editing])

  function commit() {
    setEditing(false)
    const cleaned = text.replace(/[×x*]/gi, '').trim().toLowerCase()
    if (cleaned === '' || cleaned === 'fit' || cleaned === '0') {
      if (value !== 0) onCommit(0)
      else setText(format(value, base))
      return
    }
    const n = parseFloat(cleaned)
    if (!Number.isFinite(n) || n < 0) {
      setText(format(value, base))
      return
    }
    const target = n * base
    const clamped = Math.max(base, Math.min(max, target))
    if (Math.abs(clamped - value) < 0.5) {
      setText(format(value, base))
      return
    }
    onCommit(clamped)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        else if (e.key === 'Escape') {
          setText(format(value, base))
          setEditing(false)
          ;(e.currentTarget as HTMLInputElement).blur()
        }
      }}
      title="Zoom (e.g. 1, 1.5, 4, fit)"
      className="w-14 rounded border border-line bg-bg-elev px-2 py-1 text-center font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none disabled:opacity-50"
    />
  )
}
