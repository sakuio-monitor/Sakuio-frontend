<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { NBadge, NCard, NEmpty, NList, NListItem, NTag, NText } from 'naive-ui'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { computed, onMounted, ref } from 'vue'
import { useNodeProviderMetadata } from '@/composables/useNodeProviderMetadata'
import { useNodeListTable } from '@/composables/useNodeListTable'
import { estimateMinWidthFromGridTemplate } from '@/constants/nodeListTable'
import { useAppStore } from '@/stores/app'
import * as financeHelper from '@/utils/financeHelper'
import { hasFreeNodeTag, parseBandwidthMbpsFromTags } from '@/utils/tagHelper'

interface NodeValueRow {
  key: string
  node: NodeData
  provider: string
  monthlyCostCNY: number
  cpuName: string
  cpuCores: number
  cpuCoreLabel: string
  logicalCpuCores: number
  memoryBytes: number
  trafficBytes: number
  trafficUnlimited: boolean
  costPerCore: number | null
  costPerMemoryGb: number | null
  costPerTrafficGb: number | null
  bandwidthMbps: number | null
  costPerMbps: number | null
}

type SortKey = 'name' | 'provider' | 'monthlyCostCNY' | 'costPerCore' | 'costPerMemoryGb' | 'costPerTrafficGb' | 'costPerMbps'

const props = defineProps<{
  nodes: NodeData[]
  groupLabel: string
  nodeCount: number
}>()

const appStore = useAppStore()
const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
const financeCurrency = ref<financeHelper.CurrencyCode>('CNY')
const sortKey = ref<SortKey>('costPerCore')
const sortDir = ref<1 | -1>(1)

const { getNodeProviderMetadata } = useNodeProviderMetadata({
  nodes: () => props.nodes,
  customAliases: () => appStore.providerAliases,
  enabled: () => appStore.privateFeaturesAllowed,
  allowGeoLookup: () => appStore.privateFeaturesAllowed,
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `${appStore.listColumnWidths.status || '76px'} ${appStore.listColumnWidths.region || '32px'} minmax(200px, 1fr) minmax(120px, 0.85fr) minmax(200px, 1fr) 108px 108px 108px 108px 108px`,
  gap: appStore.listColumnGap || '12px',
}))

const tableMinWidth = computed(() =>
  estimateMinWidthFromGridTemplate(gridStyle.value.gridTemplateColumns, gridStyle.value.gap),
)

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}

onMounted(async () => {
  financeCurrency.value = financeHelper.getStoredFinanceCurrency()
  const { rates } = await financeHelper.getDailyExchangeRates()
  exchangeRates.value = rates
})

function shouldExcludeNode(node: NodeData): boolean {
  if (Number(node.price) <= 0)
    return true
  return hasFreeNodeTag(node.tags)
}

function getProviderName(node: NodeData): string {
  return getNodeProviderMetadata(node)?.provider?.displayName || '未知厂商'
}

function isTrafficUnlimited(node: NodeData): boolean {
  const limit = Number(node.traffic_limit)
  return !Number.isFinite(limit) || limit <= 0
}

function getTrafficQuotaBytes(node: NodeData): number {
  if (isTrafficUnlimited(node))
    return 0
  return Number(node.traffic_limit)
}

function getValidCoreCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

function getEffectiveCpuCores(node: NodeData): { cores: number, label: string, logicalCores: number } {
  const physicalCores = getValidCoreCount((node as NodeData & { cpu_physical_cores?: number }).cpu_physical_cores)
  const logicalCores = getValidCoreCount(node.cpu_cores)

  if (physicalCores > 0)
    return { cores: physicalCores, label: '物理核', logicalCores }

  return { cores: logicalCores, label: logicalCores > 0 ? '逻辑核' : '核', logicalCores }
}

function formatMoneyCNY(amountCNY: number): string {
  if (!Number.isFinite(amountCNY))
    return '-'
  const targetRate = exchangeRates.value[financeCurrency.value] || 1
  const formatted = financeHelper.formatFinanceAmount(amountCNY * targetRate, financeCurrency.value)
  return `${formatted.symbol}${formatted.value}`
}

function formatCost(value: number | null): string {
  if (value === null || !Number.isFinite(value))
    return '—'
  return formatMoneyCNY(value)
}

