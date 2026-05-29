import {
  createMemo as rawCreate,
  deleteMemo as rawDelete,
  setLoop as rawSetLoop,
  setMemoColor as rawSetColor,
  updateMemoBody as rawUpdateBody,
  updateMemoBounds as rawUpdateBounds,
  updateMemoFolder as rawUpdateFolder,
  updateMemoImage as rawUpdateImage,
} from '../db/memos'
import { db } from '../db'
import type { Memo } from '../db/types'
import { record } from './history'

// History tracks structural changes only: create, delete, bounds.
// Body / color / loop changes are left out so undo doesn't fight every keystroke.

export async function createMemo(
  trackId: string,
  start: number,
  end: number | undefined,
  folderPath?: string,
): Promise<Memo> {
  return record(trackId, 'Add memo', () =>
    rawCreate(trackId, start, end, folderPath),
  )
}

export async function deleteMemo(memo: Memo): Promise<void> {
  await record(memo.trackId, 'Delete memo', () => rawDelete(memo.id))
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

export async function setLoop(
  trackId: string,
  memoId: string | null,
): Promise<void> {
  await rawSetLoop(trackId, memoId)
}

export async function setMemoColor(memo: Memo, color: string): Promise<void> {
  await rawSetColor(memo.id, color)
}

export async function updateMemoBody(memo: Memo, body: string): Promise<void> {
  await rawUpdateBody(memo.id, body)
}

export async function updateMemoFolder(
  memo: Memo,
  folderPath: string | undefined,
): Promise<void> {
  await rawUpdateFolder(memo.id, folderPath)
}

export async function updateMemoImage(
  memo: Memo,
  imageDataUrl: string | undefined,
  imageName: string | undefined,
): Promise<void> {
  await rawUpdateImage(memo.id, imageDataUrl, imageName)
}
