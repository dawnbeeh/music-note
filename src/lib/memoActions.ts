import {
  createMemo as rawCreate,
  deleteMemo as rawDelete,
  setLoop as rawSetLoop,
  setMemoColor as rawSetColor,
  updateMemoBody as rawUpdateBody,
  updateMemoBounds as rawUpdateBounds,
} from '../db/memos'
import { db } from '../db'
import type { Memo } from '../db/types'
import { record } from './history'

export async function createMemo(
  trackId: string,
  start: number,
  end: number | undefined,
): Promise<Memo> {
  return record(trackId, 'Add memo', () => rawCreate(trackId, start, end))
}

export async function deleteMemo(memo: Memo): Promise<void> {
  await record(memo.trackId, 'Delete memo', () => rawDelete(memo.id))
}

export async function setLoop(
  trackId: string,
  memoId: string | null,
): Promise<void> {
  await record(trackId, 'Toggle loop', () => rawSetLoop(trackId, memoId))
}

export async function setMemoColor(memo: Memo, color: string): Promise<void> {
  await record(memo.trackId, 'Change color', () =>
    rawSetColor(memo.id, color),
  )
}

export async function updateMemoBody(memo: Memo, body: string): Promise<void> {
  await record(memo.trackId, 'Edit memo', () => rawUpdateBody(memo.id, body))
}

export async function updateMemoBounds(
  memo: Memo,
  start: number,
  end: number | undefined,
): Promise<void> {
  await record(memo.trackId, 'Move memo', () =>
    rawUpdateBounds(memo.id, start, end),
  )
}

export async function updateMemoBoundsById(
  id: string,
  start: number,
  end: number | undefined,
): Promise<void> {
  const m = await db.memos.get(id)
  if (!m) return
  await updateMemoBounds(m, start, end)
}
