import type { Memo, Track } from '../db/types'
interface Props {
  track: Track | null
  memo: Memo | null
  onPlay: (memoId: string, start: number, end: number | undefined) => void
}

export function MemoStage({ track, memo, onPlay }: Props) {
  void track
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden border-b border-line bg-bg">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_220px] gap-4 overflow-hidden p-4">
        <div className="flex min-h-0 items-center justify-center overflow-hidden rounded-md border border-line bg-bg-panel">
          {memo?.imageDataUrl ? (
            <img
              src={memo.imageDataUrl}
              alt={memo.imageName ?? 'Memo image'}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="px-6 text-center text-sm text-text-muted">
              Attach an image to a memo from the right panel.
            </div>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto rounded-md border border-line bg-bg-panel p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-text-muted">
              Note
            </span>
            {memo && (
              <button
                type="button"
                onClick={() => onPlay(memo.id, memo.start, memo.end)}
                className="ml-auto rounded border border-line px-2 py-1 text-xs text-text-muted hover:text-text-strong"
              >
                Play
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-text">
            {memo?.body || 'No memo selected.'}
          </p>
        </div>
      </div>
    </section>
  )
}
