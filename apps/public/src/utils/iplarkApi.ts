/** IPLark 公开 API（文档见 iplark.com / ipapi/public） */
export const IPLARK_ORIGIN = 'https://iplark.com'

export const IPLARK_PUBLIC_IPINFO = `${IPLARK_ORIGIN}/ipapi/public/ipinfo`
export const IPLARK_PUBLIC_PTR = `${IPLARK_ORIGIN}/ipapi/public/ptr`

export type IplarkDb = 'ipstack' | 'ipdata' | 'ipapi' | 'digital' | 'moon'

export interface IplarkCorsProbeResult {
  ok: boolean
  corsLikely: boolean
  status: number | null
  endpoint: string
  message: string
  sample?: string
}

export interface IplarkIpInfo {
  ip?: string
  type?: string
  country_name?: string
  country_code?: string
  region_name?: string
  city?: string
  latitude?: number
  longitude?: number
  connection?: {
    asn?: number
    isp?: string
  }
  security?: {
    is_proxy?: boolean
    proxy_type?: string | null
    is_crawler?: boolean
    is_tor?: boolean
    threat_level?: string
    hosting_facility?: boolean
  }
  location?: {
    calling_code?: string
  }
  /** 部分数据源返回的评分字段 */
  score?: number
  ip_routing_type?: string
  connection_type?: string
}

export interface IplarkPtrResult {
  ip: string
  rdns?: string
}

function trimJsonSample(text: string, max = 240): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

export function buildIplarkIpInfoUrl(options: {
  db?: IplarkDb
  lang?: string
  ip?: string
} = {}): string {
  const params = new URLSearchParams()
  params.set('db', options.db ?? 'ipstack')
  if (options.lang)
    params.set('lang', options.lang)
  if (options.ip?.trim())
    params.set('ip', options.ip.trim())
  return `${IPLARK_PUBLIC_IPINFO}?${params.toString()}`
}

export function buildIplarkPtrUrl(ip: string): string {
  return `${IPLARK_PUBLIC_PTR}?ip=${encodeURIComponent(ip.trim())}`
}

/** 浏览器直连 IPLark，检测跨域是否可用（仅探测，不保证指定 IP 查询能力） */
export async function probeIplarkCorsAccess(
  endpoint = buildIplarkIpInfoUrl({ db: 'ipstack', lang: 'zh' }),
  timeoutMs = 12_000,
): Promise<IplarkCorsProbeResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    })
    const corsLikely = true
    const text = await response.text()
    if (!response.ok) {
      return {
        ok: false,
        corsLikely,
        status: response.status,
        endpoint,
        message: `HTTP ${response.status}`,
        sample: trimJsonSample(text),
      }
    }
    return {
      ok: true,
      corsLikely,
      status: response.status,
      endpoint,
      message: '跨域请求成功',
      sample: trimJsonSample(text),
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const corsBlocked = /failed to fetch|networkerror|cors/i.test(message)
    return {
      ok: false,
      corsLikely: !corsBlocked,
      status: null,
      endpoint,
      message: corsBlocked ? '浏览器跨域被拦截（CORS / 混合内容）' : message,
    }
  }
  finally {
    clearTimeout(timer)
  }
}

export async function fetchIplarkIpInfo(ip: string, signal?: AbortSignal): Promise<IplarkIpInfo> {
  const url = buildIplarkIpInfoUrl({ db: 'ipstack', lang: 'zh', ip })
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    signal,
  })
  const text = await response.text()
  if (!response.ok)
    throw new Error(`IPLark ${response.status}: ${trimJsonSample(text, 120)}`)
  let data: unknown
  try {
    data = JSON.parse(text)
  }
  catch {
    throw new Error('IPLark 返回非 JSON')
  }
  if (!data || typeof data !== 'object')
    throw new Error('IPLark 响应无效')
  return data as IplarkIpInfo
}

export async function fetchIplarkPtr(ip: string, signal?: AbortSignal): Promise<IplarkPtrResult> {
  const response = await fetch(buildIplarkPtrUrl(ip), {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    signal,
  })
  const text = await response.text()
  if (!response.ok)
    throw new Error(`PTR ${response.status}`)
  return JSON.parse(text) as IplarkPtrResult
}

export function summarizeIplarkIpInfo(info: IplarkIpInfo): {
  locationLabel: string
  ispLabel: string
  qualityLabel: string
  proxyLabel: string
  hostingLabel: string
} {
  const parts = [info.country_name, info.region_name, info.city].filter(Boolean)
  const locationLabel = parts.join(' ') || '—'
  const ispLabel = info.connection?.isp
    ? (info.connection.asn ? `AS${info.connection.asn} ${info.connection.isp}` : info.connection.isp)
    : '—'
  const sec = info.security
  let qualityLabel = '—'
  if (typeof info.score === 'number' && Number.isFinite(info.score))
    qualityLabel = String(Math.round(info.score))
  else if (sec?.threat_level)
    qualityLabel = sec.threat_level
  else if (info.ip_routing_type || info.connection_type)
    qualityLabel = [info.ip_routing_type, info.connection_type].filter(Boolean).join(' / ')

  const proxyLabel = sec?.is_proxy
    ? (sec.proxy_type || '代理')
    : (sec?.is_tor ? 'Tor' : '否')
  const hostingLabel = sec?.hosting_facility ? '是' : (sec ? '否' : '—')

  return { locationLabel, ispLabel, qualityLabel, proxyLabel, hostingLabel }
}
