<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { NAlert, NButton, NDivider, NEmpty, NTooltip, useMessage } from 'naive-ui'
import { computed, defineAsyncComponent, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { formatBytes, formatBytesPerSecond, formatUptime } from '@/utils/helper'
import { getOSName } from '@/utils/osImageHelper'
import { isNodeInGroup } from '@/utils/groupHelper'
import { isRegionMatch } from '@/utils/regionHelper'
import { getInitManager } from '@/utils/init'

// 定义组件名称，用于 KeepAlive 匹配
defineOptions({
  name: 'HomeView',
})

// 异步组件：按需加载，减少首屏体积
const NodeCard = defineAsyncComponent(() => import('@/components/NodeCard.vue'))
const NodeGeneralCards = defineAsyncComponent(() => import('@/components/NodeGeneralCards.vue'))
const NodeList = defineAsyncComponent(() => import('@/components/NodeList.vue'))
const ProviderValuePanel = defineAsyncComponent(() => import('@/components/ProviderValuePanel.vue'))
const FinanceValuePanel = defineAsyncComponent(() => import('@/components/FinanceValuePanel.vue'))
const NetworkQualityPanel = defineAsyncComponent(() => import('@/components/NetworkQualityPanel.vue'))
const EarthMapPanel = defineAsyncComponent(() => import('@/components/EarthMapPanel.vue'))
const IpQualityPanel = defineAsyncComponent(() => import('@/components/IpQualityPanel.vue'))

type NodesExtraPanel = 'none' | 'providerValue' | 'financeValue' | 'networkQuality' | 'earthMap' | 'ipQuality'
type ExtraPanel = Exclude<NodesExtraPanel, 'none'>
const PANEL_ROUTES: Record<ExtraPanel, string> = {
  providerValue: '/provider-value',
  financeValue: '/asset-value',
  networkQuality: '/network-quality',
  earthMap: '/earth-map',
  ipQuality: '/ip-quality',
}

function panelFromPath(path: string): ExtraPanel | 'none' {
  if (path === '/provider-value')
    return 'providerValue'
  if (path === '/asset-value' || path === '/finance-value')
    return 'financeValue'
  if (path === '/network-quality')
    return 'networkQuality'
  if (path === '/earth-map' || path === '/node-map')
    return 'earthMap'
  if (path === '/ip-quality' || path === '/ipquality' || path === '/ipquaility')
    return 'ipQuality'
  return 'none'
}

const appStore = useAppStore()
const nodesStore = useNodesStore()
const route = useRoute()
const router = useRouter()

const nodesExtraPanel = ref<NodesExtraPanel>(panelFromPath(route.path))

function setExtraPanel(panel: ExtraPanel | 'none') {
  nodesExtraPanel.value = panel
  const target = panel === 'none' ? '/' : PANEL_ROUTES[panel]
  if (route.path !== target)
    void router.push(target)
}

function handleViewToggle() {
  if (nodesToolbarExtraOpen.value) {
    setExtraPanel('none')
    return
  }
  appStore.nodeViewMode = appStore.nodeViewMode === 'card' ? 'list' : 'card'
}

function toggleNodesExtraPanel(panel: Exclude<NodesExtraPanel, 'none'>) {
  if (panel === 'ipQuality' && !appStore.isLoggedIn)
    return
  setExtraPanel(nodesExtraPanel.value === panel ? 'none' : panel)
}

watch(
  () => route.path,
  path => {
    nodesExtraPanel.value = panelFromPath(path)
  },
)

const showProviderValuePanel = computed(() => nodesExtraPanel.value === 'providerValue')
const showFinanceValuePanel = computed(() => nodesExtraPanel.value === 'financeValue')
const showNetworkQualityPanel = computed(() => nodesExtraPanel.value === 'networkQuality')
const showEarthMapPanel = computed(() => nodesExtraPanel.value === 'earthMap')
const showIpQualityPanel = computed(
  () => appStore.isLoggedIn && nodesExtraPanel.value === 'ipQuality',
)
const nodesToolbarExtraOpen = computed(() => nodesExtraPanel.value !== 'none')
const showIpQualityEntry = computed(() => appStore.isLoggedIn)

const currentGroupLabel = computed(() => {
  if (appStore.nodeSelectedGroup === 'all')
    return '全部节点'
  return appStore.nodeSelectedGroup
})

const message = useMessage()

// 组件激活时恢复滚动位置
onActivated(() => {
  if (appStore.homeScrollPosition > 0) {
    // 使用 nextTick 确保 DOM 已渲染完成后再恢复滚动
    nextTick(() => {
      window.scrollTo({ top: appStore.homeScrollPosition, behavior: 'instant' })
    })
  }
})

// 组件失活时保存滚动位置
onDeactivated(() => {
  appStore.homeScrollPosition = window.scrollY
})

// 防抖后的搜索文本（搜索框在 Header）
const debouncedSearchText = ref('')

const updateDebouncedSearch = useDebounceFn((value: string) => {
  debouncedSearchText.value = value
}, 300)

watch(
  () => appStore.nodeSearchText,
  (value) => {
    updateDebouncedSearch(value)
  },
  { immediate: true },
)

watch(
  () => appStore.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn && nodesExtraPanel.value === 'ipQuality')
      nodesExtraPanel.value = 'none'
  },
  { immediate: true },
)

