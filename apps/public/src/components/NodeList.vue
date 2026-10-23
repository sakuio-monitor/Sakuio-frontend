<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { NBadge, NButton, NIcon, NList, NListItem, NModal, NProgress, NTag, NText, NTooltip, useThemeVars } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import PingChart from '@/components/PingChart.vue'
import TrafficProgress from '@/components/TrafficProgress.vue'
import { estimateListGridMinWidth } from '@/constants/nodeListTable'
import { useNodeListTable } from '@/composables/useNodeListTable'
import { useNodeProviderMetadata } from '@/composables/useNodeProviderMetadata'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptime, getStatus } from '@/utils/helper'
import { getOSImage } from '@/utils/osImageHelper'
import ProviderBrandIcon from '@/components/ProviderBrandIcons.vue'
import { cleanProviderOrg, providerListSvgIcon } from '@/utils/providerInfo'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { FALLBACK_RATES, fetchExchangeRates, formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, hasNoRenewAfterExpireTag, parseTags } from '@/utils/tagHelper'

interface NodeDisplayTag {
  key: string
  text: string
  color: string
  icon?: string
  title?: string
}

const props = defineProps<{
  nodes: NodeData[]
}>()

const emit = defineEmits<{
  click: [node: NodeData]
}>()

// 检测是否为触摸设备（移动端）
const isTouchDevice = computed(() => {
  if (typeof window === 'undefined')
    return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

const appStore = useAppStore()

const { metadataByUuid, getNodeProviderMetadata } = useNodeProviderMetadata({
  nodes: () => props.nodes,
  customAliases: () => appStore.providerAliases,
  enabled: () => true,
  allowGeoLookup: () => appStore.privateFeaturesAllowed,
})

// 获取 Naive UI 主题变量
const themeVars = useThemeVars()

// 延迟图表弹窗状态
const showPingChart = ref(false)
const selectedNode = ref<NodeData | null>(null)

// 汇率状态
const exchangeRates = ref<Record<string, number>>({ ...FALLBACK_RATES })
onMounted(async () => {
  const rates = await fetchExchangeRates()
  exchangeRates.value = rates
})

// 月付总价（折算人民币）
const monthlyTotalCNY = computed(() => {
  return props.nodes.reduce((total, node) => {
    const price = node.price ?? 0
    if (price <= 0 || price === -1) return total
    const cycle = node.billing_cycle ?? 30
    if (cycle <= 0) return total
    const rate = exchangeRates.value[node.currency] ?? 1
    const monthlyPrice = price * rate * (30 / cycle)
    return total + monthlyPrice
  }, 0)
})

// 本月到期需续费总价（不按月折算，只折算汇率）
const monthlyRenewalCNY = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999)
  return props.nodes.reduce((total, node) => {
    const price = node.price ?? 0
    if (price <= 0 || price === -1) return total
    if (hasNoRenewAfterExpireTag(node.tags)) return total
    const expiredAt = node.expired_at ? new Date(node.expired_at) : null
    if (!expiredAt) return total
    if (expiredAt >= now && expiredAt <= lastDay) {
      const rate = exchangeRates.value[node.currency] ?? 1
      total += price * rate
    }
    return total
  }, 0)
})

// 下月到期需续费总价（不按月折算，只折算汇率）
const nextMonthRenewalCNY = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month + 1, 1)
  const lastDay = new Date(year, month + 2, 0, 23, 59, 59, 999)
  return props.nodes.reduce((total, node) => {
    const price = node.price ?? 0
    if (price <= 0 || price === -1) return total
    if (hasNoRenewAfterExpireTag(node.tags)) return total
    const expiredAt = node.expired_at ? new Date(node.expired_at) : null
    if (!expiredAt) return total
    if (expiredAt >= firstDay && expiredAt <= lastDay) {
      const rate = exchangeRates.value[node.currency] ?? 1
      total += price * rate
    }
    return total
  }, 0)
})

// CPU 实际占用核心数 / 总核心数
const totalCpuUsed = computed(() => props.nodes.reduce((sum, node) => sum + ((node.cpu_cores ?? 0) * (node.cpu ?? 0) / 100), 0))
const totalCpuAll = computed(() => props.nodes.reduce((sum, node) => sum + (node.cpu_cores ?? 0), 0))

