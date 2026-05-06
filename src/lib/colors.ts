export interface MemoColor {
  id: string
  hex: string
  label: string
}

export const MEMO_COLORS: MemoColor[] = [
  { id: 'purple', hex: '#c084fc', label: 'Purple' },
  { id: 'cyan', hex: '#67e8f9', label: 'Cyan' },
  { id: 'pink', hex: '#f472b6', label: 'Pink' },
  { id: 'amber', hex: '#fbbf24', label: 'Amber' },
  { id: 'emerald', hex: '#6ee7b7', label: 'Emerald' },
  { id: 'rose', hex: '#fb7185', label: 'Rose' },
]

export function defaultColorIdForIndex(i: number): string {
  return MEMO_COLORS[i % MEMO_COLORS.length]!.id
}

export function getColorHex(id: string | undefined): string {
  const fallback = MEMO_COLORS[0]!.hex
  if (!id) return fallback
  return MEMO_COLORS.find((c) => c.id === id)?.hex ?? fallback
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
