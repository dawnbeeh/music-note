import { useState } from 'react'
import { importYouTubeUrl } from '../lib/youtube'

interface Props {
  onImported: (trackId: string) => void
}

export function AddYouTubeButton({ onImported }: Props) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const track = await importYouTubeUrl(url)
      onImported(track.id)
      setUrl('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-line bg-bg-elev px-3 py-2 text-sm text-text hover:bg-accent-dim hover:text-text-strong"
      >
        + Add YouTube URL
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        autoFocus
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://youtube.com/watch?v=…"
        className="w-full rounded-md border border-line bg-bg-elev px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg hover:bg-accent/80 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setUrl('')
            setError(null)
          }}
          className="rounded-md border border-line px-3 py-1.5 text-sm text-text-muted hover:text-text-strong"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