function formatCostPerTraffic(row: NodeValueRow): string {
  if (row.trafficUnlimited)
    return '—'
  return formatCost(row.costPerTrafficGb)
}

function formatCostPerMbps(row: NodeValueRow): string {
  return formatCost(row.costPerMbps)
}

function formatCpuDisplay(row: NodeValueRow): string {
  const name = row.cpuName?.trim()
  if (!row.cpuCores)
    return name && name !== '-' ? name : '—'
  if (!name || name === '-')
    return String(row.cpuCores)
  return `${row.cpuCores} × ${name}`
}

function compareNullableCost(left: number | null, right: number | null, dir: 1 | -1): number {
  if (left === null && right === null)
    return 0
  if (left === null)
    return 1
  if (right === null)
    return -1
  return dir * (left - right)
}

const nodeRows = computed<NodeValueRow[]>(() => props.nodes
  .filter(node => !shouldExcludeNode(node))
  .map((node) => {
    const monthlyCostCNY = financeHelper.calculateMonthlyCostCNY(node, exchangeRates.value)
    const effectiveCpuCores = getEffectiveCpuCores(node)
    const cpuCores = effectiveCpuCores.cores
    const memoryBytes = Math.max(0, node.mem_total || 0)
    const trafficUnlimited = isTrafficUnlimited(node)
    const trafficBytes = getTrafficQuotaBytes(node)
    const memoryGb = memoryBytes / 1024 ** 3
    const trafficGb = trafficBytes / 1024 ** 3
    const bandwidthMbps = parseBandwidthMbpsFromTags(node.tags)

    return {
      key: node.uuid,
      node,
      provider: getProviderName(node),
      monthlyCostCNY,
      cpuName: node.cpu_name || '-',
      cpuCores,
      cpuCoreLabel: effectiveCpuCores.label,
      logicalCpuCores: effectiveCpuCores.logicalCores,
      memoryBytes,
      trafficBytes,
      trafficUnlimited,
      bandwidthMbps,
      costPerCore: cpuCores > 0 ? monthlyCostCNY / cpuCores : null,
      costPerMemoryGb: memoryGb > 0 ? monthlyCostCNY / memoryGb : null,
      costPerTrafficGb: !trafficUnlimited && trafficGb > 0 ? monthlyCostCNY / trafficGb : null,
      costPerMbps: bandwidthMbps && bandwidthMbps > 0 ? monthlyCostCNY / bandwidthMbps : null,
    }
  }))

const sortedRows = computed(() => {
  const key = sortKey.value
  const dir = sortDir.value
  return [...nodeRows.value].sort((left, right) => {
    if (key === 'name')
      return dir * left.node.name.localeCompare(right.node.name, 'zh-CN')
    if (key === 'provider')
      return dir * left.provider.localeCompare(right.provider, 'zh-CN')
    if (key === 'monthlyCostCNY')
      return dir * (left.monthlyCostCNY - right.monthlyCostCNY)
    return compareNullableCost(left[key], right[key], dir)
  })
})

const totalComparableNodes = computed(() => nodeRows.value.length)
const totalMonthlyCost = computed(() => nodeRows.value.reduce((sum, row) => sum + row.monthlyCostCNY, 0))
const providerCount = computed(() => new Set(nodeRows.value.map(row => row.provider)).size)

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

const sortLabels: Record<SortKey, string> = {
  name: '机器',
  provider: '服务商',
  monthlyCostCNY: '月成本',
  costPerCore: '每核月成本',
  costPerMemoryGb: '每 GB 内存',
  costPerTrafficGb: '每 GB 流量',
  costPerMbps: '每M带宽',
}

function setSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 1 ? -1 : 1
    return
  }
  sortKey.value = key
  sortDir.value = 1
}

function sortMark(key: SortKey): string {
  if (sortKey.value !== key)
    return ''
  return sortDir.value === 1 ? ' ↑' : ' ↓'
}

const { listTableStyle } = useNodeListTable(tableMinWidth)

const cardBlurClass = listBlurClass

const cardSurfaceClass = computed(() => [
  { 'glass-card-enabled': hasBackgroundBlur.value },
  cardBlurClass.value,
  { 'light-general-contrast': appStore.lightCardContrast && !appStore.isDark },
])

const listSurfaceClass = computed(() => [
  { 'light-list-contrast': appStore.lightCardContrast && !appStore.isDark },
  { 'glass-list-enabled': hasBackgroundBlur.value },
  listBlurClass.value,
])
</script>