// CPU 型号汇总（用于 tooltip，相同型号合并核心数）
const cpuModelSummary = computed(() => {
  const map = new Map<string, number>()
  for (const node of props.nodes) {
    const count = map.get(node.cpu_name) ?? 0
    map.set(node.cpu_name, count + (node.cpu_cores ?? 1))
  }
  return Array.from(map.entries()).map(([name, cores]) => `${name} x${cores}核`).join('\n')
})

// 地区汇总（用于 tooltip）
const regionSummary = computed(() => {
  const map = new Map<string, number>()
  for (const node of props.nodes) {
    const count = map.get(node.region) ?? 0
    map.set(node.region, count + 1)
  }
  return Array.from(map.entries()).map(([region, count]) => ({ region, count }))
})

// 内存实际使用 / 总内存
const totalMemUsed = computed(() => props.nodes.reduce((sum, node) => sum + (node.ram ?? 0), 0))
const totalMemAll = computed(() => props.nodes.reduce((sum, node) => sum + (node.mem_total ?? 0), 0))

// 硬盘实际使用 / 总硬盘
const totalDiskUsed = computed(() => props.nodes.reduce((sum, node) => sum + (node.disk ?? 0), 0))
const totalDiskAll = computed(() => props.nodes.reduce((sum, node) => sum + (node.disk_total ?? 0), 0))

// 所有机器流量总计（上传+下载）
const totalTrafficUsed = computed(() => props.nodes.reduce((sum, node) => sum + (node.net_total_up ?? 0) + (node.net_total_down ?? 0), 0))

// 排序状态
const sortKey = ref<string>('')
const sortDir = ref<1 | -1>(1)

function handleSort(col: string) {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 1 ? -1 : 1
  }
  else {
    sortKey.value = col
    sortDir.value = 1
  }
}

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

