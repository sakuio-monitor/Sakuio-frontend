<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { IpcosAnalyzeFetchResult, IpcosAnalyzeReport } from '@/utils/ipnekoApi'
import { NBadge, NCard, NEmpty, NList, NListItem, NPopover, NTag, NText } from 'naive-ui'
import SakuioSpinner from './SakuioSpinner.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NodeListNameCell from '@/components/NodeListNameCell.vue'
import { useNodeListTable } from '@/composables/useNodeListTable'
import { estimateMinWidthFromGridTemplate } from '@/constants/nodeListTable'
import { useAppStore } from '@/stores/app'
import {
  aiToolSuitabilityForNode,
  aiToolSuitabilityTagType,
  isAiToolRegionExcluded,
} from '@/utils/aiToolSuitability'
import { getCachedIpcosAnalyze, setCachedIpcosAnalyze } from '@/utils/ipcosAnalyzeCache'
import {
  fetchIpcosAnalyzeParallel,
  formatGeoApiLine,
  formatSecApiLine,
  ipTypeTags,
  pickPrimaryLocation,
  usageTypeTags,
} from '@/utils/ipnekoApi'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{
  nodes: NodeData[]
  groupLabel: string
}>()

const appStore = useAppStore()
const router = useRouter()
const refreshing = ref(false)

interface NodeIpQuality {
  queryIp: string
  loading: boolean
  error: string
  report: IpcosAnalyzeReport | null
  fromCache: boolean
}

const byUuid = ref<Record<string, NodeIpQuality>>({})

const nodeListFingerprint = computed(() =>
  props.nodes.map(n => `${n.uuid}\t${n.ipv4 ?? ''}\t${n.ipv6 ?? ''}`).join('\n'),
)

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

const gridStyle = computed(() => ({
  gridTemplateColumns: `${appStore.listColumnWidths.status || '76px'} ${appStore.listColumnWidths.region || '32px'} minmax(160px, 1fr) minmax(140px, 0.9fr) minmax(88px, 0.42fr) minmax(120px, 0.55fr) minmax(96px, 0.48fr) minmax(140px, 0.85fr) minmax(88px, 0.42fr)`,
  gap: appStore.listColumnGap || '12px',
}))

const tableMinWidth = computed(() =>
  estimateMinWidthFromGridTemplate(gridStyle.value.gridTemplateColumns, gridStyle.value.gap),
)

const { listTableStyle } = useNodeListTable(tableMinWidth)

interface IpQualityRow {
  key: string
  node: NodeData
  slot: NodeIpQuality
  aiLabel: ReturnType<typeof aiToolSuitabilityForNode>
}

function queryIpForNode(node: NodeData): string {
  return node.ipv4?.trim() || node.ipv6?.trim() || ''
}

function emptySlot(node: NodeData): NodeIpQuality {
  const queryIp = queryIpForNode(node)
  return {
    queryIp,
    loading: false,
    error: queryIp ? '' : '无 IP',
    report: null,
    fromCache: false,
  }
}

function slotFor(node: NodeData): NodeIpQuality {
  return byUuid.value[node.uuid] ?? emptySlot(node)
}

const rows = computed<IpQualityRow[]>(() =>
  props.nodes.map((node) => {
    const slot = slotFor(node)
    return {
      key: node.uuid,
      node,
      slot,
      aiLabel: aiToolSuitabilityForNode(node.region, slot.report),
    }
  }),
)

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}

function scoreTagType(score?: number): 'success' | 'warning' | 'error' | 'default' {
  if (score == null)
    return 'default'
  if (score >= 80)
    return 'success'
  if (score >= 50)
    return 'warning'
  return 'error'
}