const groupTabs = computed(() => [
  { label: '全部', name: 'all' },
  ...nodesStore.groups.map(group => ({
    label: group,
    name: group,
  })),
])

const groupTabsNavRef = ref<HTMLElement | null>(null)
const groupTabIndicator = ref({ x: 0, width: 0 })

function updateGroupTabIndicator() {
  const nav = groupTabsNavRef.value
  if (!nav)
    return

  const activeTab = nav.querySelector<HTMLElement>('.group-filter-tab--active')
  if (!activeTab) {
    groupTabIndicator.value = { x: 0, width: 0 }
    return
  }

  groupTabIndicator.value = {
    x: activeTab.offsetLeft,
    width: activeTab.offsetWidth,
  }
}

/** 仅在 Tab 栏内横向滚动，避免 scrollIntoView 带动整页跳动 */
function scrollActiveGroupTabIntoToolbar() {
  const nav = groupTabsNavRef.value
  if (!nav)
    return

  const scroller = nav.closest<HTMLElement>('.node-toolbar__tabs')
  const activeTab = nav.querySelector<HTMLElement>('.group-filter-tab--active')
  if (!scroller || !activeTab)
    return

  const tabRect = activeTab.getBoundingClientRect()
  const scrollerRect = scroller.getBoundingClientRect()
  const edge = 8

  if (tabRect.left < scrollerRect.left)
    scroller.scrollLeft -= scrollerRect.left - tabRect.left + edge
  else if (tabRect.right > scrollerRect.right)
    scroller.scrollLeft += tabRect.right - scrollerRect.right + edge
}

function selectGroupTab(name: string) {
  appStore.nodeSelectedGroup = name
  nextTick(() => {
    updateGroupTabIndicator()
    scrollActiveGroupTabIntoToolbar()
  })
}

const nodePanelTransitionKey = computed(
  () => `${appStore.nodeSelectedGroup}|${debouncedSearchText.value}|${appStore.nodeViewMode}|${nodesExtraPanel.value}`,
)

watch(
  () => [appStore.nodeSelectedGroup, groupTabs.value.length],
  () => {
    nextTick(updateGroupTabIndicator)
  },
)

onMounted(() => {
  void getInitManager()?.ensureFullNodes()
  nextTick(updateGroupTabIndicator)
  window.addEventListener('resize', updateGroupTabIndicator)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateGroupTabIndicator)
})

// 验证当前选中的分组是否有效，无效则重置为 'all'
watch(
  () => nodesStore.groups,
  (groups) => {
    const currentGroup = appStore.nodeSelectedGroup
    if (currentGroup !== 'all' && !groups.includes(currentGroup)) {
      appStore.nodeSelectedGroup = 'all'
    }
  },
  { immediate: true },
)

/**
 * 检查节点是否匹配搜索词
 */
function isNodeMatchSearch(node: typeof nodesStore.nodes[number], search: string): boolean {
  if (!search.trim())
    return true

  const lowerSearch = search.toLowerCase().trim()

  // 搜索节点名称
  if (node.name.toLowerCase().includes(lowerSearch))
    return true

  // 搜索地区（使用 regionHelper 支持国家名称搜索）
  if (node.region && isRegionMatch(node.region, search))
    return true

  // 搜索操作系统
  if (node.os && node.os.toLowerCase().includes(lowerSearch))
    return true

  // 搜索分组
  if (node.group && node.group.toLowerCase().includes(lowerSearch))
    return true

  // 搜索标签
  if (node.tags && node.tags.toLowerCase().includes(lowerSearch))
    return true

  // 搜索备注
  if (node.remark && node.remark.toLowerCase().includes(lowerSearch))
    return true

  return false
}

const nodeList = computed(() => {
  // 先按分组筛选
  let filteredNodes = nodesStore.nodes.filter(node =>
    isNodeInGroup(node.group, appStore.nodeSelectedGroup),
  )

  // 再按防抖后的搜索词筛选
  if (debouncedSearchText.value.trim()) {
    filteredNodes = filteredNodes.filter(node => isNodeMatchSearch(node, debouncedSearchText.value))
  }

  return filteredNodes
})

