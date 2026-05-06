import { useRef, useState } from 'react'
import {
  downloadBackup,
  exportBackup,
  importBackup,
  type ImportResult,
} from '../db/backup'

export function BackupButtons() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function onExport() {
    setBusy(true)
    try {
      const blob = await exportBackup()
      downloadBackup(blob)
      setToast('Backup downloaded')
    } catch (e) {
      console.error(e)
      setToast('Export failed')
    } finally {
      setBusy(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  function onImportClick() {
    fileRef.current?.click()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const r: ImportResult = await importBackup(text)
      setToast(
        `Imported · tracks +${r.tracksAdded} merged ${r.tracksMerged} · memos +${r.memosAdded}`,
      )
    } catch (err) {
      console.error(err)
      setToast(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
      setTimeout(() => setToast(null), 5000)
    }
  }

  return (
    <div className="space-y-1">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onFile}
      />
      <div className="flex gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={onExport}
          className="flex-1 rounded border border-line bg-bg-elev px-2 py-1.5 text-xs text-text-muted hover:text-text-strong disabled:opacity-50"
          title="Download all memos as a JSON file"
        >
          ⬇ Export
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onImportClick}
          className="flex-1 rounded border border-line bg-bg-elev px-2 py-1.5 text-xs text-text-muted hover:text-text-strong disabled:opacity-50"
          title="Restore from a backup file"
        >
          ⬆ Import
        </button>
      </div>
      {toast && (
        <p className="text-[10px] leading-snug text-text-muted">{toast}</p>
      )}
    </div>
  )
}