<template>
  <div class="provider-value-panel min-w-0 flex flex-col gap-4">
    <NCard
      :bordered="!hasBackgroundBlur"
      :class="cardSurfaceClass"
    >
      <NText class="text-base font-semibold">
        单机资源成本对比
      </NText>
      <NText depth="3" class="text-sm block mt-0.5">
        {{ groupLabel }} {{ nodeCount }} 台 对比 {{ totalComparableNodes }} 服务商 {{ providerCount }} 月合计 {{ formatMoneyCNY(totalMonthlyCost) }}
      </NText>
    </NCard>

    <div class="node-list-table" :style="listTableStyle">
      <div class="node-list-table__scroll app-scrollbar">
        <NList
          hoverable
          clickable
          bordered
          class="node-list-table__surface"
          :class="listSurfaceClass"
        >
        <template #header>
          <div class="node-list-header panel-list-grid" :style="gridStyle">
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
          <div class="node-list-header__name sortable-header" @click="setSort('name')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.name }}{{ sortMark('name') }}
            </NText>
          </div>
          <div class="sortable-header" @click="setSort('provider')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.provider }}{{ sortMark('provider') }}
            </NText>
          </div>
          <NText :depth="3" class="text-xs self-center">
            CPU
          </NText>
          <div class="sortable-header" @click="setSort('monthlyCostCNY')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.monthlyCostCNY }}{{ sortMark('monthlyCostCNY') }}
            </NText>
          </div>
          <div class="sortable-header" @click="setSort('costPerCore')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.costPerCore }}{{ sortMark('costPerCore') }}
            </NText>
          </div>
          <div class="sortable-header" @click="setSort('costPerMemoryGb')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.costPerMemoryGb }}{{ sortMark('costPerMemoryGb') }}
            </NText>
          </div>
          <div class="sortable-header" @click="setSort('costPerTrafficGb')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.costPerTrafficGb }}{{ sortMark('costPerTrafficGb') }}
            </NText>
          </div>
          <div class="sortable-header" @click="setSort('costPerMbps')">
            <NText :depth="3" class="text-xs">
              {{ sortLabels.costPerMbps }}{{ sortMark('costPerMbps') }}
            </NText>
          </div>
          </div>
        </template>

        <NListItem v-if="sortedRows.length === 0" class="node-list-row">
          <NEmpty description="暂无可对比的付费节点" size="small" />
        </NListItem>
        <NListItem v-for="row in sortedRows" :key="row.key" class="node-list-row">
          <div class="node-list-item panel-list-grid" :style="gridStyle">
          <div class="panel-list-grid__status">
            <NTag v-if="appStore.listStatusStyle === 'tag'" :type="row.node.online ? 'success' : 'error'" size="small">
              {{ row.node.online ? '在线' : '离线' }}
            </NTag>
            <NBadge v-else :type="row.node.online ? 'success' : 'error'" :value="row.node.online ? '在线' : '离线'" />
          </div>
          <div class="panel-list-grid__region">
            <img
              v-if="row.node.region"
              :src="getFlagSrc(row.node.region)"
              :alt="getRegionDisplayName(row.node.region)"
              class="region-flag"
            >
          </div>
          <NText class="text-sm font-semibold truncate">
            {{ row.node.name }}
          </NText>
          <NText depth="3" class="text-sm truncate">
            {{ row.provider }}
          </NText>
          <NText depth="3" class="text-sm truncate min-w-0" :title="formatCpuDisplay(row)">
            {{ formatCpuDisplay(row) }}
          </NText>
          <NText class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
            {{ formatMoneyCNY(row.monthlyCostCNY) }}
          </NText>
          <NText class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
            {{ formatCost(row.costPerCore) }}
          </NText>
          <NText class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
            {{ formatCost(row.costPerMemoryGb) }}
          </NText>
          <NText class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
            {{ formatCostPerTraffic(row) }}
          </NText>
          <NText class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
            {{ formatCostPerMbps(row) }}
          </NText>
          </div>
        </NListItem>
        </NList>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.panel-list-grid {
  align-items: center;
}

.light-general-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
}

.sortable-header {
  cursor: pointer;
  user-select: none;

  &:hover :deep(.n-text) {
    color: var(--n-text-color);
  }
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
