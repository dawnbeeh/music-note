import { db } from './index'
import type { Folder } from './types'

export function newId(): string {
  return crypto.randomUUID()
}

export function normalizePath(path: string): string {
  return path
    .toLowerCase()
    .trim()
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '')
}

export async function addFolder(
  trackId: string,
  rawPath: string,
): Promise<string | null> {
  const path = normalizePath(rawPath)
  if (!path) return null
  const existing = await db.folders
    .where('[trackId+path]')
    .equals([trackId, path])
    .first()
  if (existing) return existing.path
  await db.folders.put({
    id: newId(),
    trackId,
    path,
    createdAt: Date.now(),
  })
  return path
}

export async function renameFolder(
  trackId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const oldP = normalizePath(oldPath)
  const newP = normalizePath(newPath)
  if (!oldP || !newP || oldP === newP) return

  await db.transaction('rw', db.folders, db.memos, async () => {
    const folders = await db.folders.where('trackId').equals(trackId).toArray()
    for (const f of folders) {
      if (f.path === oldP) {
        await db.folders.update(f.id, { path: newP })
      } else if (f.path.startsWith(oldP + '/')) {
        await db.folders.update(f.id, { path: newP + f.path.slice(oldP.length) })
      }
    }

    const memos = await db.memos.where('trackId').equals(trackId).toArray()
    for (const m of memos) {
      if (m.folderPath === oldP) {
        await db.memos.update(m.id, { folderPath: newP })
      } else if (m.folderPath?.startsWith(oldP + '/')) {
        await db.memos.update(m.id, {
          folderPath: newP + m.folderPath.slice(oldP.length),
        })
      }
    }
  })
}

export async function deleteFolder(
  trackId: string,
  rawPath: string,
): Promise<void> {
  const path = normalizePath(rawPath)
  if (!path) return
  await db.transaction('rw', db.folders, db.memos, async () => {
    const folders = await db.folders.where('trackId').equals(trackId).toArray()
    for (const f of folders) {
      if (f.path === path || f.path.startsWith(path + '/')) {
        await db.folders.delete(f.id)
      }
    }
    const memos = await db.memos.where('trackId').equals(trackId).toArray()
    for (const m of memos) {
      if (m.folderPath === path || m.folderPath?.startsWith(path + '/')) {
        await db.memos.update(m.id, { folderPath: undefined })
      }
    }
  })
}

export function collectFolders(memos: Folder[], rows: Folder[]): Folder[] {
  return [...memos, ...rows]
}
