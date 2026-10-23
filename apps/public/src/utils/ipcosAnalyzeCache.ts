import type { IpcosAnalyzeReport } from '@/utils/ipnekoApi'

const STORAGE_KEY = 'sakuioNaiveIpcosAnalyzeCache'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface CacheEntry {
  fetchedAt: number
  report: IpcosAnalyzeReport
}

type CacheStore = Record<string, CacheEntry>

function readStore(): CacheStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object')
      return {}
    return parsed as CacheStore
  }
  catch {
    return {}
  }
}

function writeStore(store: CacheStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }
  catch { /* quota */ }
}

function pruneStore(store: CacheStore): CacheStore {
  const now = Date.now()
  const next: CacheStore = {}
  for (const [ip, entry] of Object.entries(store)) {
    if (entry && now - entry.fetchedAt < TTL_MS)
      next[ip] = entry
  }
  return next
}

export function getCachedIpcosAnalyze(ip: string): IpcosAnalyzeReport | null {
  const key = ip.trim()
  if (!key)
    return null
  const store = pruneStore(readStore())
  writeStore(store)
  const entry = store[key]
  if (!entry || Date.now() - entry.fetchedAt >= TTL_MS)
    return null
  return entry.report
}

export function setCachedIpcosAnalyze(ip: string, report: IpcosAnalyzeReport) {
  const key = ip.trim()
  if (!key)
    return
  const store = pruneStore(readStore())
  store[key] = { fetchedAt: Date.now(), report }
  writeStore(store)
}