// 排序后的节点列表
const sortedNodes = computed(() => {
  let nodes = [...props.nodes]
  const key = sortKey.value
  const dir = sortDir.value
  if (!key) {
    if (appStore.listOfflineNodesLast)
      nodes = nodesWithOfflineLast(nodes)
    return nodes
  }
  return nodes.sort((a, b) => {
    switch (key) {
      case 'status':
        return dir * ((a.online ? 1 : 0) - (b.online ? 1 : 0))
      case 'region': {
        const va = (a.region || '').toLowerCase()
        const vb = (b.region || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'name': {
        const va = (a.name || '').toLowerCase()
        const vb = (b.name || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'uptime':
        return dir * ((a.uptime ?? 0) - (b.uptime ?? 0))
      case 'os': {
        const va = (a.os || '').toLowerCase()
        const vb = (b.os || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'cpu':
        return dir * ((a.cpu ?? 0) - (b.cpu ?? 0))
      case 'mem':
        return dir * ((a.ram ?? 0) / (a.mem_total || 1) - (b.ram ?? 0) / (b.mem_total || 1))
      case 'disk':
        return dir * ((a.disk ?? 0) / (a.disk_total || 1) - (b.disk ?? 0) / (b.disk_total || 1))
      case 'traffic':
        return dir * (
          ((a.net_out ?? 0) + (a.net_in ?? 0))
          - ((b.net_out ?? 0) + (b.net_in ?? 0))
        )
      case 'rate':
        return dir * (
          ((a.net_out ?? 0) + (a.net_in ?? 0))
          - ((b.net_out ?? 0) + (b.net_in ?? 0))
        )
      default:
        return 0
    }
  })
})

const columns = computed(() => appStore.listViewColumns)
const gridColumns = computed(() => columns.value)

// 格式化函数
const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)

// 动态生成 grid 样式，使用配置的列宽度和间距
const gridStyle = computed(() => {
  const visibleColumns = gridColumns.value
  const columnWidths = appStore.listColumnWidths
  const columnGap = appStore.listColumnGap
  const templateColumns = visibleColumns.map(col => columnWidths[col] || 'auto')
  return {
    gridTemplateColumns: templateColumns.join(' '),
    gap: columnGap,
  }
})

const offlineOverlayContentStyle = computed(() => {
  const statusIndex = gridColumns.value.indexOf('status')
  const regionIndex = gridColumns.value.indexOf('region')
  const nameIndex = gridColumns.value.indexOf('name')

  const startColumn = nameIndex !== -1
    ? nameIndex + 1
    : regionIndex !== -1
      ? regionIndex + 2
      : statusIndex === -1 ? 1 : statusIndex + 2

  return {
    gridColumn: `${startColumn} / -1`,
  }
})

const offlineOverlayMaskStyle = computed(() => {
  const statusIndex = gridColumns.value.indexOf('status')
  return {
    gridColumn: statusIndex === -1 ? '1 / -1' : `${statusIndex + 2} / -1`,
  }
})

const offlineOverlayRegionStyle = computed(() => {
  const regionIndex = gridColumns.value.indexOf('region')
  if (regionIndex === -1) {
    return null
  }

  return {
    gridColumn: `${regionIndex + 1} / span 1`,
  }
})

// 获取列的内边距样式
function getColumnPadding(col: string): Record<string, string> {
  const padding = appStore.listColumnPadding[col]
  if (padding) {
    return { padding }
  }
  return {}
}

// 获取列的外边距样式
function getColumnMargin(col: string): Record<string, string> {
  const margin = appStore.listColumnMargin[col]
  if (margin) {
    return { margin }
  }
  return {}
}

// 获取列的完整样式（合并 padding 和 margin）
function getColumnStyle(col: string): Record<string, string> {
  return {
    ...getColumnPadding(col),
    ...getColumnMargin(col),
  }
}

const tableMinWidth = computed(() =>
  estimateListGridMinWidth(gridColumns.value, appStore.listColumnWidths, appStore.listColumnGap),
)

const { listTableStyle } = useNodeListTable(tableMinWidth)

// 是否启用背景模糊
const hasBackgroundBlur = computed(() => {
  return appStore.backgroundEnabled && appStore.cardBlurRadius > 0
})

// 计算列表模糊半径类
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

// 计算国旗图标路径
function getFlagSrc(region: string): string {
  const code = getRegionCode(region)
  return `/images/flags/${code}.svg`
}

function handleClick(node: NodeData) {
  emit('click', node)
}

function openPingChart(node: NodeData) {
  selectedNode.value = node
  showPingChart.value = true
}

// 计算节点是否显示流量进度条
function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

// 计算流量使用百分比
function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0

  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  let used = 0

  switch (traffic_limit_type) {
    case 'up':
      used = net_total_up
      break
    case 'down':
      used = net_total_down
      break
    case 'min':
      used = Math.min(net_total_up, net_total_down)
      break
    case 'max':
      used = Math.max(net_total_up, net_total_down)
      break
    case 'sum':
    default:
      used = net_total_up + net_total_down
      break
  }

  return Math.min((used / node.traffic_limit) * 100, 100)
}

// 计算已用流量
function getTrafficUsed(node: NodeData): number {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up':
      return net_total_up
    case 'down':
      return net_total_down
    case 'min':
      return Math.min(net_total_up, net_total_down)
    case 'max':
      return Math.max(net_total_up, net_total_down)
    case 'sum':
    default:
      return net_total_up + net_total_down
  }
}

function formatOfflineTime(node: NodeData): string {
  return formatDateTime(node.time)
}

// 根据过期状态获取颜色
function getExpireBadgeColor(status: string): string {
  switch (status) {
    case 'expired':
    case 'critical':
      return '#E54D2E' // 红色
    case 'warning':
      return '#F97316' // 橙色
    case 'long_term':
      return '#8D8D8D' // 灰色
    case 'normal':
    default:
      return '#30A46C' // 绿色
  }
}

/** 节点名称下方：仅 ASN / 厂商（org） */
const LIST_NAME_NETWORK_FIELDS = ['provider', 'asn'] as const

interface NodeMetadataItem {
  key: string
  value: string
  title?: string
  icon?: string
  color?: string
}

function buildNodeNetworkItems(node: NodeData): NodeMetadataItem[] {
  const items: NodeMetadataItem[] = []
  const providerMetadata = getNodeProviderMetadata(node)
  const resolved = providerMetadata?.provider

  for (const field of LIST_NAME_NETWORK_FIELDS) {
    switch (field) {
      case 'provider': {
        if (!resolved?.displayName)
          break

        items.push({
          key: 'provider',
          value: resolved.displayName,
          icon: providerListSvgIcon(resolved.primary.icon),
          title: resolved.tooltipLines.length > 0 ? resolved.tooltipLines.join('\n') : resolved.displayName,
        })
        break
      }
      case 'asn': {
        const asn = providerMetadata?.geo?.asn
        if (!asn)
          break

        items.push({
          key: 'asn',
          value: asn,
          title: (() => {
            const org = providerMetadata?.geo?.org
            if (!org)
              return asn
            const orgLabel = cleanProviderOrg(org)
            return orgLabel ? `${asn}\n${orgLabel}` : asn
          })(),
        })
        break
      }
    }
  }

  return items
}

const nodeNetworkItemsByUuid = computed(() => {
  void metadataByUuid.value
  const itemsByUuid: Record<string, NodeMetadataItem[]> = {}
  for (const node of props.nodes)
    itemsByUuid[node.uuid] = buildNodeNetworkItems(node)
  return itemsByUuid
})

function metadataItemToDisplayTag(item: NodeMetadataItem): NodeDisplayTag {
  if (item.key === 'provider') {
    const fullTitle = item.title ?? item.value
    return {
      key: item.key,
      text: item.value,
      color: '#6366F1',
      icon: providerListSvgIcon(item.icon),
      title: fullTitle,
    }
  }
  if (item.key === 'asn') {
    return {
      key: item.key,
      text: item.value,
      color: '#0EA5E9',
      title: item.title,
    }
  }
  return {
    key: item.key,
    text: item.value,
    color: item.color ?? '#64748B',
    icon: item.icon,
    title: item.title,
  }
}

/** 名称下方：厂商 / ASN */
function getNodeNetworkTags(node: NodeData): NodeDisplayTag[] {
  return (nodeNetworkItemsByUuid.value[node.uuid] ?? []).map(item => metadataItemToDisplayTag(item))
}

/** 名称下方：剩余时长（有价节点） */
function getNodeExpireTag(node: NodeData): NodeDisplayTag | null {
  if (node.price === 0)
    return null

  const lang = appStore.lang
  const days = getDaysUntilExpired(node.expired_at)
  const status = getExpireStatus(node.expired_at)
  const color = getExpireBadgeColor(status)

  if (status === 'expired') {
    return { key: 'expire', text: lang === 'zh-CN' ? '已过期' : 'Expired', color }
  }
  if (status === 'long_term') {
    return { key: 'expire', text: lang === 'zh-CN' ? '长期' : 'Long-term', color }
  }
  return { key: 'expire', text: lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`, color }
}

function getNodeExpireTags(node: NodeData): NodeDisplayTag[] {
  const tag = getNodeExpireTag(node)
  return tag ? [tag] : []
}

/** 名称下方一行：ISP / ASN / 剩余时长 */
function getNodeNameSublineTags(node: NodeData): NodeDisplayTag[] {
  return [...getNodeNetworkTags(node), ...getNodeExpireTags(node)]
}

/** 标签列：价格 / 自定义标签 */
function getNodeListColumnTags(node: NodeData): NodeDisplayTag[] {
  const tags: NodeDisplayTag[] = []
  const lang = appStore.lang

  if (node.price !== 0) {
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push({ key: 'price', text: priceText, color: '#0090FF' })
  }

  for (const [index, tag] of parseTags(node.tags).entries()) {
    tags.push({
      key: `tag-${index}`,
      text: tag.text,
      color: tag.hex,
      title: tag.text,
    })
  }

  return tags
}

// 列标题映射
const columnTitles: Record<string, string> = {
  status: '状态',
  region: '地区',
  name: '节点',
  tags: '标签',
  uptime: '运行时间',
  os: '系统',
  cpu: 'CPU',
  mem: '内存',
  disk: '硬盘',
  traffic: '流量',
  rate: '速率',
}
</script>

<template>
  <div class="node-list-table" :style="listTableStyle">
    <div class="node-list-table__scroll app-scrollbar">
      <NList
        hoverable
        clickable
        bordered
        class="node-list-table__surface"
        :class="[
          { 'light-list-contrast': appStore.lightCardContrast && !appStore.isDark },
          { 'glass-list-enabled': hasBackgroundBlur },
          listBlurClass,
        ]"
      >
      <template #header>
        <div class="node-list-header" :style="gridStyle">
          <template v-for="col in gridColumns" :key="col">
            <div
              :class="`node-list-header__${col}`"
              :style="getColumnStyle(col)"
              class="sortable-header"
              @click="handleSort(col)"
            >
              <NText :depth="3" class="text-xs">
                <template v-if="col === 'region'">
                  <NTooltip>
                    <template #trigger>
                      <span>{{ columnTitles[col] }}{{ sortKey === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '' }}</span>
                    </template>
                    <div class="text-xs leading-relaxed">
                      <div v-for="item in regionSummary" :key="item.region" class="flex items-center gap-1 py-0.5">
                        <img :src="getFlagSrc(item.region)" :alt="getRegionDisplayName(item.region)" class="region-flag">
                        <span>{{ getRegionDisplayName(item.region) }} {{ item.count }}台</span>
                      </div>
                    </div>
                  </NTooltip>
                </template>
                <template v-else>
                  {{ columnTitles[col] }}{{ sortKey === col ? (sortDir === 1 ? ' ↑' : ' ↓') : '' }}
                </template>
                <template v-if="col === 'tags' && monthlyTotalCNY > 0">
                  <NTooltip>
                    <template #trigger>
                      <span class="ml-1 text-[10px] opacity-70">月付 ¥{{ monthlyTotalCNY.toFixed(2) }}</span>
                    </template>
                    <div class="text-xs leading-relaxed">
                      <div>每小时 ¥{{ (monthlyTotalCNY / 30 / 24).toFixed(4) }}</div>
                      <div>每天 ¥{{ (monthlyTotalCNY / 30).toFixed(2) }}</div>
                      <div>每年 ¥{{ (monthlyTotalCNY * 12).toFixed(2) }}</div>
                      <div>本月到期需续费 ¥{{ monthlyRenewalCNY.toFixed(2) }}</div>
                      <div>下月到期需续费 ¥{{ nextMonthRenewalCNY.toFixed(2) }}</div>
                    </div>
                  </NTooltip>
                </template>
                <template v-if="col === 'cpu' && totalCpuAll > 0">
                  <NTooltip>
                    <template #trigger>
                      <span class="ml-1 text-[10px] opacity-70">{{ totalCpuUsed.toFixed(1) }}核/{{ totalCpuAll }}核</span>
                    </template>
                    <div class="text-xs leading-relaxed whitespace-pre">
                      {{ cpuModelSummary }}
                    </div>
                  </NTooltip>
                </template>
                <template v-if="col === 'mem' && totalMemAll > 0">
                  <span class="ml-1 text-[10px] opacity-70">{{ formatBytes(totalMemUsed) }}/{{ formatBytes(totalMemAll) }}</span>
                </template>
                <template v-if="col === 'disk' && totalDiskAll > 0">
                  <span class="ml-1 text-[10px] opacity-70">{{ formatBytes(totalDiskUsed) }}/{{ formatBytes(totalDiskAll) }}</span>
                </template>
                <template v-if="col === 'traffic'">
                  <span class="ml-1 text-[10px] opacity-70">{{ formatBytes(totalTrafficUsed) }}</span>
                </template>
              </NText>
            </div>
          </template>
        </div>
      </template>
      <NListItem
        v-for="node in sortedNodes"
        :key="node.uuid"
        class="node-list-row"
        :class="{ 'node-list-row--offline': !node.online }"
        @click="handleClick(node)"
      >
        <div class="node-list-item" :style="gridStyle">
          <template v-for="col in gridColumns" :key="col">
            <!-- 在线状态指示器 -->
            <div v-if="col === 'status'" class="node-list-item__status" :style="getColumnStyle('status')">
              <div class="flex gap-1 items-center">
                <NTooltip v-if="appStore.showPingChartButton">
                  <template #trigger>
                    <NButton
                      quaternary
                      circle
                      size="tiny"
                      class="p-1!"
                      @click.stop="openPingChart(node)"
                    >
                      <template #icon>
                        <div class="i-lucide-map text-sm" />
                      </template>
                    </NButton>
                  </template>
                  查看延迟图表
                </NTooltip>
                <!-- 根据 listStatusStyle 配置选择显示方式 -->
                <NTag v-if="appStore.listStatusStyle === 'tag'" :type="node.online ? 'success' : 'error'" size="small">
                  {{ node.online ? '在线' : '离线' }}
                </NTag>
                <NBadge v-else :type="node.online ? 'success' : 'error'" :value="node.online ? '在线' : '离线'" />
              </div>
            </div>

            <!-- 国旗 -->
            <div v-else-if="col === 'region'" class="node-list-item__region" :style="getColumnStyle('region')">
              <img
                :src="getFlagSrc(node.region)"
                :alt="getRegionDisplayName(node.region)"
                class="region-flag"
              >
            </div>

            <!-- 节点名称 + ASN / 厂商 -->
            <div v-else-if="col === 'name'" class="node-list-item__name" :style="getColumnStyle('name')">
              <NText class="node-list-item__name-text text-sm font-semibold">
                {{ node.name }}
              </NText>
              <div
                v-if="getNodeNameSublineTags(node).length > 0"
                class="node-list-item__name-tags compact-node-tags node-network-tags"
              >
                <template v-if="appStore.listTagsStyle === 'tag'">
                  <div
                    v-for="tag in getNodeNameSublineTags(node)"
                    :key="tag.key"
                    :class="['network-tag-slot', `network-tag-slot--${tag.key}`]"
                  >
                    <NTooltip :disabled="!tag.title">
                      <template #trigger>
                        <NTag
                          class="network-tag"
                          :color="{ color: `${tag.color}20`, textColor: tag.color, borderColor: `${tag.color}40` }"
                          size="tiny"
                        >
                          <span class="compact-node-tag-icon">
                            <ProviderBrandIcon
                              v-if="tag.icon"
                              :icon="tag.icon"
                              class="network-tag-svg-icon shrink-0"
                            />
                            <span class="compact-node-tag-icon__text">{{ tag.text }}</span>
                          </span>
                        </NTag>
                      </template>
                      <div class="text-xs leading-relaxed whitespace-pre-line">
                        {{ tag.title }}
                      </div>
                    </NTooltip>
                  </div>
                </template>
                <template v-else>
                  <div
                    v-for="tag in getNodeNameSublineTags(node)"
                    :key="tag.key"
                    :class="['network-tag-slot', `network-tag-slot--${tag.key}`]"
                  >
                    <NTooltip :disabled="!tag.title">
                      <template #trigger>
                        <NBadge class="network-tag-badge" :color="tag.color" :value="tag.text" />
                      </template>
                      <div class="text-xs leading-relaxed whitespace-pre-line">
                        {{ tag.title }}
                      </div>
                    </NTooltip>
                  </div>
                </template>
              </div>
            </div>

            <!-- 标签列：价格 / 自定义（标准尺寸，与改紧凑样式前一致） -->
            <div v-else-if="col === 'tags'" class="node-list-item__tags" :style="getColumnStyle('tags')">
              <div v-if="getNodeListColumnTags(node).length > 0" class="flex flex-wrap gap-1 items-center">
                <template v-if="appStore.listTagsStyle === 'tag'">
                  <NTag
                    v-for="tag in getNodeListColumnTags(node)"
                    :key="tag.key"
                    :color="{ color: `${tag.color}20`, textColor: tag.color, borderColor: `${tag.color}40` }"
                    size="small"
                  >
                    {{ tag.text }}
                  </NTag>
                </template>
                <template v-else>
                  <NBadge
                    v-for="tag in getNodeListColumnTags(node)"
                    :key="tag.key"
                    :color="tag.color"
                    :value="tag.text"
                  />
                </template>
              </div>
            </div>

            <!-- 运行时间 -->
            <div v-else-if="col === 'uptime'" class="node-list-item__uptime" :style="getColumnStyle('uptime')">
              <NText :depth="3" class="text-xs" :style="{ fontFamily: appStore.numberFontFamily }">
                {{ formatUptime(node.uptime ?? 0) }}
              </NText>
            </div>

            <!-- 操作系统 -->
            <div v-else-if="col === 'os'" class="node-list-item__os" :style="getColumnStyle('os')">
              <div class="flex gap-1 items-center">
                <NIcon size="16">
                  <img :src="getOSImage(node.os)" :alt="node.os || 'Unknown'">
                </NIcon>
                <NText :depth="3" class="text-xs">
                  {{ node.os || 'Unknown' }}
                </NText>
              </div>
            </div>

            <!-- CPU -->
            <div v-else-if="col === 'cpu'" class="node-list-item__cpu" :style="getColumnStyle('cpu')">
              <div class="flex flex-col gap-0.5">
                <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                  <NText>{{ (node.cpu ?? 0).toFixed(1) }}% / {{ node.cpu_cores ?? '-' }}核</NText>
                  <div class="flex-1" />
                  <NText :depth="3">
                    {{ node.load.toFixed(2) ?? 0 }}, {{ node.load5.toFixed(2) ?? 0 }}, {{ node.load15.toFixed(2) ?? 0 }}
                  </NText>
                </div>
                <NProgress :show-indicator="false" :percentage="node.cpu ?? 0" :status="getStatus(node.cpu ?? 0)" :height="4" />
              </div>
            </div>

            <!-- 内存 -->
            <div v-else-if="col === 'mem'" class="node-list-item__mem" :style="getColumnStyle('mem')">
              <div class="flex flex-col gap-0.5">
                <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                  <NText>{{ ((node.ram ?? 0) / (node.mem_total || 1) * 100).toFixed(1) }}%</NText>
                  <div class="flex-1" />
                  <NText :depth="3">
                    {{ formatBytes(node.ram ?? 0) }} / {{ formatBytes(node.mem_total ?? 0) }}
                  </NText>
                </div>
                <NProgress :show-indicator="false" :percentage="(node.ram ?? 0) / (node.mem_total || 1) * 100" :status="getStatus((node.ram ?? 0) / (node.mem_total || 1) * 100)" :height="4" />
              </div>
            </div>

            <!-- 硬盘 -->
            <div v-else-if="col === 'disk'" class="node-list-item__disk" :style="getColumnStyle('disk')">
              <div class="flex flex-col gap-0.5">
                <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                  <NText>{{ ((node.disk ?? 0) / (node.disk_total || 1) * 100).toFixed(1) }}%</NText>
                  <div class="flex-1" />
                  <NText :depth="3">
                    {{ formatBytes(node.disk ?? 0) }} / {{ formatBytes(node.disk_total ?? 0) }}
                  </NText>
                </div>
                <NProgress :show-indicator="false" :percentage="(node.disk ?? 0) / (node.disk_total || 1) * 100" :status="getStatus((node.disk ?? 0) / (node.disk_total || 1) * 100)" :height="4" />
              </div>
            </div>

            <!-- 速率 -->
            <div v-else-if="col === 'rate'" class="node-list-item__rate" :style="getColumnStyle('rate')">
              <div class="text-[11px] flex flex-col gap-1" :style="{ fontFamily: appStore.numberFontFamily }">
                <NText>
                  <span :style="{ color: themeVars.successColor }">↑{{ formatBytesPerSecond(node.net_out ?? 0) }}</span>
                </NText>
                <NText>
                  <span :style="{ color: themeVars.infoColor }">↓{{ formatBytesPerSecond(node.net_in ?? 0) }}</span>
                </NText>
              </div>
            </div>

            <!-- 流量 -->
            <div v-else-if="col === 'traffic'" class="node-list-item__traffic" :style="getColumnStyle('traffic')">
              <div class="traffic-cell">
                <NTooltip :trigger="isTouchDevice ? 'click' : 'hover'">
                  <template #trigger>
                    <div class="flex flex-col gap-0.5 w-full" :class="{ 'cursor-help': !isTouchDevice }" @click.stop>
                      <div class="text-[11px] flex gap-1 items-center" :style="{ fontFamily: appStore.numberFontFamily }">
                        <NText v-if="showTrafficProgress(node)">{{ getTrafficUsedPercentage(node).toFixed(1) }}%</NText>
                        <div class="flex-1" />
                        <NText :depth="3">
                          {{ formatBytes(getTrafficUsed(node)) }} / <template v-if="showTrafficProgress(node)">{{ formatBytes(node.traffic_limit) }}</template><template v-else>∞</template>
                        </NText>
                      </div>
                      <!-- 统一使用 TrafficProgress 组件，自动根据类型选择颜色 -->
                      <TrafficProgress
                        :upload="node.net_total_up ?? 0"
                        :download="node.net_total_down ?? 0"
                        :traffic-limit="node.traffic_limit"
                        :traffic-limit-type="(node.traffic_limit_type || 'sum')"
                        height="4px"
                      />
                    </div>
                  </template>
                  <div class="text-[11px] flex flex-col gap-1" :style="{ fontFamily: appStore.numberFontFamily }">
                    <span><span :style="{ color: themeVars.successColor }">↑</span> {{ formatBytes(node.net_total_up ?? 0) }}</span>
                    <span><span :style="{ color: themeVars.infoColor }">↓</span> {{ formatBytes(node.net_total_down ?? 0) }}</span>
                  </div>
                </NTooltip>
              </div>
            </div>
          </template>
        </div>
        <div v-if="!node.online" class="node-offline-overlay" aria-hidden="true">
          <div class="node-offline-overlay__grid" :style="gridStyle">
            <div class="node-offline-overlay__mask" :style="offlineOverlayMaskStyle" />
            <div v-if="offlineOverlayRegionStyle" class="node-offline-overlay__region" :style="offlineOverlayRegionStyle">
              <img
                :src="getFlagSrc(node.region)"
                :alt="getRegionDisplayName(node.region)"
                class="region-flag node-offline-overlay__flag"
              >
            </div>
            <div class="node-offline-overlay__content" :style="offlineOverlayContentStyle">
              <NText class="node-offline-overlay__name text-sm font-semibold truncate">
                {{ node.name }}
              </NText>
              <NText :depth="3" class="node-offline-overlay__time text-xs" :style="{ fontFamily: appStore.numberFontFamily }">
                最后在线 {{ formatOfflineTime(node) }}
              </NText>
            </div>
          </div>
        </div>
      </NListItem>
      </NList>
    </div>

    <!-- 延迟图表弹窗 -->
    <NModal
      v-model:show="showPingChart"
      preset="card"
      :title="selectedNode ? `${selectedNode.name} - 延迟监控` : '延迟监控'"
      class="w-full sm:w-3/4"
      :bordered="false"
      :segmented="{ content: true, footer: 'soft' }"
    >
      <PingChart v-if="selectedNode" :uuid="selectedNode.uuid" />
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.node-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  padding: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.node-list-row:hover .node-offline-overlay {
  opacity: 0;
}

.node-offline-overlay__grid {
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 8px 16px;
  align-items: stretch;
}

.node-offline-overlay__mask,
.node-offline-overlay__region,
.node-offline-overlay__content {
  grid-row: 1;
}

.node-offline-overlay__mask {
  align-self: stretch;
  height: 100%;
  background-color: color-mix(in srgb, var(--n-color) 76%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.node-offline-overlay__region,
.node-offline-overlay__content {
  position: relative;
  z-index: 1;
}

.node-offline-overlay__region {
  display: flex;
  align-self: center;
  align-items: center;
  justify-content: center;
}

.node-offline-overlay__content {
  display: flex;
  align-self: center;
  min-width: 0;
  max-width: 100%;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
}

.node-offline-overlay__name {
  min-width: 0;
  max-width: min(40%, 280px);
}

.node-offline-overlay__flag {
  flex-shrink: 0;
}

.node-offline-overlay__time {
  flex-shrink: 0;
  white-space: nowrap;
}

.node-list-item__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
  justify-content: center;
}

.node-list-item__name-tags {
  max-width: 100%;
}

/* 厂商/ASN：内容多宽标签多宽；仅超出节点列宽时才压缩（厂商优先省略） */
.node-list-item__name-tags.node-network-tags {
  flex-flow: row nowrap;
}

.node-network-tags {
  display: flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 2px;
  flex-flow: row nowrap;
}

.node-network-tags .network-tag-slot {
  display: inline-flex;
  flex: 0 0 auto;
  max-width: 100%;
  min-width: 0;
}

.node-network-tags :deep(.network-tag.n-tag) {
  width: auto;
  max-width: 100%;
}

.node-network-tags :deep(.network-tag-badge) {
  max-width: 100%;
}

@media (orientation: landscape) {
  .node-network-tags {
    flex-flow: row nowrap;
  }

  /* 总宽度够：两个标签都不拉长；不够：只压厂商名，ASN 保持自然宽度 */
  .node-network-tags .network-tag-slot--provider {
    flex: 0 1 auto;
    overflow: hidden;
  }

  .node-network-tags .network-tag-slot--asn,
  .node-network-tags .network-tag-slot--expire {
    flex: 0 0 auto;
  }

  .node-network-tags .network-tag-slot--provider :deep(.network-tag-badge .n-badge-sup) {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
  }
}

@media (orientation: portrait) {
  .node-list-item__name-tags.node-network-tags {
    flex-flow: row nowrap;
    align-items: center;
  }
}

.node-list-header__tags,
.node-list-item__tags {
  min-width: 0;
}

.node-list-header__uptime,
.node-list-item__uptime {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.node-list-header__os,
.node-list-item__os {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-list-header__cpu,
.node-list-item__cpu,
.node-list-header__mem,
.node-list-item__mem,
.node-list-header__disk,
.node-list-item__disk {
  min-width: 0;
}

.node-list-header__traffic,
.node-list-item__traffic {
  min-width: 0;
}

.node-list-header__rate,
.node-list-item__rate {
  min-width: 0;
}

.sortable-header {
  cursor: pointer;
  user-select: none;

  &:hover :deep(.n-text) {
    opacity: 0.75;
  }
}

.traffic-cell {
  min-height: 38px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 亮色模式高对比度样式 */
.light-list-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);

  :deep(.n-list-item) {
    border-color: rgba(0, 0, 0, 0.08);
  }
}

/* 毛玻璃列表样式 */
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