/** 有缓存直接用；无缓存或已过期则自动请求 IPCos */
async function syncIpQuality() {
  if (refreshing.value)
    return

  const pending: { uuid: string, ip: string }[] = []
  for (const node of props.nodes) {
    const ip = queryIpForNode(node)
    const slot = byUuid.value[node.uuid] ?? emptySlot(node)
    slot.queryIp = ip
    if (!ip) {
      slot.loading = false
      slot.error = '无 IP'
      slot.report = null
      byUuid.value[node.uuid] = slot
      continue
    }
    const cached = getCachedIpcosAnalyze(ip)
    if (cached) {
      slot.report = cached
      slot.fromCache = true
      slot.loading = false
      slot.error = ''
      byUuid.value[node.uuid] = slot
      continue
    }
    slot.loading = true
    slot.error = ''
    slot.report = null
    slot.fromCache = false
    byUuid.value[node.uuid] = slot
    pending.push({ uuid: node.uuid, ip })
  }

  const ipToUuids = new Map<string, string[]>()
  for (const { uuid, ip } of pending) {
    const list = ipToUuids.get(ip) ?? []
    list.push(uuid)
    ipToUuids.set(ip, list)
  }

  const uniqueIps = [...ipToUuids.keys()]
  if (uniqueIps.length === 0)
    return

  refreshing.value = true
  try {
    function applyIpResult(ip: string, hit: IpcosAnalyzeFetchResult) {
      for (const uuid of ipToUuids.get(ip) ?? []) {
        const slot = byUuid.value[uuid]
        if (!slot)
          continue
        slot.loading = false
        if (!hit.ok) {
          slot.error = hit.error
          slot.report = null
          continue
        }
        slot.report = hit.data
        slot.error = ''
        slot.fromCache = false
      }
      if (hit.ok)
        setCachedIpcosAnalyze(ip, hit.data)
    }

    await fetchIpcosAnalyzeParallel(uniqueIps, {
      onResult: (ip, result) => applyIpResult(ip, result),
    })
  }
  finally {
    refreshing.value = false
  }
}

function openNode(node: NodeData) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

watch(nodeListFingerprint, () => {
  void syncIpQuality()
}, { immediate: true })
</script>

