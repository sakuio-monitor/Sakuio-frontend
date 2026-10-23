/**
 * IPCos / IPNeko（https://ipneko.cc）
 * - GET /api?ip= — 简要信息
 * - POST /api/analyze — 完整分析（与站点「IP 信息」页一致）
 */
export const IPCOS_ORIGIN = 'https://ipneko.cc'
export const IPCOS_API = `${IPCOS_ORIGIN}/api`
export const IPCOS_ANALYZE = `${IPCOS_ORIGIN}/api/analyze`

export interface IpcosGeoApiRow {
  name: string
  country?: string
  region?: string
  city?: string
  isp?: string
  org?: string
  asn?: string
  lat?: number
  lon?: number
  error?: string
}

export interface IpcosSecApiRow {
  name: string
  country?: string
  region?: string
  city?: string
  isp?: string
  org?: string
  asn?: string
  lat?: number
  lon?: number
  is_proxy?: boolean
  proxy_type?: string
  risk_score?: number
  ports?: number[]
  tags?: string[]
  error?: string
}

export interface IpcosAnalyzeReport {
  ip?: string
  rdns?: string
  ip_type?: string
  proxy_label?: string
  native_status?: string
  score?: number
  score_label?: string
  shared_users?: string
  domains?: string[] | null
  geo_apis?: IpcosGeoApiRow[]
  sec_apis?: IpcosSecApiRow[]
  cached?: boolean
  error?: string
}

function trimSample(text: string, max = 200): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(text) as unknown
    if (data && typeof data === 'object' && !Array.isArray(data))
      return data as Record<string, unknown>
  }
  catch { /* ignore */ }
  return null
}

export function ipcOsErrorMessage(text: string, status: number): string {
  const body = parseJsonObject(text)
  if (body && typeof body.error === 'string' && body.error.trim())
    return body.error.trim()
  if (status === 429)
    return '频率超限，请稍后再试'
  return status ? `HTTP ${status}` : '请求失败'
}

async function ipcOsPostAnalyze(ip: string, signal?: AbortSignal): Promise<Response> {
  return fetch(IPCOS_ANALYZE, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip: ip.trim() }),
    signal,
  })
}

export async function fetchIpcosAnalyze(ip: string, signal?: AbortSignal): Promise<IpcosAnalyzeReport> {
  let response = await ipcOsPostAnalyze(ip, signal)

  if (response.status === 429) {
    const retrySec = Number.parseInt(response.headers.get('Retry-After') ?? '8', 10)
    const waitMs = Math.min(Number.isFinite(retrySec) && retrySec > 0 ? retrySec * 1000 : 8000, 60_000)
    await sleep(waitMs)
    response = await ipcOsPostAnalyze(ip, signal)
  }

  const text = await response.text()
  if (!response.ok)
    throw new Error(ipcOsErrorMessage(text, response.status))

  const data = parseJsonObject(text)
  if (!data)
    throw new Error('返回非 JSON')

  if (typeof data.error === 'string' && data.error.trim())
    throw new Error(data.error.trim())

  const report = data as IpcosAnalyzeReport
  if (!report.ip_type && !report.ip)
    throw new Error('分析结果异常')

  return report
}

