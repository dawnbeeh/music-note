import { useEffect } from 'react'
import { SHORTCUT_LIST } from '../lib/shortcuts'

interface Props {
  onClose: () => void
}

export function ShortcutHelp({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-line bg-bg-panel p-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-strong">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-text-muted hover:text-text-strong"
          >
            ✕
          </button>
        </div>
        <ul className="divide-y divide-line">
          {SHORTCUT_LIST.map((s) => (
            <li
              key={s.keys}
              className="flex items-center justify-between gap-4 py-2 text-sm"
            >
              <span className="text-text">{s.action}</span>
              <kbd className="rounded border border-line bg-bg-elev px-2 py-0.5 font-mono text-xs text-text-strong">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-text-muted">
          Shortcuts are inactive while typing in an input.
        </p>
      </div>
    </div>
  )
}
