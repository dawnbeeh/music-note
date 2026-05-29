import type { Memo } from '../db/types'
import { getColorHex, hexToRgba } from '../lib/colors'
import { formatTime } from '../lib/format'

interface Props {
  memo: Memo | null
  duration: number
  peaks?: number[][]
}

function sampledPeaks(memo: Memo, duration: number, peaks: number[][]): number[] {
  const source = peaks[0] ?? []
  if (!source.length || duration <= 0) return []
  const start = Math.max(0, Math.min(1, memo.start / duration))
  const endTime = memo.end ?? Math.min(duration, memo.start + 1)
  const end = Math.max(start, Math.min(1, endTime / duration))
  const a = Math.floor(start * source.length)
  const b = Math.max(a + 1, Math.ceil(end * source.length))
  const slice = source.slice(a, b)
  const bars = 80
  return Array.from({ length: bars }, (_, i) => {
    const from = Math.floor((i / bars) * slice.length)
    const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * slice.length))
    const chunk = slice.slice(from, to)
    return Math.max(0.08, ...chunk.map((n) => Math.abs(n)))
  })
}

export function MemoDetailBar({ memo, duration, peaks }: Props) {
  if (!memo) {
    return (
      <div className="rounded-md border border-line bg-bg-panel p-3 text-sm text-text-muted">
        Select a memo to inspect its focused waveform.
      </div>
    )
  }

  const color = getColorHex(memo.color)
  const values = peaks ? sampledPeaks(memo, duration, peaks) : []

  return (
    <div className="rounded-md border border-line bg-bg-panel p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
        <span className="font-mono text-text-strong">
          {formatTime(memo.start)}
          {memo.end !== undefined ? ` - ${formatTime(memo.end)}` : ''}
        </span>
        <span className="ml-auto">{memo.folderPath ?? 'No folder'}</span>
      </div>
      <div className="relative h-20 overflow-hidden rounded bg-bg-elev">
        {values.length > 0 ? (
          <div className="flex h-full items-center gap-px px-2">
            {values.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm"
                style={{
                  height: `${Math.max(8, Math.min(100, v * 100))}%`,
                  background: hexToRgba(color, 0.75),
                }}
              />
            ))}
          </div>
        ) : (
          <div
            className="absolute inset-y-0 rounded-sm"
            style={{
              left: `${duration > 0 ? (memo.start / duration) * 100 : 0}%`,
              width: `${duration > 0 && memo.end !== undefined ? Math.max(1, ((memo.end - memo.start) / duration) * 100) : 1}%`,
              background: hexToRgba(color, 0.7),
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-1/2 inset-y-0 w-px bg-text-strong/70" />
      </div>
    </div>
  )
}
