export type TrackSource = 'local' | 'youtube'

export interface Track {
  id: string
  source: TrackSource
  title: string
  durationSec: number
  addedAt: number
  ytVideoId?: string
  fileHash?: string
  fileName?: string
  fileType?: string
}

export interface AudioBlob {
  trackId: string
  blob: Blob
}

export interface WaveformCache {
  trackId: string
  peaks: number[][]
  duration: number
}

export interface Memo {
  id: string
  trackId: string
  start: number
  end?: number
  body: string
  tags: string[]
  loop: boolean
  createdAt: number
  color?: string
}
