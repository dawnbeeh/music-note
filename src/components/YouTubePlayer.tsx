import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../db'
import type { Memo, Track } from '../db/types'
import { canLoop } from '../db/memos'
import {
  createMemo,
  setLoop,
  updateMemoBounds,
} from '../lib/memoActions'
import { isTypingTarget } from '../lib/shortcuts'
import { defaultColorIdForIndex, getColorHex, hexToRgba } from '../lib/colors'
import { formatTime } from '../lib/format'
import { loadYouTubeIframeApi } from '../lib/youtube'
import { SpeedInput } from './SpeedInput'

interface SeekRequest {
  nonce: number
  time: number
}

interface Props {
  track: Track
  memos: Memo[]
  selectedMemoId: string | null
  onSelectMemo: (id: string | null) => void
  seekRequest: SeekRequest | null
}

const POINT_MIN_PAD = 0.5
const COLOR_DRAFT = 'rgba(244, 114, 182, 0.4)'

function regionEnd(memo: Memo, duration: number): number {
  if (memo.end !== undefined) return memo.end
  const pad = Math.max(duration * 0.004, POINT_MIN_PAD)
  return memo.start + pad
}

export function YouTubePlayer({
  track,
  memos,
  selectedMemoId,
  onSelectMemo,
  seekRequest,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(track.durationSec)
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const [scrubbing, setScrubbing] = useState(false)
  const scrubStateRef = useRef<{ wasPlaying: boolean; pointerId: number } | null>(
    null,
  )
  const [edgeDrag, setEdgeDrag] = useState<{
    memoId: string
    edge: 'start' | 'end'
    pointerId: number
    preview: number
  } | null>(null)
  const [markStart, setMarkStart] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speed, setSpeed] = useState(1)

  const colorByMemoId = useMemo(() => {
    const sorted = [...memos].sort((a, b) => a.start - b.start)
    const map = new Map<string, string>()
    sorted.forEach((m, i) => {
      const id = m.color ?? defaultColorIdForIndex(i)
      map.set(m.id, getColorHex(id))
    })
    return map
  }, [memos])

  function regionBg(memo: Memo, selected: boolean): string {
    const hex = colorByMemoId.get(memo.id) ?? '#c084fc'
    return hexToRgba(hex, selected ? 0.75 : 0.45)
  }

  useEffect(() => {
    if (!hostRef.current || !track.ytVideoId) return
    let disposed = false
    setReady(false)
    setPlaying(false)
    setTime(0)
    setDuration(track.durationSec)
    setError(null)
    setMarkStart(null)
    setSpeed(1)

    const slot = document.createElement('div')
    slot.style.width = '100%'
    slot.style.height = '100%'
    hostRef.current.appendChild(slot)

    loadYouTubeIframeApi().then((YT) => {
      if (disposed) return
      const player = new YT.Player(slot, {
        videoId: track.ytVideoId,
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (disposed) return
            const d = player.getDuration()
            setReady(true)
            setDuration(d)
            if (track.durationSec === 0 && d > 0) {
              void db.tracks.update(track.id, { durationSec: d })
            }
          },
          onStateChange: (e) => {
            if (e.data === 1) setPlaying(true)
            else if (e.data === 2 || e.data === 0) setPlaying(false)
          },
          onError: (e) => {
            console.error('YT error', e)
            setError(`YouTube error (${e.data})`)
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      disposed = true
      try {
        playerRef.current?.destroy()
      } catch {
        /* ignore */
      }
      playerRef.current = null
      const host = hostRef.current
      while (host && host.firstChild) host.firstChild.remove()
    }
  }, [track.id, track.ytVideoId, track.durationSec])

  useEffect(() => {
    if (!ready) return
    let raf = 0
    const loopMemo = memos.find((m) => m.loop && canLoop(m))
    const loopEnd = loopMemo?.end
    const loopStart = loopMemo?.start ?? 0
    function tick() {
      const p = playerRef.current
      if (p) {
        const t = p.getCurrentTime()
        setTime(t)
        if (loopEnd !== undefined && t >= loopEnd) {
          p.seekTo(loopStart, true)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready, memos])

  useEffect(() => {
    const p = playerRef.current
    if (!p || !ready) return
    const loopMemo = memos.find((m) => m.loop && canLoop(m))
    if (!loopMemo || loopMemo.end === undefined) return
    const start = loopMemo.start
    const end = loopMemo.end
    const t = p.getCurrentTime()
    if (t < start || t >= end) p.seekTo(start, true)
    p.playVideo()
  }, [memos, ready])

  useEffect(() => {
    if (!ready || !seekRequest || !playerRef.current) return
    playerRef.current.seekTo(seekRequest.time, true)
  }, [ready, seekRequest])

  function timeFromX(clientX: number): number {
    const el = timelineRef.current
    if (!el || !duration) return 0
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * duration
  }

  function pctFromX(clientX: number): number | null {
    const el = timelineRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!ready || e.button !== 0) return
    const p = playerRef.current
    if (!p) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const wasPlaying = playing
    scrubStateRef.current = { wasPlaying, pointerId: e.pointerId }
    setScrubbing(true)
    p.seekTo(timeFromX(e.clientX), true)
    if (!wasPlaying) p.playVideo()
  }

  function onPointerMove(e: React.PointerEvent) {
    setHoverPct(pctFromX(e.clientX))
    if (scrubbing && scrubStateRef.current?.pointerId === e.pointerId) {
      playerRef.current?.seekTo(timeFromX(e.clientX), true)
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    if (scrubStateRef.current?.pointerId !== e.pointerId) return
    const { wasPlaying } = scrubStateRef.current
    scrubStateRef.current = null
    setScrubbing(false)
    if (!wasPlaying) playerRef.current?.pauseVideo()
  }

  function onPointerLeave() {
    setHoverPct(null)
  }

  function startEdgeDrag(
    e: React.PointerEvent,
    memo: Memo,
    edge: 'start' | 'end',
  ) {
    if (!ready || memo.end === undefined) return
    e.stopPropagation()
    e.preventDefault()
    const t = edge === 'start' ? memo.start : memo.end
    setEdgeDrag({
      memoId: memo.id,
      edge,
      pointerId: e.pointerId,
      preview: t,
    })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onEdgePointerMove(e: React.PointerEvent) {
    if (!edgeDrag || edgeDrag.pointerId !== e.pointerId) return
    e.stopPropagation()
    const memo = memos.find((m) => m.id === edgeDrag.memoId)
    if (!memo || memo.end === undefined) return
    const t = timeFromX(e.clientX)
    const clamped =
      edgeDrag.edge === 'start'
        ? Math.max(0, Math.min(t, memo.end - 0.05))
        : Math.min(duration, Math.max(t, memo.start + 0.05))
    setEdgeDrag({ ...edgeDrag, preview: clamped })
  }

  function onEdgePointerUp(e: React.PointerEvent) {
    if (!edgeDrag || edgeDrag.pointerId !== e.pointerId) return
    e.stopPropagation()
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    const memo = memos.find((m) => m.id === edgeDrag.memoId)
    if (memo && memo.end !== undefined) {
      const start =
        edgeDrag.edge === 'start' ? edgeDrag.preview : memo.start
      const end = edgeDrag.edge === 'end' ? edgeDrag.preview : memo.end
      if (start !== memo.start || end !== memo.end) {
        void updateMemoBounds(memo, start, end)
      }
    }
    setEdgeDrag(null)
  }

  function togglePlay() {
    const p = playerRef.current
    if (!p) return
    if (playing) p.pauseVideo()
    else p.playVideo()
  }

  function changeSpeed(rate: number) {
    const p = playerRef.current
    if (!p) return
    const available = p.getAvailablePlaybackRates?.() ?? [
      0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2,
    ]
    let best = available[0] ?? 1
    let bestDiff = Math.abs(best - rate)
    for (const r of available) {
      const d = Math.abs(r - rate)
      if (d < bestDiff) {
        best = r
        bestDiff = d
      }
    }
    setSpeed(best)
    p.setPlaybackRate(best)
  }

  function startMark() {
    const p = playerRef.current
    if (!p || !ready) return
    setMarkStart(p.getCurrentTime())
    if (!playing) p.playVideo()
  }

  function endMark() {
    const p = playerRef.current
    if (!p || !ready || markStart === null) return
    const t = p.getCurrentTime()
    const a = Math.min(markStart, t)
    const b = Math.max(markStart, t)
    setMarkStart(null)
    if (b - a < 0.1) return
    void createMemo(track.id, a, b).then((m) => onSelectMemo(m.id))
  }

  function cancelMark() {
    setMarkStart(null)
  }

  function addPointAtCurrentTime() {
    const p = playerRef.current
    if (!p || !ready) return
    void createMemo(track.id, p.getCurrentTime(), undefined).then((m) =>
      onSelectMemo(m.id),
    )
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!ready) return
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey) return
      const p = playerRef.current
      if (!p) return
      const dur = p.getDuration()
      const cur = p.getCurrentTime()
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : 1
      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (playing) p.pauseVideo()
          else p.playVideo()
          return
        case 'ArrowLeft':
          e.preventDefault()
          p.seekTo(Math.max(0, cur - step), true)
          return
        case 'ArrowRight':
          e.preventDefault()
          p.seekTo(Math.min(dur, cur + step), true)
          return
        case 'i':
        case 'I':
          e.preventDefault()
          startMark()
          return
        case 'o':
        case 'O':
          e.preventDefault()
          if (markStart !== null) endMark()
          return
        case 'p':
        case 'P':
          e.preventDefault()
          addPointAtCurrentTime()
          return
        case 'Escape':
          e.preventDefault()
          if (markStart !== null) cancelMark()
          else onSelectMemo(null)
          return
        case 'l':
        case 'L': {
          if (!selectedMemoId) return
          const memo = memos.find((m) => m.id === selectedMemoId)
          if (!memo || !canLoop(memo)) return
          e.preventDefault()
          void setLoop(track.id, memo.loop ? null : memo.id)
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, playing, markStart, selectedMemoId, memos, track.id])

  const playPct = duration > 0 ? (time / duration) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-line bg-black">
        <div ref={hostRef} className="aspect-video w-full" />
      </div>
      <div className="rounded-lg border border-line bg-bg-panel p-3">
        <div
          ref={timelineRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          className="relative h-24 w-full select-none rounded bg-bg-elev"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 6px)',
            cursor: scrubbing ? 'grabbing' : 'pointer',
          }}
        >
          {duration > 0 &&
            memos.map((m) => {
              const isPoint = m.end === undefined
              const isSelected = m.id === selectedMemoId
              const isEdgeDragging = edgeDrag?.memoId === m.id
              const liveStart =
                isEdgeDragging && edgeDrag.edge === 'start'
                  ? edgeDrag.preview
                  : m.start
              const liveEnd =
                !isPoint && isEdgeDragging && edgeDrag.edge === 'end'
                  ? edgeDrag.preview
                  : m.end !== undefined
                    ? m.end
                    : regionEnd(m, duration)
              const startPct = (liveStart / duration) * 100
              const endPct = (liveEnd / duration) * 100
              const widthPct = Math.max(endPct - startPct, 0.25)
              return (
                <div
                  key={m.id}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    playerRef.current?.seekTo(liveStart, true)
                    onSelectMemo(m.id)
                  }}
                  style={{
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    background: regionBg(m, isSelected),
                  }}
                  className="absolute top-0 bottom-0 cursor-pointer rounded-sm"
                  title={m.body || (isPoint ? 'Point memo' : 'Range memo')}
                >
                  {!isPoint && (
                    <>
                      <div
                        onPointerDown={(e) => startEdgeDrag(e, m, 'start')}
                        onPointerMove={onEdgePointerMove}
                        onPointerUp={onEdgePointerUp}
                        onPointerCancel={onEdgePointerUp}
                        className="absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize bg-text-strong/0 hover:bg-text-strong/40"
                      />
                      <div
                        onPointerDown={(e) => startEdgeDrag(e, m, 'end')}
                        onPointerMove={onEdgePointerMove}
                        onPointerUp={onEdgePointerUp}
                        onPointerCancel={onEdgePointerUp}
                        className="absolute top-0 bottom-0 -right-1 w-2 cursor-ew-resize bg-text-strong/0 hover:bg-text-strong/40"
                      />
                    </>
                  )}
                </div>
              )
            })}
          {markStart !== null && duration > 0 && (() => {
            const a = (Math.min(markStart, time) / duration) * 100
            const b = (Math.max(markStart, time) / duration) * 100
            return (
              <div
                style={{
                  left: `${a}%`,
                  width: `${Math.max(b - a, 0.2)}%`,
                  background: COLOR_DRAFT,
                }}
                className="pointer-events-none absolute top-0 bottom-0 rounded-sm"
              />
            )
          })()}
          {ready && (
            <div
              style={{ left: `${playPct}%` }}
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-px bg-text-strong"
            />
          )}
          {hoverPct !== null && !scrubbing && (
            <>
              <div
                style={{ left: `${hoverPct * 100}%` }}
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent"
              />
              <div
                style={{ left: `${hoverPct * 100}%` }}
                className="pointer-events-none absolute -bottom-6 -translate-x-1/2 whitespace-nowrap rounded bg-bg-elev px-1.5 py-0.5 font-mono text-[10px] text-text-strong"
              >
                {formatTime(hoverPct * duration)}
              </div>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={togglePlay}
          className="rounded-md border border-line bg-bg-elev px-4 py-2 text-sm text-text hover:text-text-strong disabled:opacity-50"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        {markStart === null ? (
          <button
            type="button"
            disabled={!ready}
            onClick={startMark}
            className="rounded-md border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-sm text-pink-200 hover:bg-pink-500/20 disabled:opacity-50"
          >
            ▶ Mark start
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={endMark}
              className="rounded-md border border-pink-500/60 bg-pink-500/30 px-3 py-2 text-sm text-pink-100 hover:bg-pink-500/40"
            >
              ■ Mark end ({formatTime(markStart)})
            </button>
            <button
              type="button"
              onClick={cancelMark}
              className="rounded-md border border-line px-2 py-2 text-xs text-text-muted hover:text-text-strong"
            >
              Cancel
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!ready}
          onClick={addPointAtCurrentTime}
          className="rounded-md border border-line bg-bg-elev px-3 py-2 text-sm text-text hover:text-text-strong disabled:opacity-50"
        >
          + Point
        </button>
        <div className="font-mono text-sm tabular-nums text-text-muted">
          {formatTime(time)} <span className="opacity-50">/</span>{' '}
          {formatTime(duration)}
        </div>
        <div className="ml-auto">
          <SpeedInput
            value={speed}
            onCommit={changeSpeed}
            disabled={!ready}
            min={0.25}
            max={2}
          />
        </div>
      </div>
    </div>
  )
}
