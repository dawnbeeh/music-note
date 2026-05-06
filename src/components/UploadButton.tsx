import { useRef, useState } from 'react'
import { importLocalFile } from '../db/import'

interface Props {
  onImported: (trackId: string) => void
}

export function UploadButton({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const track = await importLocalFile(file)
      onImported(track.id)
    } catch (err) {
      console.error(err)
      alert('Failed to import file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-md border border-line bg-bg-elev px-3 py-2 text-sm text-text hover:bg-accent-dim hover:text-text-strong disabled:opacity-50"
      >
        {busy ? 'Importing…' : '+ Add local file'}
      </button>
    </>
  )
}