export function formatGeoApiLine(row: IpcosGeoApiRow): string {
  if (row.error)
    return row.error
  const parts = [row.country, row.region, row.city, row.isp || row.org, row.asn].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

/** 仅国家 / 省州 / 城市，不含 ISP、ASN */
export function formatGeoLocationLine(row: IpcosGeoApiRow): string {
  if (row.error)
    return row.error
  const parts = [row.country, row.region, row.city].filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

export function formatSecApiLine(row: IpcosSecApiRow): string {
  if (row.error)
    return row.error
  const parts = [row.country, row.region, row.city, row.isp || row.org, row.asn].filter(Boolean)
  let line = parts.length ? parts.join(' ') : '—'
  if (row.proxy_type)
    line += `, ${row.proxy_type}`
  if (row.is_proxy === true && !row.proxy_type)
    line += ', 代理'
  if (row.risk_score != null)
    line += `, 风险 ${row.risk_score}`
  if (row.tags?.length)
    line += `, ${row.tags.join(',')}`
  return line
}

export function pickPrimaryGeo(report: IpcosAnalyzeReport): string {
  const rows = report.geo_apis ?? []
  const preferred = ['GeoLite2', 'IPinfo', 'IP.SB', 'RealIP', 'DB-IP']
  for (const name of preferred) {
    const row = rows.find(r => r.name === name && !r.error)
    if (row)
      return formatGeoApiLine(row)
  }
  const first = rows.find(r => !r.error)
  return first ? formatGeoApiLine(first) : '—'
}

export function pickPrimaryLocation(report: IpcosAnalyzeReport): string {
  const rows = report.geo_apis ?? []
  const preferred = ['GeoLite2', 'IPinfo', 'IP.SB', 'RealIP', 'DB-IP']
  for (const name of preferred) {
    const row = rows.find(r => r.name === name && !r.error)
    if (row)
      return formatGeoLocationLine(row)
  }
  const first = rows.find(r => !r.error)
  return first ? formatGeoLocationLine(first) : '—'
}

export function buildUsageScene(report: IpcosAnalyzeReport): string {
  const parts = [report.ip_type, report.proxy_label].filter(Boolean)
  return parts.join(' ') || '—'
}

export function buildTypeHeadline(report: IpcosAnalyzeReport): string {
  const parts = [report.ip_type, report.proxy_label, report.native_status].filter(Boolean)
  return parts.join(' ') || '—'
}

const MAX_DISPLAY_TAGS = 3

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const t = item.trim()
    if (!t || seen.has(t))
      continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** IP 类型列：至多 3 个标签 */
export function ipTypeTags(report: IpcosAnalyzeReport): string[] {
  return uniqueStrings([
    report.ip_type ?? '',
    report.native_status ?? '',
  ]).slice(0, MAX_DISPLAY_TAGS)
}

/** 使用类型列：至多 3 个标签 */
export function usageTypeTags(report: IpcosAnalyzeReport): string[] {
  const tags: string[] = []
  if (report.proxy_label?.trim())
    tags.push(report.proxy_label.trim())
  for (const row of report.sec_apis ?? []) {
    if (row.proxy_type?.trim())
      tags.push(row.proxy_type.trim())
    if (row.tags?.length)
      tags.push(...row.tags)
    if (row.is_proxy && !row.proxy_type)
      tags.push('代理')
  }
  return uniqueStrings(tags).slice(0, MAX_DISPLAY_TAGS)
}

/** 并行批量，单 IP 失败不拖垮其余 */
export const IPCOS_ANALYZE_MAX_CONCURRENCY = 5

export type IpcosAnalyzeFetchResult =
  | { ok: true, data: IpcosAnalyzeReport }
  | { ok: false, error: string }

export async function fetchIpcosAnalyzeParallel(
  ips: string[],
  options?: {
    concurrency?: number
    /** 每完成一个 IP 立即回调（用于逐行展示） */
    onResult?: (ip: string, result: IpcosAnalyzeFetchResult) => void
  },
): Promise<Map<string, IpcosAnalyzeFetchResult>> {
  const concurrency = options?.concurrency ?? IPCOS_ANALYZE_MAX_CONCURRENCY
  const onResult = options?.onResult
  const results = new Map<string, IpcosAnalyzeFetchResult>()
  const queue = [...ips]
  async function worker() {
    while (queue.length) {
      const ip = queue.shift()
      if (!ip)
        continue
      let result: IpcosAnalyzeFetchResult
      try {
        const data = await fetchIpcosAnalyze(ip)
        result = { ok: true, data }
      }
      catch (error) {
        result = {
          ok: false,
          error: error instanceof Error ? error.message : '查询失败',
        }
      }
      results.set(ip, result)
      onResult?.(ip, result)
    }
  }
  const workers = Math.min(concurrency, Math.max(1, ips.length))
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}
