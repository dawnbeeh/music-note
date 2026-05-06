import { useEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import HoverPlugin from 'wavesurfer.js/dist/plugins/hover.esm.js'
import { db } from '../db'
import type { Memo, Track } from '../db/types'
import {
  canLoop,
  createMemo,
  updateMemoBounds,
} from '../db/memos'
import { defaultColorIdForIndex, getColorHex, hexToRgba } from '../lib/colors'
import { formatTime } from '../lib/format'
import { SpeedInput } from './SpeedInput'

const REGION_PREFIX = 'memo_'
const DRAFT_REGION_ID = 'draft_mark'
const POINT_MIN_PAD = 0.5

const COLOR_DRAG = 'rgba(244, 114, 182, 0.32)'
const COLOR_DRAFT = 'rgba(244, 114, 182, 0.4)'

const ZOOM_BASE = 80
const ZOOM_MAX = 1600

function regionEnd(memo: Memo, duration: number): number {
  if (memo.end !== undefined) return memo.end
  const pad = Math.max(duration * 0.004, POINT_MIN_PAD)
  return memo.start + pad
}

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

export function WaveformPlayer({
  track,
  memos,
  selectedMemoId,
  onSelectMemo,
  seekRequest,
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

    const regions = RegionsPlugin.create()
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#5b6478',
      progressColor: '#c084fc',
      cursorColor: '#f3f4f6',
      cursorWidth: 2,
      height: 96,
      normalize: true,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
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

    regions.enableDragSelection({ color: COLOR_DRAG })

    regions.on('region-created', async (region) => {
      if (region.id.startsWith(REGION_PREFIX)) return
      if (region.id === DRAFT_REGION_ID) return
      region.remove()
      const start = region.start
      const end =
        region.end > region.start + 0.05 ? region.end : undefined
      const memo = await createMemo(track.id, start, end)
      onSelectMemo(memo.id)
    })

    regions.on('region-updated', async (region) => {
      if (!region.id.startsWith(REGION_PREFIX)) return
      const id = region.id.slice(REGION_PREFIX.length)
      const memo = memosRef.current.find((m) => m.id === id)
      if (!memo) return
      if (memo.end === undefined) return
      if (memo.start === region.start && memo.end === region.end) return
      await updateMemoBounds(id, region.start, region.end)
    })

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
        const peaks = ws.exportPeaks({ maxLength: 8000 })
        await db.waveforms.put({
          trackId: track.id,
          peaks,
          duration: ws.getDuration(),
        })
        if (track.durationSec === 0) {
          await db.tracks.update(track.id, { durationSec: ws.getDuration() })
        }
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
        regions.addRegion({
          id,
          start,
          end,
          color,
          drag: !isPoint,
          resize: !isPoint,
        })
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

  // Edge-scroll while hovering near horizontal edges
  useEffect(() => {
    if (!ready) return
    const scrollEl = containerRef.current?.querySelector(
      '[part="scroll"]',
    ) as HTMLElement | null
    if (!scrollEl) return

    let velocity = 0
    let raf = 0
    const EDGE = 90
    const MAX = 18

    function onMove(e: MouseEvent) {
      if (scrollEl!.scrollWidth <= scrollEl!.clientWidth) {
        velocity = 0
        return
      }
      const rect = scrollEl!.getBoundingClientRect()
      const x = e.clientX - rect.left
      if (x < EDGE) {
        const k = 1 - x / EDGE
        velocity = -MAX * k * k
      } else if (x > rect.width - EDGE) {
        const k = 1 - (rect.width - x) / EDGE
        velocity = MAX * k * k
      } else {
        velocity = 0
      }
    }
    function onLeave() {
      velocity = 0
    }
    function tick() {
      if (velocity !== 0) {
        const max = scrollEl!.scrollWidth - scrollEl!.clientWidth
        scrollEl!.scrollLeft = Math.max(
          0,
          Math.min(max, scrollEl!.scrollLeft + velocity),
        )
      }
      raf = requestAnimationFrame(tick)
    }

    scrollEl.addEventListener('mousemove', onMove)
    scrollEl.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      scrollEl.removeEventListener('mousemove', onMove)
      scrollEl.removeEventListener('mouseleave', onLeave)
    }
  }, [ready])

  function changeSpeed(rate: number) {
    setSpeed(rate)
    wsRef.current?.setPlaybackRate(rate, true)
  }

  function zoomIn() {
    setZoom((z) => (z === 0 ? ZOOM_BASE : Math.min(z * 2, ZOOM_MAX)))
  }
  function zoomOut() {
    setZoom((z) => {
      if (z === 0) return 0
      if (z <= ZOOM_BASE) return 0
      return z / 2
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
    void createMemo(track.id, a, b).then((m) => onSelectMemo(m.id))
  }

  function cancelMark() {
    setMarkStart(null)
  }

  function addPointAtCurrentTime() {
    const ws = wsRef.current
    if (!ws || !ready) return
    void createMemo(track.id, ws.getCurrentTime(), undefined).then((m) =>
      onSelectMemo(m.id),
    )
  }

  const zoomLabel = zoom === 0 ? 'fit' : `${(zoom / ZOOM_BASE).toFixed(0)}×`

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-line bg-bg-panel p-4">
        <div ref={containerRef} className="min-h-[96px]" />
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
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
            <button
              type="button"
              disabled={!ready || zoom === 0}
              onClick={zoomReset}
              className="min-w-[36px] rounded border border-line px-1 py-0.5 font-mono text-[11px] text-text hover:text-text-strong disabled:opacity-40"
            >
              {zoomLabel}
            </button>
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
