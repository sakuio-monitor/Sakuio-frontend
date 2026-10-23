export interface PingRecordLike {
  value: number
}

export interface PingQualitySummary {
  avgLatencyMs: number | null
  lossPercent: number | null
  sampleCount: number
}

export type PingQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface PingQualityPresentation {
  label: string
  level: PingQualityLevel
  tagType: 'success' | 'info' | 'warning' | 'error' | 'default'
}

/** 从 Ping 采样汇总平均延迟与丢包率 */
export function summarizePingRecords(records: PingRecordLike[]): PingQualitySummary {
  if (!records.length) {
    return { avgLatencyMs: null, lossPercent: null, sampleCount: 0 }
  }

  let lossCount = 0
  let latencySum = 0
  let latencyCount = 0

  for (const record of records) {
    const value = record.value
    if (!Number.isFinite(value) || value < 0) {
      lossCount++
      continue
    }
    latencySum += value
    latencyCount++
  }

  const total = records.length
  return {
    avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
    lossPercent: total > 0 ? (lossCount / total) * 100 : null,
    sampleCount: total,
  }
}

export function formatPingLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms))
    return '—'
  return `${Math.round(ms)} ms`
}

export function formatPingLoss(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent))
    return '—'
  return `${percent.toFixed(1)}%`
}

/** 条形图上方一行：窗口内平均延迟 + 丢包率（空格分隔，与历史 latest 行格式一致） */
export function formatPingAverageLine(
  summary: Pick<PingQualitySummary, 'avgLatencyMs' | 'lossPercent' | 'sampleCount'>,
): string {
  if (summary.sampleCount <= 0)
    return '—'
  const latency = summary.avgLatencyMs === null
    ? '不可达'
    : formatPingLatency(summary.avgLatencyMs)
  return `${latency} ${formatPingLoss(summary.lossPercent)}`
}

export function getPingQualityPresentation(
  summary: Pick<PingQualitySummary, 'avgLatencyMs' | 'lossPercent' | 'sampleCount'>,
): PingQualityPresentation {
  if (summary.sampleCount <= 0) {
    return { label: '无数据', level: 'unknown', tagType: 'default' }
  }

  const latency = summary.avgLatencyMs
  const loss = summary.lossPercent ?? 0

  if (loss >= 15 || (latency !== null && latency >= 250)) {
    return { label: '较差', level: 'poor', tagType: 'error' }
  }
  if (loss >= 6 || (latency !== null && latency >= 160)) {
    return { label: '一般', level: 'fair', tagType: 'warning' }
  }
  if (loss >= 1.5 || (latency !== null && latency >= 100)) {
    return { label: '良好', level: 'good', tagType: 'info' }
  }
  return { label: '优秀', level: 'excellent', tagType: 'success' }
}

/** 与 NodeList 标签列一致的矩形标签配色 */
export function getPingQualityTagColor(level: PingQualityLevel): string {
  switch (level) {
    case 'excellent':
      return '#30A46C'
    case 'good':
      return '#0090FF'
    case 'fair':
      return '#F97316'
    case 'poor':
      return '#E54D2E'
    default:
      return '#8D8D8D'
  }
}

export function getPingQualityTagStyle(level: PingQualityLevel): {
  color: string
  textColor: string
  borderColor: string
} {
  const base = getPingQualityTagColor(level)
  return {
    color: `${base}20`,
    textColor: base,
    borderColor: `${base}40`,
  }
}
