import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatTime } from '../lib/format'
import { UploadButton } from './UploadButton'
import { AddYouTubeButton } from './AddYouTubeButton'
import { BackupButtons } from './BackupButtons'

interface Props {
  selectedTrackId: string | null
  onSelect: (trackId: string) => void
}

export function Sidebar({ selectedTrackId, onSelect }: Props) {
  const tracks = useLiveQuery(
    () => db.tracks.orderBy('addedAt').reverse().toArray(),
    [],
    [],
  )

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-bg-panel">
      <div className="space-y-2 border-b border-line p-3">
        <h1 className="text-sm font-medium uppercase tracking-wider text-text-muted">
          Music Note
        </h1>
        <UploadButton onImported={onSelect} />
        <AddYouTubeButton onImported={onSelect} />
      </div>
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {tracks.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-text-muted">
            No tracks yet.
            <br />
            Add an audio file to begin.
          </p>
        ) : (
          <ul className="space-y-0.5 px-1">
            {tracks.map((t) => {
              const active = t.id === selectedTrackId
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? 'bg-accent-dim text-text-strong'
                        : 'text-text hover:bg-bg-elev'
                    }`}
                  >
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="mt-0.5 flex justify-between text-[11px] text-text-muted">
                      <span className="uppercase">{t.source}</span>
                      <span>{formatTime(t.durationSec)}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <BackupButtons />
      </div>
    </aside>
  )
}
