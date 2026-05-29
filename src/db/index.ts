import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { AudioBlob, Folder, Memo, Track, WaveformCache } from './types'

class MusicNoteDB extends Dexie {
  tracks!: Table<Track, string>
  audio!: Table<AudioBlob, string>
  waveforms!: Table<WaveformCache, string>
  memos!: Table<Memo, string>
  folders!: Table<Folder, string>

  constructor() {
    super('music-note')
    this.version(1).stores({
      tracks: 'id, source, addedAt, ytVideoId, fileHash',
      audio: 'trackId',
      waveforms: 'trackId',
      memos: 'id, trackId, *tags, createdAt',
    })
    this.version(2).stores({
      tracks: 'id, source, addedAt, ytVideoId, fileHash',
      audio: 'trackId',
      waveforms: 'trackId',
      memos: 'id, trackId, folderPath, createdAt',
      folders: 'id, trackId, path, [trackId+path]',
    })
    this.version(3)
      .stores({
        tracks: 'id, source, addedAt, ytVideoId, fileHash',
        audio: 'trackId',
        waveforms: 'trackId',
        memos: 'id, trackId, folderPath, createdAt',
        folders: 'id, trackId, path, [trackId+path]',
      })
      .upgrade(async (tx) => {
        const memos = tx.table<Memo, string>('memos')
        const folders = tx.table<Folder, string>('folders')
        const rows = await memos.toArray()
        const folderKeys = new Set<string>()

        for (const memo of rows) {
          const legacyTag =
            !memo.folderPath && Array.isArray(memo.tags)
              ? memo.tags.find((tag) => tag.trim().length > 0)
              : undefined
          if (!legacyTag) continue

          const path = legacyTag
            .toLowerCase()
            .trim()
            .replace(/\/+/g, '/')
            .replace(/^\/+|\/+$/g, '')
          if (!path) continue

          await memos.update(memo.id, { folderPath: path })
          const key = `${memo.trackId}\n${path}`
          if (!folderKeys.has(key)) {
            folderKeys.add(key)
            await folders.put({
              id: `legacy_${memo.trackId}_${path}`.replace(/[^\w-]+/g, '_'),
              trackId: memo.trackId,
              path,
              createdAt: Date.now(),
            })
          }
        }
      })
  }
}

export const db = new MusicNoteDB()