<template>
  <div class="ip-quality-panel min-w-0 flex flex-col gap-4">
    <NCard :bordered="!hasBackgroundBlur" :class="cardSurfaceClass">
      <div>
        <NText class="text-base font-semibold">
          IP 质量
        </NText>
        <NText depth="3" class="text-sm block mt-0.5">
          {{ groupLabel }}{{ nodes.length }}台 数据来自
          <a
            class="text-[var(--n-primary-color)] hover:underline"
            href="https://ipneko.cc/"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >ipneko.cc</a>
          <template v-if="refreshing">
            查询中…
          </template>
        </NText>
      </div>
    </NCard>

    <div class="node-list-table ip-quality-panel__table min-w-0 max-w-full" :style="listTableStyle">
      <div class="ip-quality-panel__body min-w-0 max-w-full">
        <div class="node-list-table__scroll app-scrollbar">
          <NList
            hoverable
            clickable
            bordered
            class="node-list-table__surface"
            :class="listSurfaceClass"
          >
          <template #header>
            <div class="node-list-header ip-quality-grid" :style="gridStyle">
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
              <div class="node-list-header__name">
                <NText :depth="3" class="text-xs">
                  节点
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  IP 类型
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  评分
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  使用类型
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  AI 工具适用
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  位置
                </NText>
              </div>
              <div>
                <NText :depth="3" class="text-xs">
                  共享
                </NText>
              </div>
            </div>
          </template>

          <NListItem v-if="rows.length === 0" class="node-list-row node-list-row--empty">
            <NEmpty description="暂无节点" size="small" />
          </NListItem>
          <NListItem
            v-for="row in rows"
            :key="row.key"
            class="node-list-row"
            @click="openNode(row.node)"
          >
            <div class="node-list-item ip-quality-grid" :style="gridStyle">
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

              <div class="ip-quality-cell min-w-0">
                <div v-if="row.slot.loading" class="ip-quality-cell__loading">
                  <SakuioSpinner :size="14" />
                </div>
                <NText v-else-if="row.slot.error" type="error" class="truncate block text-xs">
                  {{ row.slot.error }}
                </NText>
                <div v-else-if="row.slot.report" class="ip-quality-tags">
                  <NTag
                    v-for="tag in ipTypeTags(row.slot.report)"
                    :key="tag"
                    size="small"
                    :bordered="false"
                    class="ip-quality-tags__item"
                  >
                    {{ tag }}
                  </NTag>
                  <NText v-if="ipTypeTags(row.slot.report).length === 0" depth="3" class="text-xs">
                    —
                  </NText>
                </div>
                <NText v-else depth="3" class="text-xs">
                  —
                </NText>
              </div>

              <div class="ip-quality-cell text-xs">
                <template v-if="row.slot.loading" />
                <NTag
                  v-else-if="row.slot.report?.score != null"
                  size="small"
                  :type="scoreTagType(row.slot.report.score)"
                >
                  {{ row.slot.report.score }} {{ row.slot.report.score_label || '' }}
                </NTag>
                <NText v-else depth="3">
                  —
                </NText>
              </div>

              <div class="ip-quality-cell min-w-0">
                <template v-if="row.slot.loading" />
                <div v-else-if="row.slot.report" class="ip-quality-tags">
                  <NTag
                    v-for="tag in usageTypeTags(row.slot.report)"
                    :key="tag"
                    size="small"
                    type="warning"
                    :bordered="false"
                    class="ip-quality-tags__item"
                  >
                    {{ tag }}
                  </NTag>
                  <NText v-if="usageTypeTags(row.slot.report).length === 0" depth="3" class="text-xs">
                    —
                  </NText>
                </div>
                <NText v-else depth="3" class="text-xs">
                  —
                </NText>
              </div>

              <div class="ip-quality-cell text-xs">
                <NTag
                  v-if="row.aiLabel"
                  size="small"
                  :type="aiToolSuitabilityTagType(row.aiLabel)"
                >
                  {{ row.aiLabel }}
                </NTag>
                <div
                  v-else-if="row.slot.loading && !isAiToolRegionExcluded(row.node.region)"
                  class="ip-quality-cell__loading"
                >
                  <SakuioSpinner :size="14" />
                </div>
                <NText v-else depth="3">
                  —
                </NText>
              </div>

              <div class="ip-quality-cell min-w-0 text-xs">
                <template v-if="row.slot.loading" />
                <template v-else-if="row.slot.report">
                  <div class="flex items-center gap-0.5 min-w-0">
                    <span class="truncate flex-1" :title="pickPrimaryLocation(row.slot.report)">
                      {{ pickPrimaryLocation(row.slot.report) }}
                    </span>
                    <NPopover
                      v-if="(row.slot.report.geo_apis?.length ?? 0) > 0 || (row.slot.report.sec_apis?.length ?? 0) > 0"
                      trigger="click"
                      placement="left"
                      :show-arrow="false"
                      @click.stop
                    >
                      <template #trigger>
                        <NButton
                          size="tiny"
                          quaternary
                          circle
                          class="shrink-0"
                          title="地理与安全源详情"
                          @click.stop
                        >
                          <div class="i-lucide-info text-sm" />
                        </NButton>
                      </template>
                      <div class="ip-quality-popover max-w-md max-h-80 overflow-y-auto app-scrollbar text-xs space-y-3">
                        <div v-if="row.slot.report.geo_apis?.length">
                          <NText depth="3" class="block mb-1 font-medium">
                            地理位置
                          </NText>
                          <ul class="m-0 pl-0 list-none space-y-1">
                            <li v-for="g in row.slot.report.geo_apis" :key="g.name" class="flex gap-2">
                              <span class="shrink-0 w-20 opacity-70">{{ g.name }}</span>
                              <span>{{ formatGeoApiLine(g) }}</span>
                            </li>
                          </ul>
                        </div>
                        <div v-if="row.slot.report.sec_apis?.length">
                          <NText depth="3" class="block mb-1 font-medium">
                            安全 / 代理
                          </NText>
                          <ul class="m-0 pl-0 list-none space-y-1">
                            <li v-for="s in row.slot.report.sec_apis" :key="s.name" class="flex gap-2">
                              <span class="shrink-0 w-20 opacity-70">{{ s.name }}</span>
                              <span>{{ formatSecApiLine(s) }}</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </NPopover>
                  </div>
                </template>
                <NText v-else depth="3">
                  —
                </NText>
              </div>

              <div class="ip-quality-cell text-xs tabular-nums truncate">
                <template v-if="!row.slot.loading && row.slot.report?.shared_users">
                  {{ row.slot.report.shared_users }}
                </template>
                <NText v-else-if="!row.slot.loading" depth="3">
                  —
                </NText>
              </div>
            </div>
          </NListItem>
          </NList>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ip-quality-panel__body {
  display: block;
  width: 100%;
  min-height: calc(var(--node-list-row-height, 52px) * 5 + 48px);
}

.ip-quality-grid {
  align-items: center;
}

.ip-quality-cell {
  min-width: 0;
  overflow: hidden;
  line-height: 1.25;
}

.ip-quality-cell__loading {
  display: flex;
  align-items: center;
  height: 100%;
}

.ip-quality-tags {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow: hidden;
  max-width: 100%;
}

.ip-quality-tags__item {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ip-quality-tags__item :deep(.n-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
