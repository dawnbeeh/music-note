import { db } from '../db'
import type { Track } from '../db/types'

const VIDEO_ID_RE = /^[\w-]{11}$/

export function parseVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (VIDEO_ID_RE.test(trimmed)) return trimmed
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? ''
    return VIDEO_ID_RE.test(id) ? id : null
  }
  if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
    const v = url.searchParams.get('v')
    if (v && VIDEO_ID_RE.test(v)) return v
    const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)
    if (m) return m[1]!
  }
  return null
}

interface OEmbedResponse {
  title?: string
  author_name?: string
}

async function fetchMeta(videoId: string): Promise<{ title: string }> {
  const url =
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}` +
    `&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch YouTube video info')
  const data = (await res.json()) as OEmbedResponse
  return { title: data.title ?? `YouTube ${videoId}` }
}

export async function importYouTubeUrl(input: string): Promise<Track> {
  const videoId = parseVideoId(input)
  if (!videoId) throw new Error('Invalid YouTube URL or ID')
  const existing = await db.tracks
    .where('ytVideoId')
    .equals(videoId)
    .first()
  if (existing) return existing
  const meta = await fetchMeta(videoId)
  const track: Track = {
    id: `yt_${videoId}`,
    source: 'youtube',
    title: meta.title,
    durationSec: 0,
    addedAt: Date.now(),
    ytVideoId: videoId,
  }
  await db.tracks.put(track)
  return track
}

let apiPromise: Promise<YTApi> | null = null

export function loadYouTubeIframeApi(): Promise<YTApi> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }
    const prev = window.onYouTubeIframeAPIReady ?? null
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })
  return apiPromise
}
