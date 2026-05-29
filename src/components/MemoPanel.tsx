import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { addFolder, deleteFolder, normalizePath, renameFolder } from '../db/folders'
import type { Memo, Track } from '../db/types'
import { canLoop } from '../db/memos'
import {
  deleteMemo,
  setLoop,
  setMemoColor,
  updateMemoBody,
  updateMemoBounds,
  updateMemoFolder,
  updateMemoImage,
} from '../lib/memoActions'
import { MEMO_COLORS, getColorHex } from '../lib/colors'
import { MemoTimeInput } from './MemoTimeInput'

interface Props {
  track: Track | null
  memos: Memo[]
  selectedMemoId: string | null
  onSelect: (id: string | null) => void
  onSeek: (sec: number) => void
  onTogglePlay: (
    memoId: string,
    start: number,
    end: number | undefined,
  ) => void
  onNewMemoFolderChange: (folderPath: string | undefined) => void
}

const ALL = '__all__'
const UNCATEGORIZED = '__uncategorized__'

export function MemoPanel({
  track,
  memos,
  selectedMemoId,
  onSelect,
  onSeek,
  onTogglePlay,
  onNewMemoFolderChange,
}: Props) {
  const [activeFolder, setActiveFolder] = useState<string>(ALL)
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const folderRows = useLiveQuery(
    () =>
      track ? db.folders.where('trackId').equals(track.id).toArray() : [],
    [track?.id],
    [],
  )

  useEffect(() => {
    setActiveFolder(ALL)
    onNewMemoFolderChange(undefined)
  }, [track?.id])

  function activateFolder(path: string) {
    setActiveFolder(path)
    onNewMemoFolderChange(
      path === ALL || path === UNCATEGORIZED ? undefined : path,
    )
  }

  const sortedMemos = useMemo(
    () => [...memos].sort((a, b) => a.start - b.start),
    [memos],
  )

  const folderNames = useMemo(() => {
    const set = new Set<string>()
    for (const m of memos) if (m.folderPath) set.add(m.folderPath)
    for (const f of folderRows) set.add(f.path)
    return Array.from(set).sort()
  }, [memos, folderRows])

  const filtered = useMemo(() => {
    if (activeFolder === ALL) return sortedMemos
    if (activeFolder === UNCATEGORIZED) {
      return sortedMemos.filter((m) => !m.folderPath)
    }
    return sortedMemos.filter((m) => m.folderPath === activeFolder)
  }, [sortedMemos, activeFolder])

  const indexById = useMemo(() => {
    const map = new Map<string, number>()
    sortedMemos.forEach((m, i) => map.set(m.id, i + 1))
    return map
  }, [sortedMemos])

  async function createFolder() {
    if (!track) return
    const name = window.prompt('Folder name')
    if (!name) return
    const path = await addFolder(track.id, name)
    if (path) activateFolder(path)
  }

  async function commitRename() {
    if (!track || !renaming) return
    const next = normalizePath(renameDraft)
    const old = renaming
    setRenaming(null)
    if (!next || next === old) return
    await renameFolder(track.id, old, next)
    if (activeFolder === old) activateFolder(next)
  }

  async function removeFolder(path: string) {
    if (!track) return
    const ok = window.confirm(`Delete folder "${path}"? Memos will stay.`)
    if (!ok) return
    await deleteFolder(track.id, path)
    if (activeFolder === path) activateFolder(ALL)
  }

  if (!track) {
    return (
      <section className="h-full border-l border-line bg-bg-panel p-4 text-sm text-text-muted">
        Select a track to see its memos.
      </section>
    )
  }

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-line bg-bg-panel">
      <div className="shrink-0 border-b border-line px-3 py-3">
        <div className="flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-text-strong">
            Memos
          </h2>
          <span className="text-xs text-text-muted">{filtered.length}</span>
        </div>
      </div>

      <div className="shrink-0 border-b border-line p-2">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setFoldersOpen((v) => !v)}
            className="text-[10px] uppercase tracking-wider text-text-muted hover:text-text-strong"
          >
            {foldersOpen ? 'Hide folders' : 'Show folders'}
          </button>
          {foldersOpen && (
            <button
              type="button"
              onClick={createFolder}
              className="rounded border border-line px-2 py-0.5 text-xs text-text hover:text-text-strong"
            >
              +
            </button>
          )}
        </div>
        {foldersOpen ? (
          <div className="flex max-h-32 flex-col gap-1 overflow-y-auto">
            <FolderButton
              label="All"
              count={memos.length}
              active={activeFolder === ALL}
              onClick={() => activateFolder(ALL)}
            />
            <FolderButton
              label="No folder"
              count={memos.filter((m) => !m.folderPath).length}
              active={activeFolder === UNCATEGORIZED}
              onClick={() => activateFolder(UNCATEGORIZED)}
            />
            {folderNames.map((path) => (
              <div key={path} className="group flex items-center gap-1">
                {renaming === path ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    className="min-w-0 flex-1 rounded border border-accent bg-bg-elev px-2 py-1 text-xs text-text-strong focus:outline-none"
                  />
                ) : (
                  <FolderButton
                    label={path}
                    count={memos.filter((m) => m.folderPath === path).length}
                    active={activeFolder === path}
                    onClick={() => activateFolder(path)}
                  />
                )}
                {renaming !== path && (
                  <div className="hidden shrink-0 gap-0.5 group-hover:flex">
                    <button
                      type="button"
                      title="Rename"
                      onClick={() => {
                        setRenaming(path)
                        setRenameDraft(path)
                      }}
                      className="grid h-6 w-6 place-items-center rounded text-xs text-text-muted hover:bg-bg-elev hover:text-text-strong"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => void removeFolder(path)}
                      className="grid h-6 w-6 place-items-center rounded text-xs text-text-muted hover:bg-red-500/20 hover:text-red-300"
                    >
                      Del
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="truncate px-1 text-xs text-text-muted">
            {activeFolder === ALL
              ? 'All memos'
              : activeFolder === UNCATEGORIZED
                ? 'No folder'
                : activeFolder}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            {memos.length === 0
              ? 'No memos yet. Use Mark start/end or + Point.'
              : 'No memos in this folder.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((m) => (
              <MemoItem
                key={m.id}
                memo={m}
                folders={folderNames}
                index={indexById.get(m.id) ?? 0}
                selected={m.id === selectedMemoId}
                onSelect={() => onSelect(m.id)}
                onSeek={onSeek}
                onTogglePlay={onTogglePlay}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function FolderButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs ${
        active ? 'bg-accent-dim text-text-strong' : 'text-text hover:bg-bg-elev'
      }`}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-text-muted">{count}</span>
    </button>
  )
}

interface ItemProps {
  memo: Memo
  folders: string[]
  index: number
  selected: boolean
  onSelect: () => void
  onSeek: (sec: number) => void
  onTogglePlay: (
    memoId: string,
    start: number,
    end: number | undefined,
  ) => void
}

function MemoItem({
  memo,
  folders,
  index,
  selected,
  onSelect,
  onSeek,
  onTogglePlay,
}: ItemProps) {
  const [body, setBody] = useState(memo.body)
  const [colorOpen, setColorOpen] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setBody(memo.body)
  }, [memo.id, memo.body])

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
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

  async function attachImage(file: File) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    await updateMemoImage(memo, dataUrl, file.name)
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
      className={`cursor-pointer px-3 py-3 transition-colors ${
        selected ? 'bg-bg-elev/60' : ''
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
            onTogglePlay(memo.id, memo.start, memo.end)
          }}
          className="rounded border border-line px-2 py-1 text-xs text-text hover:text-text-strong"
          title="Play / pause"
        >
          Play
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
          >
            Loop
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            fileRef.current?.click()
          }}
          className="rounded border border-line px-2 py-1 text-xs text-text-muted hover:text-text-strong"
        >
          Image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.currentTarget.value = ''
            if (file) void attachImage(file)
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void deleteMemo(memo)
          }}
          className="ml-auto rounded px-2 py-1 text-xs text-text-muted hover:text-red-400"
        >
          Delete
        </button>
      </div>

      {colorOpen && (
        <div onClick={(e) => e.stopPropagation()} className="mt-2 flex gap-1.5">
          {MEMO_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                void setMemoColor(memo, c.id)
                setColorOpen(false)
              }}
              className={`h-5 w-5 rounded-full ring-2 transition-transform hover:scale-110 ${
                memo.color === c.id ? 'ring-text-strong' : 'ring-transparent'
              }`}
              style={{ background: c.hex }}
              title={c.label}
            />
          ))}
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()} className="mt-2 grid gap-2">
        <select
          value={memo.folderPath ?? ''}
          onChange={(e) =>
            void updateMemoFolder(memo, e.target.value || undefined)
          }
          className="rounded border border-line bg-bg-elev px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        {memo.imageDataUrl && (
          <button
            type="button"
            onClick={() => onTogglePlay(memo.id, memo.start, memo.end)}
            className="overflow-hidden rounded border border-line bg-bg-elev text-left"
            title="Play this memo"
          >
            <img
              src={memo.imageDataUrl}
              alt={memo.imageName ?? 'Memo image'}
              className="max-h-40 w-full object-contain"
            />
          </button>
        )}

        <textarea
          value={body}
          onChange={(e) => onChange(e.target.value)}
          onBlur={flush}
          placeholder="Memo"
          rows={4}
          className="w-full resize-y rounded border border-line bg-bg-elev px-2 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <MemoTimeInput
            value={memo.start}
            onCommit={commitStart}
            ariaLabel="Start time"
            className="w-24 rounded border border-line bg-bg-elev px-2 py-1 font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none"
          />
          {!isPoint && memo.end !== undefined ? (
            <>
              <span className="text-xs text-text-muted">to</span>
              <MemoTimeInput
                value={memo.end}
                onCommit={commitEnd}
                ariaLabel="End time"
                className="w-24 rounded border border-line bg-bg-elev px-2 py-1 font-mono text-xs tabular-nums text-text focus:border-accent focus:outline-none"
              />
            </>
          ) : (
            <span className="text-xs text-text-muted">point memo</span>
          )}
        </div>
      </div>
    </li>
  )
}
