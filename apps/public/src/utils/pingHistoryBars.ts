import type { PingRecord } from '@/utils/rpc'

/** 与 Plus 列表/卡片一致的固定格数 */
export const PING_HISTORY_BAR_COUNT = 20

export interface PingLatencyBar {
  key: string
  className: string
  tooltip: string
}

export interface LatestPingSample {
  latencyMs: number | null
  lossPercent: number | null
  sampleTime: string | null
}

function formatBucketTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** 取最新一条采样（按 time 排序） */
export function computeLatestPingSample(
  records: readonly Pick<PingRecord, 'time' | 'value'>[],
): LatestPingSample {
  if (!records.length) {
    return { latencyMs: null, lossPercent: null, sampleTime: null }
  }

  let latest: Pick<PingRecord, 'time' | 'value'> | null = null
  let latestAt = Number.NEGATIVE_INFINITY
  for (const record of records) {
    const at = new Date(record.time).getTime()
    if (!Number.isFinite(at))
      continue
    if (at >= latestAt) {
      latestAt = at
      latest = record
    }
  }

  if (!latest) {
    return { latencyMs: null, lossPercent: null, sampleTime: null }
  }

  if (latest.value < 0 || !Number.isFinite(latest.value)) {
    return {
      latencyMs: null,
      lossPercent: 100,
      sampleTime: latest.time,
    }
  }

  return {
    latencyMs: latest.value,
    lossPercent: 0,
    sampleTime: latest.time,
  }
}

export function formatLatestPingLine(sample: LatestPingSample): string {
  if (!sample.sampleTime)
    return '—'
  const latency = sample.latencyMs === null
    ? '不可达'
    : `${Math.round(sample.latencyMs)} ms`
  const loss = sample.lossPercent === null
    ? '—'
    : `${sample.lossPercent.toFixed(1)}%`
  return `${latency} ${loss}`
}

/** 延迟格配色（对齐 Plus signal 档位） */
export function getLatencyBarClass(latencyMs: number): string {
  if (latencyMs <= 60)
    return 'ping-bar ping-bar--l1'
  if (latencyMs <= 100)
    return 'ping-bar ping-bar--l2'
  if (latencyMs <= 160)
    return 'ping-bar ping-bar--l3'
  if (latencyMs <= 200)
    return 'ping-bar ping-bar--l4'
  return 'ping-bar ping-bar--l5'
}

export function createEmptyPingLatencyBars(tooltip = '无采样'): PingLatencyBar[] {
  return Array.from({ length: PING_HISTORY_BAR_COUNT }, (_, index) => ({
    key: `empty-${index}`,
    className: 'ping-bar ping-bar--empty',
    tooltip,
  }))
}

/**
 * 将 Ping 采样切成固定数量时间格，左旧右新（最后一格最接近当前）。
 */
export function buildLatencyBarsFromRecords(
  records: readonly Pick<PingRecord, 'time' | 'value'>[],
  hours: number,
  barCount = PING_HISTORY_BAR_COUNT,
): PingLatencyBar[] {
  const now = Date.now()
  const windowStart = now - Math.max(1, hours) * 3_600_000
  const windowMs = Math.max(1, now - windowStart)
  const bucketMs = windowMs / barCount

  const buckets = Array.from({ length: barCount }, () => ({
    latencies: [] as number[],
    lossCount: 0,
  }))

  for (const record of records) {
    const timestamp = new Date(record.time).getTime()
    if (!Number.isFinite(timestamp))
      continue
    if (timestamp < windowStart || timestamp > now)
      continue
    const index = Math.min(barCount - 1, Math.floor((timestamp - windowStart) / bucketMs))
    const bucket = buckets[index]
    if (!bucket)
      continue
    if (record.value < 0 || !Number.isFinite(record.value))
      bucket.lossCount++
    else
      bucket.latencies.push(record.value)
  }

  return buckets.map((bucket, index) => {
    const bucketEnd = windowStart + (index + 1) * bucketMs
    const timeLabel = formatBucketTime(bucketEnd)

    const sampleTotal = bucket.latencies.length + bucket.lossCount
    if (bucket.latencies.length > 0) {
      const avg = bucket.latencies.reduce((sum, value) => sum + value, 0) / bucket.latencies.length
      const lossPercent = sampleTotal > 0 ? (bucket.lossCount / sampleTotal) * 100 : 0
      return {
        key: `bucket-${index}`,
        className: getLatencyBarClass(avg),
        tooltip: `${timeLabel}\n延迟：${Math.round(avg)} ms\n丢包：${lossPercent.toFixed(1)}%`,
      }
    }

    if (bucket.lossCount > 0) {
      return {
        key: `bucket-${index}`,
        className: 'ping-bar ping-bar--loss',
        tooltip: `${timeLabel}\n延迟：不可达\n丢包：100%`,
      }
    }

    return {
      key: `bucket-${index}`,
      className: 'ping-bar ping-bar--empty',
      tooltip: `${timeLabel}\n无采样数据`,
    }
  })
}