function handleNodeClick(node: typeof nodesStore.nodes[number]) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

function copyNodeInfo() {
  const lines = nodeList.value.map((node) => {
    const status = node.online ? '在线' : '离线'
    const region = node.region || '-'
    const name = node.name || '-'
    const tags = node.tags || '-'
    const uptime = node.uptime ? formatUptime(node.uptime) : '-'
    const os = node.os ? getOSName(node.os) : '-'
    const cpu = `占用率: ${(node.cpu ?? 0).toFixed(1)}% | 核心数: ${node.cpu_cores ?? '-'}核`
    const mem = `占用率: ${((node.ram ?? 0) / (node.mem_total || 1) * 100).toFixed(1)}% | 已使用: ${formatBytes(node.ram ?? 0)} | 总共: ${formatBytes(node.mem_total ?? 0)}`
    const disk = `占用率: ${((node.disk ?? 0) / (node.disk_total || 1) * 100).toFixed(1)}% | 已使用: ${formatBytes(node.disk ?? 0)} | 总共: ${formatBytes(node.disk_total ?? 0)}`
    const traffic = `已用: ${formatBytes((node.net_total_up ?? 0) + (node.net_total_down ?? 0))}`
    const rate = `上传: ${formatBytesPerSecond(node.net_out ?? 0)} | 下载: ${formatBytesPerSecond(node.net_in ?? 0)}`
    return `状态: ${status}\n地区: ${region}\n节点: ${name}\n标签: ${tags}\n运行时间: ${uptime}\n系统: ${os}\nCPU: ${cpu}\n内存: ${mem}\n硬盘: ${disk}\n流量: ${traffic}\n速率: ${rate}\n---`
  })
  const text = lines.join('\n')
  navigator.clipboard.writeText(text).then(() => {
    message.success('已复制所有服务器信息到剪贴板')
  }).catch(() => {
    message.error('复制失败')
  })
}
</script>

