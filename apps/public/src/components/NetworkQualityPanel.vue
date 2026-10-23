<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { PingTaskColumn } from '@/composables/useNodesPingQuality'
import { NBadge, NAlert, NCard, NEmpty, NList, NListItem, NSpin, NTag, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import NodeListNameCell from '@/components/NodeListNameCell.vue'
import PingTaskQualityCell from '@/components/PingTaskQualityCell.vue'
import { useNodeListTable } from '@/composables/useNodeListTable'
import { estimateMinWidthFromGridTemplate } from '@/constants/nodeListTable'
import { useNodesPingQuality } from '@/composables/useNodesPingQuality'
import { useAppStore } from '@/stores/app'
import { getPingQualityPresentation, getPingQualityTagStyle, type PingQualityLevel } from '@/utils/pingSummary'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{
  nodes: NodeData[]
  groupLabel: string
}>()

const appStore = useAppStore()
const router = useRouter()

const {
  displayTaskColumns,
  getEntry,
  getTaskEntry,
  loading,
  refreshing,
  pingRecordAvailable,
  queryHours,
} = useNodesPingQuality(() => props.nodes)

const showTableSpin = computed(
  () => loading.value || pingRecordAvailable.value === undefined,
)

type SortKey = 'name' | 'quality' | `task:${number}`
const sortKey = ref<SortKey | ''>('')
const sortDir = ref<1 | -1>(1)

const qualityColWidth = '88px'
const taskColWidth = 'minmax(108px, 124px)'

function nodesWithOfflineLast(nodes: NodeData[]): NodeData[] {
  const online: NodeData[] = []
  const offline: NodeData[] = []
  for (const node of nodes) {
    if (node.online)
      online.push(node)
    else
      offline.push(node)
  }
  return [...online, ...offline]
}

interface QualityRow {
  key: string
  node: NodeData
  lossPercent: number | null
  sampleCount: number
  loading: boolean
  error: boolean
  qualityLabel: string
  qualityLevel: PingQualityLevel
  taskLatencyMs: Record<number, number | null>
}

const rows = computed<QualityRow[]>(() => {
  const tableLoading = showTableSpin.value
  return props.nodes.map((node) => {
    const entry = getEntry(node.uuid)
    const presentation = getPingQualityPresentation(entry)
    const taskLatencyMs: Record<number, number | null> = {}
    for (const column of displayTaskColumns.value) {
      if (column.id <= 0)
        continue
      const taskEntry = getTaskEntry(node.uuid, column.id)
      taskLatencyMs[column.id] = taskEntry.unassigned ? null : taskEntry.avgLatencyMs
    }
    return {
      key: node.uuid,
      node,
      lossPercent: entry.lossPercent,
      sampleCount: entry.sampleCount,
      loading: !tableLoading && (entry.loading || loading.value),
      error: entry.error,
      qualityLabel: entry.error ? '加载失败' : presentation.label,
      qualityLevel: entry.error ? 'poor' : presentation.level,
      taskLatencyMs,
    }
  })
})

function qualitySortScore(row: QualityRow): number {
  if (row.sampleCount <= 0)
    return 999
  const loss = row.lossPercent ?? 0
  const latencies = Object.values(row.taskLatencyMs).filter((v): v is number => v !== null && Number.isFinite(v))
  const latency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 9999
  return loss * 1000 + latency
}

function rowsInListOrder(list: QualityRow[]): QualityRow[] {
  const sourceNodes = appStore.listOfflineNodesLast
    ? nodesWithOfflineLast(props.nodes)
    : props.nodes
  const indexByUuid = new Map(sourceNodes.map((node, index) => [node.uuid, index]))
  return [...list].sort(
    (left, right) => (indexByUuid.get(left.node.uuid) ?? 0) - (indexByUuid.get(right.node.uuid) ?? 0),
  )
}

const sortedRows = computed(() => {
  if (!sortKey.value)
    return rowsInListOrder(rows.value)

  const dir = sortDir.value
  const key = sortKey.value
  return [...rows.value].sort((left, right) => {
    if (key === 'name')
      return dir * left.node.name.localeCompare(right.node.name, 'zh-CN')
    if (key.startsWith('task:')) {
      const taskId = Number(key.slice(5))
      const lv = left.taskLatencyMs[taskId] ?? Number.POSITIVE_INFINITY
      const rv = right.taskLatencyMs[taskId] ?? Number.POSITIVE_INFINITY
      return dir * (lv - rv)
    }
    return dir * (qualitySortScore(left) - qualitySortScore(right))
  })
})

const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

const listBlurClass = computed(() => {
  if (!hasBackgroundBlur.value)
    return ''
  const radius = appStore.cardBlurRadius
  if (radius <= 8)
    return 'glass-8'
  if (radius <= 12)
    return 'glass-12'
  if (radius <= 16)
    return 'glass-16'
  if (radius <= 20)
    return 'glass-20'
  return `glass-${radius}`
})

const cardSurfaceClass = computed(() => [
  { 'glass-card-enabled': hasBackgroundBlur.value },
  listBlurClass.value,
  { 'light-general-contrast': appStore.lightCardContrast && !appStore.isDark },
])

const listSurfaceClass = computed(() => [
  { 'light-list-contrast': appStore.lightCardContrast && !appStore.isDark },
  { 'glass-list-enabled': hasBackgroundBlur.value },
  listBlurClass.value,
])

const columnGap = computed(() => appStore.listColumnGap || '12px')
const statusColWidth = computed(() => appStore.listColumnWidths.status || '76px')
const regionColWidth = computed(() => appStore.listColumnWidths.region || '32px')
const gridTemplateColumns = computed(() => {
  const taskCols = displayTaskColumns.value.map(() => taskColWidth).join(' ')
  return [
    statusColWidth.value,
    regionColWidth.value,
    'minmax(204px, 1fr)',
    taskCols,
    qualityColWidth,
  ].filter(Boolean).join(' ')
})

const gridStyle = computed(() => ({
  gridTemplateColumns: gridTemplateColumns.value,
  gap: columnGap.value,
}))

const tableMinWidth = computed(() =>
  estimateMinWidthFromGridTemplate(gridTemplateColumns.value, columnGap.value),
)

const { listTableStyle } = useNodeListTable(tableMinWidth)

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 1 ? -1 : 1
    return
  }
  sortKey.value = key
  sortDir.value = 1
}

