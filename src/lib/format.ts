export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTimeMs(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00.000'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export function parseTimeInput(raw: string): number | null {
  const input = raw.trim().replace(',', '.')
  if (!input) return null
  const colon = input.match(/^(\d+):(\d{1,2})(?:\.(\d+))?$/)
  if (colon) {
    const m = parseInt(colon[1]!, 10)
    const s = parseInt(colon[2]!, 10)
    const fracStr = colon[3] ?? ''
    const frac = fracStr ? parseFloat(`0.${fracStr}`) : 0
    if (s >= 60) return null
    return m * 60 + s + frac
  }
  const n = parseFloat(input)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}
