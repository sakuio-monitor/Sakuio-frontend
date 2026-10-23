import type { NodeData } from '@/stores/nodes'
import type { MaybeRefOrGetter } from 'vue'
import type { PingQualitySummary } from '@/utils/pingSummary'
import type { PingRecord, PingTaskInfo } from '@/utils/rpc'
import { computed, ref, toValue, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  buildLatencyBarsFromRecords,
  computeLatestPingSample,
  createEmptyPingLatencyBars,
  PING_HISTORY_BAR_COUNT,
  type LatestPingSample,
  type PingLatencyBar,
} from '@/utils/pingHistoryBars'
import { summarizePingRecords } from '@/utils/pingSummary'
import { getSharedRpc } from '@/utils/rpc'

/** 拉任务列表用，少量采样即可 */
const PING_QUALITY_CATALOG_MAX_COUNT = 32
/**
 * 单任务配额下限。服务端会按 task 整池降采样（非按 client），
 * 节点一多时固定 600 会把每节点摊成十几条，20 格条形图中间就会空洞。
 */
const PING_QUALITY_PER_TASK_MAX_COUNT_MIN = 600
/** 单任务配额上限，避免极端规模一次拉爆 */
const PING_QUALITY_PER_TASK_MAX_COUNT_CAP = 16_000
/** 按节点回退时，单节点 1h 窗口足够覆盖条形图 */
const PING_QUALITY_PER_NODE_MAX_COUNT = 400
/** 估算最密探测间隔（秒），用于推算避免降采样所需配额 */
const PING_QUALITY_DENSE_INTERVAL_SEC = 30
const PING_FETCH_TIMEOUT_MS = 45_000
const PER_NODE_FALLBACK_CONCURRENCY = 6
export const NETWORK_QUALITY_MAX_TASK_COLUMNS = 6

/** 按节点数与窗口小时数放大单任务 maxCount，尽量让服务端不做整池降采样 */
function resolvePerTaskMaxCount(nodeCount: number, hours: number): number {
  const safeNodes = Math.max(1, nodeCount)
  const safeHours = Math.max(1, hours)
  const samplesPerNode = Math.ceil((safeHours * 3600) / PING_QUALITY_DENSE_INTERVAL_SEC)
    + PING_HISTORY_BAR_COUNT
  const needed = safeNodes * samplesPerNode
  return Math.min(
    PING_QUALITY_PER_TASK_MAX_COUNT_CAP,
    Math.max(PING_QUALITY_PER_TASK_MAX_COUNT_MIN, needed),
  )
}

export interface PingTaskColumn {
  id: number
  name: string
}

export interface NodePingQualityEntry extends PingQualitySummary {
  loading: boolean
  error: boolean
  /** 该节点未加入此探测任务 */
  unassigned?: boolean
  /** 左旧右新的延迟质量条 */
  latencyBars: PingLatencyBar[]
  /** 最新一次采样（长条上方文案） */
  latest: LatestPingSample
}

interface FetchPayload {
  records: PingRecord[]
  tasks: PingTaskInfo[]
}

interface NodeQualityBundle {
  overall: NodePingQualityEntry
  byTaskId: Record<number, NodePingQualityEntry>
}

const emptyLatestSample = (): LatestPingSample => ({
  latencyMs: null,
  lossPercent: null,
  sampleTime: null,
})

