import { useEffect, useMemo, useRef, useState } from 'react'
import type { Memo, Track } from '../db/types'
import { canLoop } from '../db/memos'
import {
  deleteMemo,
  setLoop,
  setMemoColor,
  updateMemoBody,
  updateMemoBounds,
} from '../lib/memoActions'
import { MEMO_COLORS, getColorHex } from '../lib/colors'
import { MemoTimeInput } from './MemoTimeInput'

interface Props {
  track: Track | null
  memos: Memo[]
  selectedMemoId: string | null
  onSelect: (id: string | null) => void
  onSeek: (sec: number) => void
  onTogglePlay: (start: number, end: number | undefined) => void
}

export function MemoPanel({
  track,
  memos,
  selectedMemoId,
  onSelect,
  onSeek,
  onTogglePlay,
}: Props) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())

  useEffect(() => {
    setActiveFilters(new Set())
  }, [track?.id])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const m of memos) for (const t of m.tags) s.add(t)
    return Array.from(s).sort()
  }, [memos])

  const sortedMemos = useMemo(
    () => [...memos].sort((a, b) => a.start - b.start),
    [memos],
  )

  const filtered = useMemo(() => {
    if (activeFilters.size === 0) return sortedMemos
    return sortedMemos.filter((m) =>
      [...activeFilters].every((f) => m.tags.includes(f)),
    )
  }, [sortedMemos, activeFilters])

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    sortedMemos.forEach((m, i) => map.set(m.id, i + 1))
    return map
  }, [sortedMemos])

  function toggleFilter(tag: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  if (!track) {
    return (
      <section className="rounded-lg border border-line bg-bg-panel p-6 text-sm text-text-muted">
        Select a track to see its memos.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-line bg-bg-panel">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-text-strong">Memos</h2>
          <span className="text-xs text-text-muted">
            {filtered.length}
            {activeFilters.size > 0 ? ` / ${memos.length}` : ''}
          </span>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1">
            {allTags.map((tag) => {
              const active = activeFilters.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleFilter(tag)}
                  className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                    active
                      ? 'bg-accent text-bg'
                      : 'border border-line text-text hover:text-text-strong'
                  }`}
                >
                  #{tag}
                </button>
              )
            })}
            {activeFilters.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveFilters(new Set())}
                className="ml-1 text-xs text-text-muted hover:text-text-strong"
              >
                clear
              </button>
            )}
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">
          {memos.length === 0
            ? 'No memos yet. Drag the waveform, hit Mark while playing, or use + Point.'
            : 'No memos match the active filters.'}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((m) => (
            <MemoItem
              key={m.id}
              memo={m}
              index={indexById.get(m.id) ?? 0}
              selected={m.id === selectedMemoId}
              onSelect={() => onSelect(m.id)}
              onSeek={onSeek}
              onTogglePlay={onTogglePlay}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface ItemProps {
  memo: Memo
  index: number
  selected: boolean
  onSelect: () => void
  onSeek: (sec: number) => void
  onTogglePlay: (start: number, end: number | undefined) => void
}

function MemoItem({
  memo,
  index,
  selected,
  onSelect,
  onSeek,
  onTogglePlay,
}: ItemProps) {
  const [body, setBody] = useState(memo.body)
  const [colorOpen, setColorOpen] = useState(false)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    setBody(memo.body)
  }, [memo.id, memo.body])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) {
        window.clearTimeout(saveTimer.current)
      }
    }
  }, [])

  function onChange(value: string) {
    setBody(value)
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void updateMemoBody(memo, value)
    }, 350)
  }

  function flush() {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (body !== memo.body) void updateMemoBody(memo, body)
  }

  function commitStart(sec: number) {
    if (memo.end !== undefined && sec > memo.end) {
      void updateMemoBounds(memo, memo.end, sec)
    } else {
      void updateMemoBounds(memo, sec, memo.end)
    }
  }

  function commitEnd(sec: number) {
    if (sec < memo.start) {
      void updateMemoBounds(memo, sec, memo.start)
    } else {
      void updateMemoBounds(memo, memo.start, sec)
    }
  }

  const isPoint = memo.end === undefined
  const loopable = canLoop(memo)
  const colorHex = getColorHex(memo.color)

  return (
    <li
      onClick={() => {
        onSelect()
        onSeek(memo.start)
      }}
      className={`cursor-pointer px-4 py-3 transition-colors ${
        selected ? 'bg-bg-elev/50' : ''
      }`}
      style={{ borderLeft: `3px solid ${colorHex}` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setColorOpen((v) => !v)
          }}
          className="grid h-6 w-6 place-items-center rounded-full ring-2 ring-line hover:ring-text-muted"
          style={{ background: colorHex }}
          title="Change color"
        >
          <span className="text-[10px] font-semibold text-bg">{index}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
            onTogglePlay(memo.start, memo.end)
          }}
          className="rounded border border-line px-2 py-1 text-xs text-text hover:text-text-strong"
          title="Play / pause"
        >
          ▶
        </button>
        {loopable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void setLoop(memo.trackId, memo.loop ? null : memo.id)
            }}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              memo.loop
                ? 'bg-cyan-500/30 text-cyan-200'
                : 'border border-line text-text-muted hover:text-text-strong'
            }`}
            title={memo.loop ? 'Stop looping' : 'Loop this section'}
          >
            ↻ {memo.loop ? 'Looping' : 'Loop'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <MemoTimeInput
            value={memo.start}
            onCommit={commitStart}
            ariaLabel="Start time"
            className="w-24 rounded border border-line bg-bg-elev px-2 py-1 font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none"
          />
          {!isPoint && memo.end !== undefined && (
            <>
              <span className="text-xs text-text-muted">→</span>
              <MemoTimeInput
                value={memo.end}
                onCommit={commitEnd}
                ariaLabel="End time"
                className="w-24 rounded border border-line bg-bg-elev px-2 py-1 font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none"
              />
            </>
          )}
          {isPoint && (
            <span className="text-xs text-text-muted">point memo</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void deleteMemo(memo)
            }}
            className="ml-1 rounded px-2 py-1 text-xs text-text-muted hover:text-red-400"
            title="Delete memo"
          >
            ✕
          </button>
        </div>
      </div>
      {colorOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-2 flex items-center gap-1.5"
        >
          {MEMO_COLORS.map((c) => {
            const active = memo.color === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  void setMemoColor(memo, c.id)
                  setColorOpen(false)
                }}
                className={`h-5 w-5 rounded-full ring-2 transition-transform hover:scale-110 ${
                  active ? 'ring-text-strong' : 'ring-transparent'
                }`}
                style={{ background: c.hex }}
                title={c.label}
              />
            )
          })}
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        onClick={(e) => e.stopPropagation()}
        placeholder="Notes… use #tags to group"
        rows={2}
        className="mt-2 w-full resize-y rounded border border-line bg-bg-elev px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
      {memo.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {memo.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-bg-elev px-2 py-0.5 text-[10px] text-text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </li>
  )
}
