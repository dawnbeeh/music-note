type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5

interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => YTPlayerState
  setPlaybackRate: (rate: number) => void
  getAvailablePlaybackRates: () => number[]
  destroy: () => void
}

interface YTPlayerOptions {
  videoId?: string
  host?: string
  width?: number | string
  height?: number | string
  playerVars?: Record<string, unknown>
  events?: {
    onReady?: (e: { target: YTPlayer }) => void
    onStateChange?: (e: { data: YTPlayerState; target: YTPlayer }) => void
    onError?: (e: { data: number }) => void
  }
}

interface YTApi {
  Player: new (elementOrId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer
}

interface Window {
  YT?: YTApi
  onYouTubeIframeAPIReady?: (() => void) | null
}
