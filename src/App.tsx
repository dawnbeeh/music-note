import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { Sidebar } from './components/Sidebar'
import { WaveformPlayer } from './components/WaveformPlayer'
import { YouTubePlayer } from './components/YouTubePlayer'
import { MemoPanel } from './components/MemoPanel'
import { WelcomeModal } from './components/WelcomeModal'
import { ShortcutHelp } from './components/ShortcutHelp'
import { redo, undo } from './lib/history'
import { useHistoryState } from './lib/useHistory'
import { isTypingTarget } from './lib/shortcuts'

interface SeekRequest {
  nonce: number
  time: number
}

interface PlayToggleRequest {
  nonce: number
  start: number
  end?: number
}

function App() {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null)
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null)
  const [playToggleRequest, setPlayToggleRequest] =
    useState<PlayToggleRequest | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const history = useHistoryState(selectedTrackId)

  const track = useLiveQuery(
    async () =>
      selectedTrackId ? await db.tracks.get(selectedTrackId) : undefined,
    [selectedTrackId],
  )

  const memos = useLiveQuery(
    async () =>
      selectedTrackId
        ? await db.memos.where('trackId').equals(selectedTrackId).toArray()
        : [],
    [selectedTrackId],
    [],
  )

  useEffect(() => {
    if (selectedTrackId || track !== undefined) return
    let cancelled = false
    db.tracks
      .orderBy('addedAt')
      .reverse()
      .first()
      .then((t) => {
        if (!cancelled && t) setSelectedTrackId(t.id)
      })
    return () => {
      cancelled = true
    }
  }, [selectedTrackId, track])

  useEffect(() => {
    setSelectedMemoId(null)
  }, [selectedTrackId])

  function requestSeek(time: number) {
    setSeekRequest({ nonce: Date.now(), time })
  }

  function requestPlayToggle(start: number, end: number | undefined) {
    setPlayToggleRequest({ nonce: Date.now(), start, end })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (!selectedTrackId) return
        if (e.shiftKey) void redo(selectedTrackId)
        else void undo(selectedTrackId)
        return
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShowHelp((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedTrackId])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <WelcomeModal />
      {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
      <Sidebar
        selectedTrackId={selectedTrackId}
        onSelect={setSelectedTrackId}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-medium text-text-strong">
              {track ? track.title : 'No track selected'}
            </h2>
            {track && (
              <p className="mt-0.5 text-xs uppercase tracking-wider text-text-muted">
                {track.source}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => selectedTrackId && void undo(selectedTrackId)}
              disabled={!history.canUndo}
              title="Undo (⌘/Ctrl+Z)"
              className="rounded-md border border-line px-2 py-1.5 text-xs text-text hover:text-text-strong disabled:opacity-30"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={() => selectedTrackId && void redo(selectedTrackId)}
              disabled={!history.canRedo}
              title="Redo (⇧⌘/Ctrl+Z)"
              className="rounded-md border border-line px-2 py-1.5 text-xs text-text hover:text-text-strong disabled:opacity-30"
            >
              ↷ Redo
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              title="Keyboard shortcuts (?)"
              className="ml-1 rounded-md border border-line px-2 py-1.5 text-xs text-text hover:text-text-strong"
            >
              ⌨ Shortcuts
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-6">
            {track ? (
              <>
                {track.source === 'youtube' ? (
                  <YouTubePlayer
                    key={track.id}
                    track={track}
                    memos={memos}
                    selectedMemoId={selectedMemoId}
                    onSelectMemo={setSelectedMemoId}
                    seekRequest={seekRequest}
                    playToggleRequest={playToggleRequest}
                  />
                ) : (
                  <WaveformPlayer
                    key={track.id}
                    track={track}
                    memos={memos}
                    selectedMemoId={selectedMemoId}
                    onSelectMemo={setSelectedMemoId}
                    seekRequest={seekRequest}
                    playToggleRequest={playToggleRequest}
                  />
                )}
                <MemoPanel
                  track={track}
                  memos={memos}
                  selectedMemoId={selectedMemoId}
                  onSelect={setSelectedMemoId}
                  onSeek={requestSeek}
                  onTogglePlay={requestPlayToggle}
                />
              </>
            ) : (
              <div className="flex h-[60vh] items-center justify-center text-sm text-text-muted">
                Add or select a track from the sidebar.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
