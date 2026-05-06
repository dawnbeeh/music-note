import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { Sidebar } from './components/Sidebar'
import { WaveformPlayer } from './components/WaveformPlayer'
import { YouTubePlayer } from './components/YouTubePlayer'
import { MemoPanel } from './components/MemoPanel'
import { WelcomeModal } from './components/WelcomeModal'

interface SeekRequest {
  nonce: number
  time: number
}

function App() {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null)
  const [seekRequest, setSeekRequest] = useState<SeekRequest | null>(null)

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg text-text">
      <WelcomeModal />
      <Sidebar
        selectedTrackId={selectedTrackId}
        onSelect={setSelectedTrackId}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-line px-6 py-4">
          <h2 className="truncate text-lg font-medium text-text-strong">
            {track ? track.title : 'No track selected'}
          </h2>
          {track && (
            <p className="mt-0.5 text-xs uppercase tracking-wider text-text-muted">
              {track.source}
            </p>
          )}
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
                  />
                ) : (
                  <WaveformPlayer
                    key={track.id}
                    track={track}
                    memos={memos}
                    selectedMemoId={selectedMemoId}
                    onSelectMemo={setSelectedMemoId}
                    seekRequest={seekRequest}
                  />
                )}
                <MemoPanel
                  track={track}
                  memos={memos}
                  selectedMemoId={selectedMemoId}
                  onSelect={setSelectedMemoId}
                  onSeek={requestSeek}
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
