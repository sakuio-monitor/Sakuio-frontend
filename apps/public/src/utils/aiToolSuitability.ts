import type { IpcosAnalyzeReport } from '@/utils/ipnekoApi'
import { getRegionCode } from '@/utils/regionHelper'

export type AiToolSuitabilityLabel =
  | '不适用'
  | '高风险'
  | '中高风险'
  | '中风险'
  | '中低风险'
  | '低风险'
  | '优秀'
  | '完美'

const LABEL_ORDER: AiToolSuitabilityLabel[] = [
  '不适用',
  '高风险',
  '中高风险',
  '中风险',
  '中低风险',
  '低风险',
  '优秀',
  '完美',
]

const LABEL_RANK: Record<AiToolSuitabilityLabel, number> = {
  不适用: 0,
  高风险: 1,
  中高风险: 2,
  中风险: 3,
  中低风险: 4,
  低风险: 5,
  优秀: 6,
  完美: 7,
}

export function isAiToolRegionExcluded(region: string): boolean {
  const code = getRegionCode(region).toUpperCase()
  return code === 'CN' || code === 'HK' || code === 'MO'
}

function parseSharedUsersMid(text?: string): number | null {
  if (!text?.trim())
    return null
  const nums = [...text.matchAll(/\d+/g)].map(m => Number(m[0])).filter(n => Number.isFinite(n))
  if (!nums.length)
    return null
  return nums.reduce((sum, n) => sum + n, 0) / nums.length
}

function isNativeIp(nativeStatus?: string): boolean {
  const s = nativeStatus ?? ''
  if (!s.includes('原生'))
    return false
  return !/非原生/.test(s)
}

function isBroadcastIp(nativeStatus?: string): boolean {
  return (nativeStatus ?? '').includes('广播')
}

function isDatacenterIp(ipType?: string): boolean {
  return /datacenter|机房|idc|hosting/i.test(ipType ?? '')
}

function isResidentialLike(ipType?: string): boolean {
  return /residential|住宅|家庭|商宽|business|商业|企业/i.test(ipType ?? '')
}

function hasProxySignal(report: IpcosAnalyzeReport): boolean {
  if (report.proxy_label?.trim())
    return true
  return (report.sec_apis ?? []).some(row => row.is_proxy || Boolean(row.proxy_type?.trim()))
}

function hasStrongProxySignal(report: IpcosAnalyzeReport): boolean {
  const label = report.proxy_label ?? ''
  if (/匿名代理|vpn|tor/i.test(label))
    return true
  return (report.sec_apis ?? []).some(row =>
    /vpn|tor|proxy|datacenter/i.test(row.proxy_type ?? ''),
  )
}

function scoreLabelBonus(scoreLabel?: string): number {
  const s = scoreLabel ?? ''
  if (/极度纯净|excellent/i.test(s))
    return 10
  if (/纯净|clean/i.test(s))
    return 6
  if (/较差|poor|high risk|很差/i.test(s))
    return -10
  return 0
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n))
}

function scoreToLabel(effective: number): AiToolSuitabilityLabel {
  if (effective >= 92)
    return '完美'
  if (effective >= 84)
    return '优秀'
  if (effective >= 70)
    return '低风险'
  if (effective >= 58)
    return '中低风险'
  if (effective >= 46)
    return '中风险'
  if (effective >= 32)
    return '中高风险'
  return '高风险'
}

function minLabel(a: AiToolSuitabilityLabel, b: AiToolSuitabilityLabel): AiToolSuitabilityLabel {
  return LABEL_RANK[a] <= LABEL_RANK[b] ? a : b
}

function maxLabel(a: AiToolSuitabilityLabel, b: AiToolSuitabilityLabel): AiToolSuitabilityLabel {
  return LABEL_RANK[a] >= LABEL_RANK[b] ? a : b
}

/** 根据 IPCos 分析结果评估 AI 工具出口适用性（不含 CN/HK/MO，需先排除） */
export function evaluateAiToolSuitability(report: IpcosAnalyzeReport): AiToolSuitabilityLabel {
  const score = report.score ?? 50
  const native = isNativeIp(report.native_status)
  const broadcast = isBroadcastIp(report.native_status)
  const datacenter = isDatacenterIp(report.ip_type)
  const residential = isResidentialLike(report.ip_type)
  const proxy = hasProxySignal(report)
  const strongProxy = hasStrongProxySignal(report)
  const sharedMid = parseSharedUsersMid(report.shared_users)
  const lowSharing = sharedMid == null || sharedMid < 10
  const mediumSharing = sharedMid != null && sharedMid >= 10 && sharedMid < 100
  const highSharing = sharedMid != null && sharedMid >= 100

  let effective = score + scoreLabelBonus(report.score_label)

  if (native)
    effective += 6
  if (residential && !datacenter)
    effective += 5
  if (lowSharing)
    effective += 4
  if (highSharing)
    effective -= 12
  else if (mediumSharing)
    effective -= 5

  if (broadcast)
    effective -= 11
  if (datacenter)
    effective -= 9

  if (strongProxy)
    effective -= native && score >= 68 ? 10 : 18
  else if (proxy)
    effective -= native && score >= 68 ? 6 : 12

  effective = clampScore(effective)
  let label = scoreToLabel(effective)

  // 原生商宽/家宽 + 评分尚可 + 低共享（如 So-net 74）：低风险，有强代理信号时不高于低风险
  if (native && !broadcast && residential && score >= 72 && lowSharing) {
    label = maxLabel(label, '低风险')
    if (strongProxy || proxy)
      label = minLabel(label, '低风险')
    else if (score >= 88)
      label = maxLabel(label, '优秀')
  }

  // 原生家宽但分数偏低 + 强代理特征（如 Oracle 60）
  if (native && residential && strongProxy && score < 65)
    label = minLabel(label, '高风险')

  // 机房 + 广播 + 代理：Cloud/VPS 出口
  if (datacenter && broadcast && proxy) {
    label = minLabel(label, score < 52 ? '高风险' : '中高风险')
    if (score >= 80)
      label = minLabel(label, '中高风险')
    else
      label = minLabel(label, '中低风险')
  }

  // 低分 + 机房（如 RackNerd 30）
  if (datacenter && score <= 35)
    label = '高风险'

  return label
}

export function aiToolSuitabilityForNode(
  region: string,
  report: IpcosAnalyzeReport | null,
): AiToolSuitabilityLabel | null {
  if (isAiToolRegionExcluded(region))
    return '不适用'
  if (!report)
    return null
  return evaluateAiToolSuitability(report)
}

export function aiToolSuitabilityTagType(
  label: AiToolSuitabilityLabel,
): 'default' | 'error' | 'warning' | 'info' | 'success' {
  switch (label) {
    case '完美':
    case '优秀':
      return 'success'
    case '低风险':
      return 'info'
    case '中低风险':
    case '中风险':
      return 'warning'
    case '中高风险':
    case '高风险':
      return 'error'
    default:
      return 'default'
  }
}

export { LABEL_ORDER as AI_TOOL_SUITABILITY_LABELS }