<template>
  <div class="home-view min-w-0 max-w-full">
    <div v-if="appStore.connectionError" class="alert px-4">
      <NAlert type="error" title="RPC 服务错误" show-icon>
        连接服务器失败，请检查网络设置或刷新页面后再试。
      </NAlert>
    </div>
    <!-- 自定义公告 -->
    <div v-if="appStore.alertEnabled && appStore.alertContent" class="alert px-4">
      <NAlert :type="appStore.alertType" :title="appStore.alertTitle || undefined" show-icon>
        <MarkdownRenderer :content="appStore.alertContent" />
      </NAlert>
    </div>
    <NodeGeneralCards />
    <NDivider class="my-0! px-4!" dashed />
    <div class="node-info p-4 flex flex-col gap-4 min-w-0 max-w-full">
      <div class="node-toolbar node-toolbar--aligned flex gap-2 items-center">
        <div class="node-toolbar__tabs min-w-0 max-w-[calc(100%-11.5rem)]">
          <div ref="groupTabsNavRef" class="group-filter-tabs" role="tablist">
            <button
              v-for="tab in groupTabs"
              :key="tab.name"
              type="button"
              role="tab"
              class="group-filter-tab"
              :class="{ 'group-filter-tab--active': appStore.nodeSelectedGroup === tab.name }"
              :aria-selected="appStore.nodeSelectedGroup === tab.name"
              @click="selectGroupTab(tab.name)"
            >
              {{ tab.label }}
            </button>
            <span
              class="group-filter-indicator"
              :style="{
                width: `${groupTabIndicator.width}px`,
                transform: `translateX(${groupTabIndicator.x}px)`,
              }"
              aria-hidden="true"
            />
          </div>
        </div>
        <div class="ml-auto flex shrink-0 gap-2 items-center">
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" :class="{ 'node-toolbar__action--active': showProviderValuePanel }" aria-label="单机资源成本对比" @click="toggleNodesExtraPanel('providerValue')">
                <template #icon><div class="i-lucide-scale" /></template>
              </NButton>
            </template>
            单机资源成本对比
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" :class="{ 'node-toolbar__action--active': showFinanceValuePanel }" aria-label="资产价值" @click="toggleNodesExtraPanel('financeValue')">
                <template #icon><div class="i-lucide-wallet" /></template>
              </NButton>
            </template>
            资产价值
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" :class="{ 'node-toolbar__action--active': showNetworkQualityPanel }" aria-label="网络质量" @click="toggleNodesExtraPanel('networkQuality')">
                <template #icon><div class="i-lucide-wifi" /></template>
              </NButton>
            </template>
            网络质量
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" :class="{ 'node-toolbar__action--active': showEarthMapPanel }" aria-label="节点分布" @click="toggleNodesExtraPanel('earthMap')">
                <template #icon><div class="i-lucide-globe" /></template>
              </NButton>
            </template>
            节点分布
          </NTooltip>
          <NTooltip v-if="showIpQualityEntry" placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" :class="{ 'node-toolbar__action--active': showIpQualityPanel }" aria-label="IP 质量" @click="toggleNodesExtraPanel('ipQuality')">
                <template #icon><div class="i-lucide-shield" /></template>
              </NButton>
            </template>
            IP 质量
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" aria-label="切换视图" @click="handleViewToggle">
                <template #icon><div :class="appStore.nodeViewMode === 'card' ? 'i-lucide-list' : 'i-lucide-layout-grid'" /></template>
              </NButton>
            </template>
            {{ appStore.nodeViewMode === 'card' ? '切换为列表视图' : '切换为卡片视图' }}
          </NTooltip>
          <NTooltip placement="bottom">
            <template #trigger>
              <NButton quaternary class="node-toolbar__action" aria-label="复制节点信息" @click="copyNodeInfo">
                <template #icon><div class="i-lucide-copy" /></template>
              </NButton>
            </template>
            复制节点信息
          </NTooltip>
        </div>
      </div>
      <div class="nodes-stage">
        <Transition name="node-panel-switch" mode="out-in">
          <div :key="nodePanelTransitionKey" class="nodes min-w-0 w-full max-w-full">
            <ProviderValuePanel
              v-if="showProviderValuePanel && nodeList.length !== 0"
              :nodes="nodeList"
              :group-label="currentGroupLabel"
              :node-count="nodeList.length"
            />
            <FinanceValuePanel
              v-else-if="showFinanceValuePanel && nodeList.length !== 0"
              :nodes="nodeList"
              :group-label="currentGroupLabel"
            />
            <NetworkQualityPanel
              v-else-if="showNetworkQualityPanel && nodeList.length !== 0"
              :nodes="nodeList"
              :group-label="currentGroupLabel"
            />
            <EarthMapPanel
              v-else-if="showEarthMapPanel && nodeList.length !== 0"
              :nodes="nodeList"
              :group-label="currentGroupLabel"
            />
            <IpQualityPanel
              v-else-if="showIpQualityEntry && showIpQualityPanel && nodeList.length !== 0"
              :nodes="nodeList"
              :group-label="currentGroupLabel"
            />
            <div v-else-if="nodesToolbarExtraOpen" class="text-gray-500 text-center">
              <NEmpty description="暂无节点" />
            </div>
            <div v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'card'" class="gap-4 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
              <NodeCard v-for="node in nodeList" :key="node.uuid" :node="node" @click="handleNodeClick(node)" />
            </div>
            <NodeList v-else-if="nodeList.length !== 0 && appStore.nodeViewMode === 'list'" :nodes="nodeList" @click="handleNodeClick" />
            <div v-else class="text-gray-500 text-center">
              <NEmpty description="暂无节点" />
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.node-toolbar--aligned {
  --node-toolbar-height: 32px;
}

.node-toolbar__action {
  width: var(--node-toolbar-height) !important;
  height: var(--node-toolbar-height) !important;
  padding: 0 !important;
  border: 1px solid transparent;
  border-radius: 10px;
  transition: color .15s ease, background .15s ease, border-color .15s ease, transform .15s ease;
}

.node-toolbar__action:hover {
  border-color: var(--glass-border);
  background: var(--glass-panel) !important;
  color: var(--n-primary-color) !important;
  transform: translateY(-1px);
}

.node-toolbar__action--active {
  color: var(--n-primary-color) !important;
}

.node-toolbar__tabs {
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
}

.group-filter-tabs {
  position: relative;
  display: flex;
  width: max-content;
  max-width: 100%;
  gap: 6px;
  align-items: center;
  min-height: calc(var(--node-toolbar-height) + 4px);
}

.group-filter-tab {
  position: relative;
  z-index: 1;
  flex: none;
  height: var(--node-toolbar-height);
  margin: 0;
  padding: 0 12px;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 14px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  color: var(--n-text-color-3);
  border-radius: var(--n-border-radius);
  transition: color 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.group-filter-tab:hover {
  color: var(--n-text-color);
}

.group-filter-tab--active {
  font-weight: 600;
  color: var(--n-text-color);
}

.group-filter-tab:focus-visible {
  outline: 2px solid var(--n-primary-color);
  outline-offset: 2px;
}

.group-filter-indicator {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  border-radius: 1px;
  background-color: var(--n-primary-color);
  pointer-events: none;
  transition:
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, width;
}

.nodes-stage {
  position: relative;
}

.node-panel-switch-enter-active {
  transition:
    opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.node-panel-switch-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.node-panel-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.node-panel-switch-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

</style>
