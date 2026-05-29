import { db } from './index'
import type { Folder, Memo, Track, WaveformCache } from './types'

interface BackupV1 {
  version: 1
  exportedAt: number
  tracks: Track[]
  memos: Memo[]
  waveforms: WaveformCache[]
  folders?: Folder[]
}

export async function exportBackup(): Promise<Blob> {
  const [tracks, memos, waveforms, folders] = await Promise.all([
    db.tracks.toArray(),
    db.memos.toArray(),
    db.waveforms.toArray(),
    db.folders.toArray(),
  ])
  const data: BackupV1 = {
    version: 1,
    exportedAt: Date.now(),
    tracks,
    memos,
    waveforms,
    folders,
  }
  const json = JSON.stringify(data, null, 2)
  return new Blob([json], { type: 'application/json' })
}

export interface ImportResult {
  tracksAdded: number
  tracksMerged: number
  memosAdded: number
  memosSkipped: number
  waveformsAdded: number
}

function isBackupV1(value: unknown): value is BackupV1 {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    Array.isArray(v.tracks) &&
    Array.isArray(v.memos) &&
    Array.isArray(v.waveforms)
  )
}

export async function importBackup(json: string): Promise<ImportResult> {
  const parsed: unknown = JSON.parse(json)
  if (!isBackupV1(parsed)) {
    throw new Error('Unrecognized backup format')
  }

  const result: ImportResult = {
    tracksAdded: 0,
    tracksMerged: 0,
    memosAdded: 0,
    memosSkipped: 0,
    waveformsAdded: 0,
  }
  const trackIdMap = new Map<string, string>()

  for (const t of parsed.tracks) {
    let finalId = t.id
    let merged = false
    if (t.ytVideoId) {
      const existing = await db.tracks
        .where('ytVideoId')
        .equals(t.ytVideoId)
        .first()
      if (existing) {
        finalId = existing.id
        merged = true
      }
    } else if (t.fileHash) {
      const existing = await db.tracks
        .where('fileHash')
        .equals(t.fileHash)
        .first()
      if (existing) {
        finalId = existing.id
        merged = true
      }
    }
    if (!merged) {
      const sameId = await db.tracks.get(finalId)
      if (!sameId) {
        await db.tracks.put(t)
        result.tracksAdded++
      }
    } else {
      result.tracksMerged++
    }
    trackIdMap.set(t.id, finalId)
  }

  for (const m of parsed.memos) {
    const finalTrackId = trackIdMap.get(m.trackId)
    if (!finalTrackId) {
      result.memosSkipped++
      continue
    }
    const existing = await db.memos.get(m.id)
    if (existing) {
      result.memosSkipped++
      continue
    }
    await db.memos.put({ ...m, trackId: finalTrackId })
    result.memosAdded++
  }

  for (const w of parsed.waveforms) {
    const finalTrackId = trackIdMap.get(w.trackId)
    if (!finalTrackId) continue
    const existing = await db.waveforms.get(finalTrackId)
    if (existing) continue
    await db.waveforms.put({ ...w, trackId: finalTrackId })
    result.waveformsAdded++
  }

  if (parsed.folders) {
    for (const f of parsed.folders) {
      const finalTrackId = trackIdMap.get(f.trackId)
      if (!finalTrackId) continue
      const existing = await db.folders
        .where('[trackId+path]')
        .equals([finalTrackId, f.path])
        .first()
      if (!existing) await db.folders.put({ ...f, trackId: finalTrackId })
    }
  }

  return result
}

export function downloadBackup(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `music-note-backup-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
