import { useEffect, useState } from 'react'

const STORAGE_KEY = 'music-note:welcomed'

export function WelcomeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      /* private mode */
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-line bg-bg-panel p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-text-strong">
          Welcome to Music Note
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text">
          Add an audio file or YouTube URL, then drag the waveform — or hit
          <span className="mx-1 rounded bg-pink-500/20 px-1.5 py-0.5 text-pink-200">
            Mark
          </span>
          while playing — to attach memos to sections you want to study.
        </p>
        <div className="mt-4 rounded border border-line bg-bg-elev px-3 py-2 text-xs text-text-muted">
          <strong className="text-text">Heads up:</strong> your tracks and
          memos are stored in <em>this browser only</em>. They don&apos;t sync
          to other devices. Use{' '}
          <span className="font-medium text-text">Export</span> in the sidebar
          to back them up to a file.
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg hover:bg-accent/80"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
