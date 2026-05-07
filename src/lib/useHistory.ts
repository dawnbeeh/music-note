import { useEffect, useState } from 'react'
import { canRedo, canUndo, redo, subscribe, undo } from './history'

export function useHistoryState(trackId: string | null) {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  return {
    canUndo: trackId ? canUndo(trackId) : false,
    canRedo: trackId ? canRedo(trackId) : false,
    undo: () => (trackId ? undo(trackId) : Promise.resolve(false)),
    redo: () => (trackId ? redo(trackId) : Promise.resolve(false)),
  }
}
