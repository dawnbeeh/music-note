export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export function shortcutCode(e: KeyboardEvent): string {
  return e.code || e.key
}

export interface ShortcutInfo {
  keys: string
  action: string
}

export const SHORTCUT_LIST: ShortcutInfo[] = [
  { keys: 'Space', action: 'Play / Pause' },
  { keys: '← / →', action: 'Skip 1s' },
  { keys: 'Shift + ← / →', action: 'Skip 5s' },
  { keys: 'Alt + ← / →', action: 'Step 0.1s' },
  { keys: 'I', action: 'Mark Start (auto-play)' },
  { keys: 'O', action: 'Mark End / finish range' },
  { keys: 'P', action: 'Add point at playhead' },
  { keys: 'L', action: 'Toggle loop on selected memo' },
  { keys: '+ / =', action: 'Zoom in' },
  { keys: '−', action: 'Zoom out' },
  { keys: '0', action: 'Zoom fit' },
  { keys: '[' , action: 'Speed down' },
  { keys: ']' , action: 'Speed up' },
  { keys: 'Esc', action: 'Cancel mark / clear selection' },
  { keys: '⌘/Ctrl + Z', action: 'Undo' },
  { keys: '⇧⌘/Ctrl + Z', action: 'Redo' },
]
