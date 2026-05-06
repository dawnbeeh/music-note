import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { AudioBlob, Memo, Track, WaveformCache } from './types'

class MusicNoteDB extends Dexie {
  tracks!: Table<Track, string>
  audio!: Table<AudioBlob, string>
  waveforms!: Table<WaveformCache, string>
  memos!: Table<Memo, string>

  constructor() {
    super('music-note')
    this.version(1).stores({
      tracks: 'id, source, addedAt, ytVideoId, fileHash',
      audio: 'trackId',
      waveforms: 'trackId',
      memos: 'id, trackId, *tags, createdAt',
    })
  }
}

export const db = new MusicNoteDB()