function emptyEntry(loading = false, error = false, unassigned = false, barTooltip?: string): NodePingQualityEntry {
  return {
    avgLatencyMs: null,
    lossPercent: null,
    sampleCount: 0,
    loading,
    error,
    unassigned: unassigned || undefined,
    latencyBars: createEmptyPingLatencyBars(
      unassigned ? '该节点未加入此探测任务' : barTooltip ?? (loading ? '加载中' : '无采样'),
    ),
    latest: emptyLatestSample(),
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

function normalizeNodeUuid(uuid: string): string {
  return uuid.trim().toLowerCase()
}

function buildNodeUuidKey(nodes: readonly NodeData[]): string {
  const ids = nodes.map(node => normalizeNodeUuid(node.uuid))
  ids.sort()
  return ids.join('|')
}

function normalizePingTasks(raw: unknown[] | undefined): PingTaskInfo[] {
  if (!raw?.length)
    return []

  const result: PingTaskInfo[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object')
      continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    if (!Number.isFinite(id) || id <= 0)
      continue
    const nameRaw = row.name
    const name = typeof nameRaw === 'string' && nameRaw.trim()
      ? nameRaw.trim()
      : `任务 ${id}`
    let clients: string[] | undefined
    if (Array.isArray(row.clients)) {
      clients = row.clients
        .map(value => (typeof value === 'string' ? normalizeNodeUuid(value) : ''))
        .filter(Boolean)
    }
    result.push({ id, name, clients })
  }
  return result
}

function mergeTaskMetadata(primary: PingTaskInfo[], secondary: PingTaskInfo[]): PingTaskInfo[] {
  const byId = new Map<number, PingTaskInfo>()
  for (const task of [...secondary, ...primary]) {
    const existing = byId.get(task.id)
    byId.set(task.id, {
      id: task.id,
      name: task.name || existing?.name || `任务 ${task.id}`,
      interval: task.interval ?? existing?.interval,
      clients: task.clients?.length ? task.clients : existing?.clients,
    })
  }
  return [...byId.values()].sort((left, right) => left.id - right.id)
}

function readConfiguredPingTaskIds(themeSettings: Record<string, unknown> | null | undefined): number[] {
  const raw = themeSettings?.networkQualityPingTasks
  if (!Array.isArray(raw))
    return []
  return raw
    .map(value => Number(value))
    .filter(id => Number.isFinite(id) && id > 0)
    .slice(0, NETWORK_QUALITY_MAX_TASK_COLUMNS)
}

function resolveVisibleTaskColumns(
  configuredIds: readonly number[],
  allTasks: readonly PingTaskInfo[],
): PingTaskColumn[] {
  if (configuredIds.length > 0) {
    const byId = new Map(allTasks.map(task => [task.id, task]))
    return configuredIds.map((id) => {
      const task = byId.get(id)
      return { id, name: task?.name ?? `任务 ${id}` }
    })
  }
  return allTasks.slice(0, NETWORK_QUALITY_MAX_TASK_COLUMNS).map(task => ({
    id: task.id,
    name: task.name,
  }))
}

function buildTaskClientSets(tasks: readonly PingTaskInfo[]): Map<number, ReadonlySet<string>> {
  const map = new Map<number, ReadonlySet<string>>()
  for (const task of tasks) {
    if (!task.clients?.length)
      continue
    map.set(task.id, new Set(task.clients.map(normalizeNodeUuid)))
  }
  return map
}

function normalizePingRecordList(records: PingRecord[]): PingRecord[] {
  return records.map(record => ({
    ...record,
    client: record.client ? normalizeNodeUuid(record.client) : record.client,
    task_id: Number(record.task_id),
  }))
}

function groupRecordsByClientAndTask(records: PingRecord[]): Map<string, Map<number, PingRecord[]>> {
  const map = new Map<string, Map<number, PingRecord[]>>()
  for (const record of records) {
    if (!record.client)
      continue
    const taskId = record.task_id
    if (!Number.isFinite(taskId))
      continue
    let byTask = map.get(record.client)
    if (!byTask) {
      byTask = new Map()
      map.set(record.client, byTask)
    }
    const list = byTask.get(taskId) ?? []
    list.push(record)
    byTask.set(taskId, list)
  }
  return map
}

function buildNodeQualityBundle(
  uuid: string,
  columns: readonly PingTaskColumn[],
  grouped: Map<string, Map<number, PingRecord[]>>,
  taskClientsById: Map<number, ReadonlySet<string>>,
  hours: number,
): NodeQualityBundle {
  const nodeKey = normalizeNodeUuid(uuid)
  const byTask = grouped.get(nodeKey) ?? new Map<number, PingRecord[]>()
  const byTaskId: Record<number, NodePingQualityEntry> = {}
  const overallRecords: PingRecord[] = []

  for (const column of columns) {
    const assigned = taskClientsById.get(column.id)
    if (assigned && !assigned.has(nodeKey)) {
      byTaskId[column.id] = emptyEntry(false, false, true)
      continue
    }

    const taskRecords = byTask.get(column.id) ?? []
    overallRecords.push(...taskRecords)
    byTaskId[column.id] = taskRecords.length > 0
      ? {
          ...summarizePingRecords(taskRecords),
          loading: false,
          error: false,
          latencyBars: buildLatencyBarsFromRecords(taskRecords, hours),
          latest: computeLatestPingSample(taskRecords),
        }
      : emptyEntry(false, false)
  }

  const overall = overallRecords.length > 0
    ? {
        ...summarizePingRecords(overallRecords),
        loading: false,
        error: false,
        latencyBars: buildLatencyBarsFromRecords(overallRecords, hours),
        latest: computeLatestPingSample(overallRecords),
      }
    : emptyEntry(false, false)

  return { overall, byTaskId }
}

function buildBundlesFromBatch(
  nodeUuids: readonly string[],
  columns: readonly PingTaskColumn[],
  payload: FetchPayload,
  taskClientsById: Map<number, ReadonlySet<string>>,
  hours: number,
): Record<string, NodeQualityBundle> {
  const grouped = groupRecordsByClientAndTask(normalizePingRecordList(payload.records))
  const result: Record<string, NodeQualityBundle> = {}
  for (const uuid of nodeUuids)
    result[uuid] = buildNodeQualityBundle(uuid, columns, grouped, taskClientsById, hours)
  return result
}

function mergeBundles(
  previous: Record<string, NodeQualityBundle>,
  next: Record<string, NodeQualityBundle>,
  activeUuids: readonly string[],
  columns: readonly PingTaskColumn[],
): Record<string, NodeQualityBundle> {
  const merged: Record<string, NodeQualityBundle> = {}
  for (const uuid of activeUuids) {
    const prev = previous[uuid]
    const incoming = next[uuid]
    if (incoming) {
      merged[uuid] = incoming
      continue
    }
    if (prev) {
      merged[uuid] = prev
      continue
    }
    merged[uuid] = {
      overall: emptyEntry(false, false),
      byTaskId: Object.fromEntries(columns.map(column => [column.id, emptyEntry(false, false)])),
    }
  }
  return merged
}

export function useNodesPingQuality(nodes: MaybeRefOrGetter<NodeData[]>) {
  const appStore = useAppStore()
  const rpc = getSharedRpc()
  const pingTaskColumns = ref<PingTaskColumn[]>([])
  const bundlesByUuid = ref<Record<string, NodeQualityBundle>>({})
  const loading = ref(false)
  const refreshing = ref(false)
  let refreshGeneration = 0

  const configuredPingTaskIds = computed(() =>
    readConfiguredPingTaskIds(appStore.publicSettings?.theme_settings as Record<string, unknown> | undefined),
  )

  const pingRecordAvailable = computed((): boolean | undefined => {
    const settings = appStore.publicSettings
    if (!settings)
      return undefined
    if (settings.record_enabled === false)
      return false
    return settings.ping_record_preserve_time !== 0
  })

  const queryHours = computed(() => {
    const preserve = appStore.publicSettings?.ping_record_preserve_time
    if (typeof preserve === 'number' && preserve > 0)
      return Math.min(preserve, 1)
    return 1
  })

  function syncTaskColumns(allTasks: PingTaskInfo[]) {
    pingTaskColumns.value = resolveVisibleTaskColumns(configuredPingTaskIds.value, allTasks)
  }

  function seedColumnsFromConfiguredIds() {
    const configured = configuredPingTaskIds.value
    if (!configured.length)
      return
    const nameById = new Map(pingTaskColumns.value.map(column => [column.id, column.name]))
    pingTaskColumns.value = configured.map(id => ({
      id,
      name: nameById.get(id) ?? '…',
    }))
  }

  const displayTaskColumns = computed((): PingTaskColumn[] => {
    if (pingTaskColumns.value.length > 0)
      return pingTaskColumns.value
    const configured = configuredPingTaskIds.value
    if (configured.length > 0) {
      return configured.map(id => ({ id, name: '…' }))
    }
    return Array.from({ length: NETWORK_QUALITY_MAX_TASK_COLUMNS }, (_, index) => ({
      id: -(index + 1),
      name: '…',
    }))
  })

  watch(
    configuredPingTaskIds,
    () => {
      seedColumnsFromConfiguredIds()
    },
    { immediate: true },
  )

  async function fetchTaskCatalog(hours: number): Promise<PingTaskInfo[]> {
    const result = await withTimeout(
      rpc.getPingRecords(undefined, hours, PING_QUALITY_CATALOG_MAX_COUNT),
      PING_FETCH_TIMEOUT_MS,
    )
    return normalizePingTasks(result.tasks as unknown[] | undefined)
  }

  async function fetchRecordsForTasks(
    taskIds: readonly number[],
    hours: number,
    nodeCount: number,
  ): Promise<FetchPayload> {
    const records: PingRecord[] = []
    const tasks: PingTaskInfo[] = []
    const maxCount = resolvePerTaskMaxCount(nodeCount, hours)

    const results = await Promise.allSettled(
      taskIds.map(taskId =>
        withTimeout(
          rpc.getPingRecords(taskId, hours, maxCount),
          PING_FETCH_TIMEOUT_MS,
        ),
      ),
    )

    for (let index = 0; index < results.length; index++) {
      const settled = results[index]!
      const taskId = taskIds[index]!
      if (settled.status !== 'fulfilled')
        continue
      const result = settled.value
      records.push(...(result.records ?? []))
      const meta = normalizePingTasks(result.tasks as unknown[] | undefined)
      if (meta.length > 0) {
        tasks.push(...meta)
      }
      else {
        tasks.push({ id: taskId, name: `任务 ${taskId}` })
      }
    }

    return { records, tasks }
  }

  async function fetchNodePing(uuid: string, hours: number): Promise<FetchPayload> {
    const result = await withTimeout(
      rpc.getPingRecords(undefined, hours, PING_QUALITY_PER_NODE_MAX_COUNT, uuid),
      PING_FETCH_TIMEOUT_MS,
    )
    return {
      records: result.records ?? [],
      tasks: normalizePingTasks(result.tasks as unknown[] | undefined),
    }
  }

  async function fetchPerNodeFallback(uuids: string[], hours: number): Promise<FetchPayload> {
    const records: PingRecord[] = []
    let tasks: PingTaskInfo[] = []
    let cursor = 0

    async function worker() {
      while (cursor < uuids.length) {
        const index = cursor++
        const uuid = uuids[index]!
        try {
          const payload = await fetchNodePing(uuid, hours)
          records.push(...payload.records)
          tasks = mergeTaskMetadata(tasks, payload.tasks)
        }
        catch {
          // 单节点失败跳过
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(PER_NODE_FALLBACK_CONCURRENCY, uuids.length) },
        () => worker(),
      ),
    )
    return { records, tasks }
  }

  async function refresh() {
    const generation = ++refreshGeneration
    const list = toValue(nodes)
    const availability = pingRecordAvailable.value
    const hours = queryHours.value

    if (availability === undefined) {
      loading.value = !Object.keys(bundlesByUuid.value).length
      return
    }

    if (!list.length || availability === false) {
      bundlesByUuid.value = {}
      pingTaskColumns.value = []
      loading.value = false
      refreshing.value = false
      return
    }

    const uuids = list.map(node => node.uuid)
    const hasAnyData = uuids.some(uuid => bundlesByUuid.value[uuid]?.overall.sampleCount)

    if (!hasAnyData)
      loading.value = true
    else
      refreshing.value = true

    try {
      let catalogTasks: PingTaskInfo[] = []
      try {
        catalogTasks = await fetchTaskCatalog(hours)
      }
      catch {
        catalogTasks = []
      }

      if (generation !== refreshGeneration)
        return

      syncTaskColumns(catalogTasks)
      const columns = pingTaskColumns.value

      let payload: FetchPayload
      if (columns.length > 0) {
        try {
          payload = await fetchRecordsForTasks(
            columns.map(column => column.id),
            hours,
            uuids.length,
          )
          payload.tasks = mergeTaskMetadata(catalogTasks, payload.tasks)
        }
        catch {
          payload = await fetchPerNodeFallback(uuids, hours)
          payload.tasks = mergeTaskMetadata(catalogTasks, payload.tasks)
        }
      }
      else {
        payload = { records: [], tasks: catalogTasks }
      }

      if (generation !== refreshGeneration)
        return

      const taskClientsById = buildTaskClientSets(payload.tasks)
      const next = buildBundlesFromBatch(uuids, columns, payload, taskClientsById, hours)
      bundlesByUuid.value = mergeBundles(bundlesByUuid.value, next, uuids, columns)
    }
    finally {
      if (generation === refreshGeneration) {
        loading.value = false
        refreshing.value = false
      }
    }
  }

  watch(
    () => buildNodeUuidKey(toValue(nodes)),
    () => {
      void refresh()
    },
    { immediate: true },
  )

  watch(configuredPingTaskIds, (value, previous) => {
    if (previous && value.join(',') === previous.join(','))
      return
    void refresh()
  })

  watch(pingRecordAvailable, (value, previous) => {
    if (value === previous)
      return
    void refresh()
  })

  watch(queryHours, (value, previous) => {
    if (value === previous)
      return
    void refresh()
  })

  function getEntry(uuid: string): NodePingQualityEntry {
    const bundle = bundlesByUuid.value[uuid]
    if (bundle)
      return bundle.overall
    if (loading.value)
      return emptyEntry(true, false)
    return emptyEntry(false, false)
  }

  function getTaskEntry(uuid: string, taskId: number): NodePingQualityEntry {
    const bundle = bundlesByUuid.value[uuid]
    if (bundle?.byTaskId[taskId])
      return bundle.byTaskId[taskId]!
    if (loading.value)
      return emptyEntry(true, false)
    return emptyEntry(false, false)
  }

  return {
    pingTaskColumns,
    displayTaskColumns,
    bundlesByUuid,
    loading,
    refreshing,
    refresh,
    getEntry,
    getTaskEntry,
    pingRecordAvailable,
    queryHours,
    configuredPingTaskIds,
  }
}
