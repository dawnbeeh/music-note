import { db } from '../db'
import type { Memo } from '../db/types'

interface Entry {
  trackId: string
  before: Memo[]
  after: Memo[]
  label: string
}

const MAX = 50
const past: Entry[] = []
const future: Entry[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const fn of listeners) fn()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

async function snapshot(trackId: string): Promise<Memo[]> {
  const rows = await db.memos.where('trackId').equals(trackId).toArray()
  return rows.map((m) => ({ ...m, tags: [...m.tags] }))
}

function memosEqual(a: Memo[], b: Memo[]): boolean {
  if (a.length !== b.length) return false
  const map = new Map(a.map((m) => [m.id, m]))
  for (const m of b) {
    const o = map.get(m.id)
    if (!o) return false
    if (
      o.start !== m.start ||
      o.end !== m.end ||
      o.body !== m.body ||
      o.color !== m.color ||
      o.loop !== m.loop ||
      o.tags.length !== m.tags.length ||
      o.tags.some((t, i) => t !== m.tags[i])
    ) {
      return false
    }
  }
  return true
}

export async function record<T>(
  trackId: string,
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  const before = await snapshot(trackId)
  const result = await action()
  const after = await snapshot(trackId)
  if (!memosEqual(before, after)) {
    past.push({ trackId, before, after, label })
    if (past.length > MAX) past.shift()
    future.length = 0
    notify()
  }
  return result
}

async function restore(trackId: string, memos: Memo[]): Promise<void> {
  await db.transaction('rw', db.memos, async () => {
    await db.memos.where('trackId').equals(trackId).delete()
    if (memos.length) await db.memos.bulkAdd(memos)
  })
}

function popLastForTrack(stack: Entry[], trackId: string): Entry | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].trackId === trackId) {
      const [entry] = stack.splice(i, 1)
      return entry
    }
  }
  return null
}

export async function undo(trackId: string): Promise<boolean> {
  const entry = popLastForTrack(past, trackId)
  if (!entry) return false
  await restore(trackId, entry.before)
  future.push(entry)
  notify()
  return true
}

export async function redo(trackId: string): Promise<boolean> {
  const entry = popLastForTrack(future, trackId)
  if (!entry) return false
  await restore(trackId, entry.after)
  past.push(entry)
  notify()
  return true
}

export function canUndo(trackId: string): boolean {
  return past.some((e) => e.trackId === trackId)
}

export function canRedo(trackId: string): boolean {
  return future.some((e) => e.trackId === trackId)
}

export function clearHistory(): void {
  past.length = 0
  future.length = 0
  notify()
}