function sortMark(key: SortKey): string {
  if (!sortKey.value || sortKey.value !== key)
    return ''
  return sortDir.value === 1 ? ' ↑' : ' ↓'
}

function taskSortKey(taskId: number): SortKey {
  return `task:${taskId}`
}

function isPlaceholderTaskColumn(column: PingTaskColumn): boolean {
  return column.id <= 0
}

function taskEntryForColumn(uuid: string, column: PingTaskColumn) {
  if (isPlaceholderTaskColumn(column))
    return getEntry(uuid)
  return getTaskEntry(uuid, column.id)
}

function taskCellLoading(column: PingTaskColumn, rowLoading: boolean): boolean {
  if (showTableSpin.value)
    return false
  return rowLoading || isPlaceholderTaskColumn(column)
}

function openNode(node: NodeData) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

function qualityTagStyle(level: PingQualityLevel) {
  return getPingQualityTagStyle(level)
}
</script>

<template>
  <div class="network-quality-panel min-w-0 flex flex-col gap-4">
    <NCard
      :bordered="!hasBackgroundBlur"
      :class="cardSurfaceClass"
    >
      <NText class="text-base font-semibold">
        网络质量
      </NText>
      <NText depth="3" class="text-sm block mt-0.5">
        {{ groupLabel }} {{ nodes.length }} 台 最近 {{ queryHours }} 小时 Ping 采样<template v-if="refreshing && !showTableSpin">
          刷新中…
        </template>
      </NText>
    </NCard>

    <NAlert v-if="pingRecordAvailable === false" type="warning" title="未启用 Ping 记录">
      请在 Sakuio 中开启探测记录后查看各节点网络质量。
    </NAlert>

    <div v-else class="node-list-table network-quality-panel__table" :style="listTableStyle">
      <NSpin :show="showTableSpin" class="network-quality-panel__spin">
        <div class="node-list-table__scroll app-scrollbar">
          <NList
            hoverable
            clickable
            bordered
            class="node-list-table__surface"
            :class="listSurfaceClass"
          >
        <template #header>
          <div
            class="node-list-header network-quality-grid"
            :style="gridStyle"
          >
            <div class="node-list-header__status">
              <NText :depth="3" class="text-xs">
                状态
              </NText>
            </div>
            <div class="node-list-header__region">
              <NText :depth="3" class="text-xs">
                地区
              </NText>
            </div>
            <div class="node-list-header__name sortable-header min-w-0" @click="setSort('name')">
              <NText :depth="3" class="text-xs">
                节点{{ sortMark('name') }}
              </NText>
            </div>
            <div
              v-for="column in displayTaskColumns"
              :key="`head-${column.id}`"
              class="sortable-header network-quality-grid__task"
              @click="!isPlaceholderTaskColumn(column) && setSort(taskSortKey(column.id))"
            >
              <NText :depth="3" class="text-xs network-quality-grid__task-label" :title="column.name">
                {{ column.name }}{{ !isPlaceholderTaskColumn(column) ? sortMark(taskSortKey(column.id)) : '' }}
              </NText>
            </div>
            <div class="sortable-header network-quality-grid__quality" @click="setSort('quality')">
              <NText :depth="3" class="text-xs">
                网络质量{{ sortMark('quality') }}
              </NText>
            </div>
          </div>
        </template>

        <NListItem v-if="sortedRows.length === 0" class="node-list-row">
          <NEmpty description="暂无节点" size="small" />
        </NListItem>
        <NListItem
          v-for="row in sortedRows"
          :key="row.key"
          class="node-list-row"
          @click="openNode(row.node)"
        >
          <div
            class="node-list-item network-quality-grid"
            :style="gridStyle"
          >
            <div class="node-list-item__status">
              <NTag v-if="appStore.listStatusStyle === 'tag'" :type="row.node.online ? 'success' : 'error'" size="small">
                {{ row.node.online ? '在线' : '离线' }}
              </NTag>
              <NBadge v-else :type="row.node.online ? 'success' : 'error'" :value="row.node.online ? '在线' : '离线'" />
            </div>
            <div class="node-list-item__region">
              <img
                v-if="row.node.region"
                :src="getFlagSrc(row.node.region)"
                :alt="getRegionDisplayName(row.node.region)"
                class="region-flag"
              >
            </div>
            <div class="node-list-item__name min-w-0">
              <NodeListNameCell :node="row.node" :nodes="nodes" subline-mode="list" />
            </div>
            <div
              v-for="column in displayTaskColumns"
              :key="`${row.key}-${column.id}`"
              class="network-quality-grid__task"
            >
              <PingTaskQualityCell
                :entry="taskEntryForColumn(row.node.uuid, column)"
                :loading="taskCellLoading(column, row.loading)"
              />
            </div>
            <div class="network-quality-grid__quality">
              <NTag
                v-if="appStore.listTagsStyle === 'tag'"
                size="small"
                :color="qualityTagStyle(row.qualityLevel)"
              >
                {{ row.qualityLabel }}
              </NTag>
              <NBadge
                v-else
                :color="qualityTagStyle(row.qualityLevel).textColor"
                :value="row.qualityLabel"
              />
            </div>
          </div>
        </NListItem>
          </NList>
        </div>
      </NSpin>
    </div>
  </div>
</template>

<style scoped lang="scss">
.network-quality-panel__spin {
  display: block;
  width: 100%;
  min-height: calc(var(--node-list-row-height, 52px) * 5 + 48px);
}

.network-quality-panel__spin :deep(.n-spin-content) {
  min-height: inherit;
}

.network-quality-grid {
  align-items: center;
}

.network-quality-grid__task {
  min-width: 0;
}

.network-quality-grid__task-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.network-quality-grid__quality {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  padding-left: 10px;
  box-sizing: border-box;
}

.sortable-header {
  cursor: pointer;
  user-select: none;

  &:hover :deep(.n-text) {
    color: var(--n-text-color);
  }
}

.light-general-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
}

.light-list-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);

  :deep(.n-list-item) {
    border-color: rgba(0, 0, 0, 0.08);
  }
}

.glass-list-enabled {
  background-color: rgba(255, 255, 255, 0.7) !important;

  :deep(.n-list-item) {
    background-color: rgba(255, 255, 255, 0.6);
  }
}

html.dark .glass-list-enabled {
  background-color: rgba(24, 24, 28, 0.85) !important;

  :deep(.n-list-item) {
    background-color: rgba(24, 24, 28, 0.7);
  }
}
</style>
