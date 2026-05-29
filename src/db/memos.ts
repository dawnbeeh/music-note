import { db } from './index'
import { defaultColorIdForIndex } from '../lib/colors'
import type { Memo } from './types'

export function parseTags(body: string): string[] {
  void body
  return []
}

export function newId(): string {
  return crypto.randomUUID()
}

export async function createMemo(
  trackId: string,
  start: number,
  end: number | undefined,
  folderPath?: string,
): Promise<Memo> {
  const count = await db.memos.where('trackId').equals(trackId).count()
  const memo: Memo = {
    id: newId(),
    trackId,
    start,
    end,
    body: '',
    tags: [],
    folderPath,
    loop: false,
    createdAt: Date.now(),
    color: defaultColorIdForIndex(count),
  }
  await db.memos.put(memo)
  return memo
}

export async function setMemoColor(id: string, color: string): Promise<void> {
  await db.memos.update(id, { color })
}

export async function updateMemoBody(id: string, body: string): Promise<void> {
  await db.memos.update(id, { body, tags: [] })
}

export async function updateMemoFolder(
  id: string,
  folderPath: string | undefined,
): Promise<void> {
  await db.memos.update(id, { folderPath })
}

export async function updateMemoImage(
  id: string,
  imageDataUrl: string | undefined,
  imageName: string | undefined,
): Promise<void> {
  await db.memos.update(id, { imageDataUrl, imageName })
}

export async function updateMemoBounds(
  id: string,
  start: number,
  end: number | undefined,
): Promise<void> {
  await db.memos.update(id, { start, end })
}

export async function deleteMemo(id: string): Promise<void> {
  await db.memos.delete(id)
}

export async function setLoop(
  trackId: string,
  memoId: string | null,
): Promise<void> {
  await db.transaction('rw', db.memos, async () => {
    const all = await db.memos.where('trackId').equals(trackId).toArray()
    for (const m of all) {
      const desired = m.id === memoId
      if (m.loop !== desired) await db.memos.update(m.id, { loop: desired })
    }
  })
}

export function canLoop(memo: Memo): boolean {
  return memo.end !== undefined && memo.end - memo.start > 0.05
}
