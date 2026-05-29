import { useEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.esm.js'
import { db } from '../db'
import type { Memo, Track } from '../db/types'
import { canLoop } from '../db/memos'
import {
  createMemo,
  setLoop,
  updateMemoBoundsById,
} from '../lib/memoActions'
import { isTypingTarget, shortcutCode } from '../lib/shortcuts'
import { defaultColorIdForIndex, getColorHex, hexToRgba } from '../lib/colors'
import { formatTime } from '../lib/format'
import { SpeedInput } from './SpeedInput'
import { ZoomInput } from './ZoomInput'
import { MemoDetailBar } from './MemoDetailBar'

const REGION_PREFIX = 'memo_'
const DRAFT_REGION_ID = 'draft_mark'
const POINT_MIN_PAD = 0.5

const COLOR_DRAFT = 'rgba(244, 114, 182, 0.4)'

const ZOOM_BASE = 80
const ZOOM_RATIOS = [0.5, 1, 1.5, 2, 3, 5, 8, 12, 20] as const
const ZOOM_MAX = ZOOM_RATIOS[ZOOM_RATIOS.length - 1] * ZOOM_BASE

function regionEnd(memo: Memo, duration: number): number {
  if (memo.end !== undefined) return memo.end
  const pad = Math.max(duration * 0.004, POINT_MIN_PAD)
  return memo.start + pad
}

interface SeekRequest {
  nonce: number
  time: number
}

interface PlayToggleRequest {
  nonce: number
  start: number
  end?: number
}

interface Props {
  track: Track
  memos: Memo[]
  selectedMemoId: string | null
  onSelectMemo: (id: string | null) => void
  seekRequest: SeekRequest | null
  playToggleRequest: PlayToggleRequest | null
  newMemoFolderPath?: string
}

export function WaveformPlayer({
  track,
  memos,
  selectedMemoId,
  onSelectMemo,
  seekRequest,
  playToggleRequest,
  newMemoFolderPath,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(
    null,
  )
  const memosRef = useRef<Memo[]>(memos)
  memosRef.current = memos

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(track.durationSec)
  const [error, setError] = useState<string | null>(null)
  const [markStart, setMarkStart] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1)
  const [zoom, setZoom] = useState(0)
  const zoomRef = useRef(0)
  zoomRef.current = zoom
  const [followPlayhead, setFollowPlayhead] = useState(true)
  const [peaks, setPeaks] = useState<number[][] | undefined>()

  const colorByMemoId = useMemo(() => {
    const sorted = [...memos].sort((a, b) => a.start - b.start)
    const map = new Map<string, string>()
    sorted.forEach((m, i) => {
      const id = m.color ?? defaultColorIdForIndex(i)
      map.set(m.id, getColorHex(id))
    })
    return map
  }, [memos])

  function regionColor(memo: Memo, selected: boolean): string {
    const hex = colorByMemoId.get(memo.id) ?? '#c084fc'
    return hexToRgba(hex, selected ? 0.75 : 0.45)
  }

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false
    setReady(false)
    setPlaying(false)
    setTime(0)
    setError(null)
    setMarkStart(null)
    setSpeed(1)
    setZoom(0)
    setPeaks(undefined)

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#5b6478',
      progressColor: '#c084fc',
      cursorColor: '#f3f4f6',
      cursorWidth: 2,
      height: 96,
      normalize: true,
      autoScroll: true,
      autoCenter: true,
      plugins: [regions],
    })
    ws.registerPlugin(
      HoverPlugin.create({
        lineColor: '#c084fc',
        lineWidth: 1,
        labelBackground: '#1f2028',
        labelColor: '#f3f4f6',
        labelSize: '11px',
      }),
    )

    wsRef.current = ws
    regionsRef.current = regions

    regions.on('region-clicked', (region, e) => {
      if (!region.id.startsWith(REGION_PREFIX)) return
      e.stopPropagation()
      const id = region.id.slice(REGION_PREFIX.length)
      ws.setTime(region.start)
      onSelectMemo(id)
    })

    ws.on('ready', async () => {
      if (disposed) return
      setReady(true)
      setDuration(ws.getDuration())
      const cached = await db.waveforms.get(track.id)
      if (!cached) {
        const nextPeaks = ws.exportPeaks({ maxLength: 32000 })
        await db.waveforms.put({
          trackId: track.id,
          peaks: nextPeaks,
          duration: ws.getDuration(),
        })
        setPeaks(nextPeaks)
        if (track.durationSec === 0) {
          await db.tracks.update(track.id, { durationSec: ws.getDuration() })
        }
      } else {
        setPeaks(cached.peaks)
      }
    })
    ws.on('play', () => setPlaying(true))
    ws.on('pause', () => setPlaying(false))
    ws.on('finish', () => setPlaying(false))
    ws.on('timeupdate', (t) => setTime(t))
    ws.on('error', (e) => {
      console.error('WaveSurfer error', e)
      setError('Failed to load audio')
    })

    ;(async () => {
      try {
        const audio = await db.audio.get(track.id)
        if (!audio || disposed) {
          if (!audio) setError('Audio data not found in storage')
          return
        }
        const cached = await db.waveforms.get(track.id)
        if (cached) {
          await ws.loadBlob(audio.blob, cached.peaks, cached.duration)
        } else {
          await ws.loadBlob(audio.blob)
        }
      } catch (e) {
        if (!disposed) {
          console.error(e)
          setError('Failed to load audio')
        }
      }
    })()

    return () => {
      disposed = true
      wsRef.current = null
      regionsRef.current = null
      ws.destroy()
    }
  }, [track.id, onSelectMemo])

  useEffect(() => {
    const regions = regionsRef.current
    if (!regions || !ready) return
    const wantedIds = new Set(memos.map((m) => REGION_PREFIX + m.id))
    for (const r of regions.getRegions()) {
      if (r.id.startsWith(REGION_PREFIX) && !wantedIds.has(r.id)) r.remove()
    }
    for (const memo of memos) {
      const id = REGION_PREFIX + memo.id
      const selected = memo.id === selectedMemoId
      const isPoint = memo.end === undefined
      const start = memo.start
      const end = regionEnd(memo, duration)
      const color = regionColor(memo, selected)
      const existing = regions.getRegions().find((r) => r.id === id)
      if (!existing) {
        const memoId = memo.id
        const region = regions.addRegion({
          id,
          start,
          end,
          color,
          drag: false,
          resize: !isPoint,
        })
        if (!isPoint) {
          region.on('update-end', () => {
            const m = memosRef.current.find((x) => x.id === memoId)
            if (m && (m.start !== region.start || m.end !== region.end)) {
              void updateMemoBoundsById(memoId, region.start, region.end)
            }
          })
        }
      } else {
        existing.setOptions({ start, end, color })
      }
    }
  }, [memos, selectedMemoId, ready, duration, colorByMemoId])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready) return
    const loopMemo = memos.find((m) => m.loop && canLoop(m))
    if (!loopMemo || loopMemo.end === undefined) return
    const start = loopMemo.start
    const end = loopMemo.end
    if (ws.getCurrentTime() < start || ws.getCurrentTime() >= end) {
      ws.setTime(start)
    }
    if (!ws.isPlaying()) void ws.play()
    const handler = (t: number) => {
      if (t >= end) ws.setTime(start)
    }
    ws.on('timeupdate', handler)
    return () => {
      ws.un('timeupdate', handler)
    }
  }, [memos, ready])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready || !seekRequest) return
    ws.setTime(seekRequest.time)
  }, [seekRequest, ready])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready || !playToggleRequest) return
    const { start, end } = playToggleRequest
    const cur = ws.getCurrentTime()
    const within =
      end !== undefined
        ? cur >= start && cur < end
        : cur >= start && cur < start + 1
    if (ws.isPlaying() && within) {
      ws.pause()
    } else {
      ws.setTime(start)
      void ws.play()
    }
  }, [playToggleRequest, ready])

  useEffect(() => {
    const ws = wsRef.current
    const regions = regionsRef.current
    if (!ws || !regions || !ready) return
    const existing = regions.getRegions().find((r) => r.id === DRAFT_REGION_ID)
    if (markStart === null) {
      existing?.remove()
      return
    }
    const update = (t: number) => {
      const a = Math.min(markStart, t)
      const b = Math.max(markStart, t)
      const end = Math.max(b, a + 0.05)
      const cur = regions.getRegions().find((r) => r.id === DRAFT_REGION_ID)
      if (cur) {
        cur.setOptions({ start: a, end, color: COLOR_DRAFT })
      } else {
        regions.addRegion({
          id: DRAFT_REGION_ID,
          start: a,
          end,
          color: COLOR_DRAFT,
          drag: false,
          resize: false,
        })
      }
    }
    update(ws.getCurrentTime())
    ws.on('timeupdate', update)
    return () => {
      ws.un('timeupdate', update)
    }
  }, [markStart, ready])

  // Apply zoom
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready) return
    ws.zoom(zoom)
  }, [zoom, ready])

  // Auto-tracking toggle: when on, waveform scrolls/centers to follow the playhead
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !ready) return
    ws.setOptions({
      autoScroll: followPlayhead,
      autoCenter: followPlayhead,
    })
  }, [followPlayhead, ready])

  // Wheel zoom (around cursor) + Shift-wheel pan; drag-scrub with audio
  useEffect(() => {
    if (!ready) return
    const ws = wsRef.current
    const scrollEl = containerRef.current?.querySelector(
      '[part="scroll"]',
    ) as HTMLElement | null
    if (!ws || !scrollEl) return

    function getWrapper(): HTMLElement | null {
      return scrollEl!.querySelector('[part="wrapper"]') as HTMLElement | null
    }
    function timeFromX(clientX: number): number {
      const wrapper = getWrapper()
      const dur = ws!.getDuration()
      if (!wrapper || dur <= 0) return 0
      const r = wrapper.getBoundingClientRect()
      return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur))
    }

    function onWheel(e: WheelEvent) {
      const dur = ws!.getDuration()
      if (dur <= 0) return
      if (e.shiftKey || e.deltaX !== 0) {
        e.preventDefault()
        scrollEl!.scrollLeft += e.deltaY + e.deltaX
        return
      }
      e.preventDefault()
      const minZoom = scrollEl!.clientWidth / dur
      const wrapper = getWrapper()
      if (!wrapper) return
      const wRect = wrapper.getBoundingClientRect()
      const tAtMouse = Math.max(
        0,
        Math.min(dur, ((e.clientX - wRect.left) / wRect.width) * dur),
      )
      const cur = zoomRef.current === 0 ? minZoom : zoomRef.current
      const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
      let next = Math.max(minZoom, Math.min(ZOOM_MAX, cur * factor))
      if (next < minZoom * 1.02) next = 0
      setZoom(next)
      const mouseInScroll = e.clientX - scrollEl!.getBoundingClientRect().left
      requestAnimationFrame(() => {
        const w = getWrapper()
        if (!w) return
        const newWidth = w.getBoundingClientRect().width
        const targetX = (tAtMouse / dur) * newWidth
        scrollEl!.scrollLeft = Math.max(0, targetX - mouseInScroll)
      })
    }

    let scrubActive = false
    let scrubPointerId = -1
    let wasPlaying = false
    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (
        target.closest('[part*="region"]') ||
        target.closest('[part*="marker"]')
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      scrubActive = true
      scrubPointerId = e.pointerId
      try {
        scrollEl!.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      wasPlaying = ws!.isPlaying()
      ws!.setTime(timeFromX(e.clientX))
      if (!wasPlaying) void ws!.play()
      scrollEl!.style.cursor = 'grabbing'
    }
    function onPointerMove(e: PointerEvent) {
      if (!scrubActive || e.pointerId !== scrubPointerId) return
      ws!.setTime(timeFromX(e.clientX))
    }
    function onPointerEnd(e: PointerEvent) {
      if (!scrubActive || e.pointerId !== scrubPointerId) return
      scrubActive = false
      try {
        scrollEl!.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      if (!wasPlaying) ws!.pause()
      scrollEl!.style.cursor = ''
    }

    scrollEl.addEventListener('wheel', onWheel, { passive: false })
    scrollEl.addEventListener('pointerdown', onPointerDown, true)
    scrollEl.addEventListener('pointermove', onPointerMove)
    scrollEl.addEventListener('pointerup', onPointerEnd)
    scrollEl.addEventListener('pointercancel', onPointerEnd)

    return () => {
      scrollEl.removeEventListener('wheel', onWheel)
      scrollEl.removeEventListener('pointerdown', onPointerDown, true)
      scrollEl.removeEventListener('pointermove', onPointerMove)
      scrollEl.removeEventListener('pointerup', onPointerEnd)
      scrollEl.removeEventListener('pointercancel', onPointerEnd)
    }
  }, [ready])

  function changeSpeed(rate: number) {
    setSpeed(rate)
    wsRef.current?.setPlaybackRate(rate, true)
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!ready) return
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey) return
      const ws = wsRef.current
      if (!ws) return
      const dur = ws.getDuration()
      const cur = ws.getCurrentTime()
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : 1
      switch (shortcutCode(e)) {
        case 'Space':
          e.preventDefault()
          ws.playPause()
          return
        case 'ArrowLeft':
          e.preventDefault()
          ws.setTime(Math.max(0, cur - step))
          return
        case 'ArrowRight':
          e.preventDefault()
          ws.setTime(Math.min(dur, cur + step))
          return
        case 'KeyI':
          e.preventDefault()
          startMark()
          return
        case 'KeyO':
          e.preventDefault()
          if (markStart !== null) endMark()
          return
        case 'KeyP':
          e.preventDefault()
          addPointAtCurrentTime()
          return
        case 'Escape':
          e.preventDefault()
          if (markStart !== null) cancelMark()
          else onSelectMemo(null)
          return
        case 'Equal':
        case 'NumpadAdd':
          e.preventDefault()
          zoomIn()
          return
        case 'Minus':
        case 'NumpadSubtract':
          e.preventDefault()
          zoomOut()
          return
        case 'Digit0':
        case 'Numpad0':
          e.preventDefault()
          zoomReset()
          return
        case 'BracketLeft':
          e.preventDefault()
          changeSpeed(Math.max(0.25, speed - 0.05))
          return
        case 'BracketRight':
          e.preventDefault()
          changeSpeed(Math.min(4, speed + 0.05))
          return
        case 'KeyL': {
          if (!selectedMemoId) return
          const memo = memosRef.current.find((m) => m.id === selectedMemoId)
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
  }, [ready, markStart, selectedMemoId, track.id])

  function zoomIn() {
    setZoom((z) => {
      const ratio = z / ZOOM_BASE
      const next = ZOOM_RATIOS.find((r) => r > ratio + 1e-3)
      return next !== undefined ? next * ZOOM_BASE : z
    })
  }
  function zoomOut() {
    setZoom((z) => {
      if (z === 0) return 0
      const ratio = z / ZOOM_BASE
      const prev = [...ZOOM_RATIOS].reverse().find((r) => r < ratio - 1e-3)
      return prev !== undefined ? prev * ZOOM_BASE : 0
    })
  }
  function zoomReset() {
    setZoom(0)
  }

  function startMark() {
    const ws = wsRef.current
    if (!ws || !ready) return
    setMarkStart(ws.getCurrentTime())
    if (!ws.isPlaying()) void ws.play()
  }

  function endMark() {
    const ws = wsRef.current
    if (!ws || !ready || markStart === null) return
    const t = ws.getCurrentTime()
    const a = Math.min(markStart, t)
    const b = Math.max(markStart, t)
    setMarkStart(null)
    if (b - a < 0.1) return
    void createMemo(track.id, a, b, newMemoFolderPath).then((m) =>
      onSelectMemo(m.id),
    )
  }

  function cancelMark() {
    setMarkStart(null)
  }

  function addPointAtCurrentTime() {
    const ws = wsRef.current
    if (!ws || !ready) return
    void createMemo(
      track.id,
      ws.getCurrentTime(),
      undefined,
      newMemoFolderPath,
    ).then((m) => onSelectMemo(m.id))
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      <div className="shrink-0 rounded-lg border border-line bg-bg-panel p-4">
        <div ref={containerRef} className="min-h-[96px]" />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
      <MemoDetailBar
        memo={memos.find((m) => m.id === selectedMemoId) ?? null}
        duration={duration}
        peaks={peaks}
      />
      <div className="shrink-0 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => wsRef.current?.playPause()}
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
        <div className="ml-auto flex items-center gap-3">
          <label className="flex select-none items-center gap-2 text-xs text-text-muted">
            <span>Track</span>
            <button
              type="button"
              role="switch"
              aria-checked={followPlayhead}
              disabled={!ready}
              onClick={() => setFollowPlayhead((v) => !v)}
              title={
                followPlayhead
                  ? 'Stop following playhead'
                  : 'Follow playhead (auto-scroll)'
              }
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-40 ${
                followPlayhead
                  ? 'border-accent bg-accent'
                  : 'border-line bg-bg-elev'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                  followPlayhead ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <span>Zoom</span>
            <button
              type="button"
              disabled={!ready || zoom === 0}
              onClick={zoomOut}
              className="grid h-6 w-6 place-items-center rounded border border-line text-text hover:text-text-strong disabled:opacity-40"
            >
              −
            </button>
            <ZoomInput
              value={zoom}
              base={ZOOM_BASE}
              max={ZOOM_MAX}
              onCommit={setZoom}
              disabled={!ready}
            />
            <button
              type="button"
              disabled={!ready || zoom >= ZOOM_MAX}
              onClick={zoomIn}
              className="grid h-6 w-6 place-items-center rounded border border-line text-text hover:text-text-strong disabled:opacity-40"
            >
              +
            </button>
          </div>
          <SpeedInput
            value={speed}
            onCommit={changeSpeed}
            disabled={!ready}
          />
        </div>
      </div>
    </div>
  )
}
