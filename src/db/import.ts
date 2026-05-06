import { db } from './index'
import { sha256 } from './hash'
import type { Track } from './types'

const AUDIO_EXT_RE = /\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i

function stripExt(name: string): string {
  return name.replace(AUDIO_EXT_RE, '')
}

async function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    audio.addEventListener('loadedmetadata', () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0
      URL.revokeObjectURL(url)
      resolve(d)
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to read audio metadata'))
    })
  })
}

export async function importLocalFile(file: File): Promise<Track> {
  const buffer = await file.arrayBuffer()
  const fileHash = await sha256(buffer)

  const existing = await db.tracks.where('fileHash').equals(fileHash).first()
  if (existing) return existing

  const durationSec = await probeDuration(file).catch(() => 0)

  const track: Track = {
    id: `local_${fileHash.slice(0, 16)}`,
    source: 'local',
    title: stripExt(file.name),
    durationSec,
    addedAt: Date.now(),
    fileHash,
    fileName: file.name,
    fileType: file.type || 'audio/*',
  }

  await db.transaction('rw', db.tracks, db.audio, async () => {
    await db.tracks.put(track)
    await db.audio.put({ trackId: track.id, blob: file })
  })

  return track
}
