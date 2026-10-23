<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { NCard, NEmpty, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import NodeEarthRealisticGlobe from '@/components/NodeEarthRealisticGlobe.vue'
import { useNodeGeoClusters } from '@/composables/useNodeGeoClusters'
import { useAppStore } from '@/stores/app'
import { getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{
  nodes: NodeData[]
  groupLabel: string
}>()

const appStore = useAppStore()

const {
  regionClusters,
  totalServers,
  onlineServers,
  offlineServers,
} = useNodeGeoClusters({ nodes: () => props.nodes })

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

function getFlagSrc(code: string): string {
  return `/images/flags/${code.trim().toUpperCase()}.svg`
}
</script>

<template>
  <div class="earth-map-panel min-w-0 flex flex-col gap-4">
    <NCard
      :bordered="!hasBackgroundBlur"
      :class="cardSurfaceClass"
    >
      <NText class="text-base font-semibold">
        节点分布
      </NText>
      <NText depth="3" class="text-sm block mt-0.5">
        {{ groupLabel }} {{ totalServers }} 台
        <template v-if="onlineServers > 0">
          在线 {{ onlineServers }}
        </template>
        <template v-if="offlineServers > 0">
          离线 {{ offlineServers }}
        </template>
      </NText>
    </NCard>

    <div class="earth-map-panel__layout gap-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
      <NCard
        :bordered="!hasBackgroundBlur"
        :class="cardSurfaceClass"
        class="earth-map-panel__globe-card overflow-hidden min-h-[640px] lg:min-h-[760px]"
        content-class="!p-0 h-full min-h-[inherit]"
      >
        <div v-if="totalServers === 0" class="flex items-center justify-center min-h-[600px] lg:min-h-[720px]">
          <NEmpty description="暂无节点" size="small" />
        </div>
        <div v-else class="earth-map-panel__globe-host relative h-full min-h-[600px] lg:min-h-[720px]">
          <NodeEarthRealisticGlobe :nodes="nodes" layout="fullscreen" />
        </div>
      </NCard>

      <NCard
        :bordered="!hasBackgroundBlur"
        :class="cardSurfaceClass"
        class="earth-map-panel__list-card min-h-0"
        title="地区聚合"
        size="small"
      >
        <NEmpty v-if="regionClusters.length === 0" description="无法解析节点地理位置" size="small" />
        <ul v-else class="earth-map-panel__cluster-list flex flex-col gap-2 m-0 p-0 list-none max-h-[760px] overflow-y-auto app-scrollbar">
          <li
            v-for="cluster in regionClusters"
            :key="cluster.id"
            class="earth-map-panel__cluster-item flex gap-2 items-start rounded-md px-2 py-2 transition-colors hover:bg-[var(--n-color-hover)]"
          >
            <img
              v-if="cluster.code"
              :src="getFlagSrc(cluster.code)"
              :alt="getRegionDisplayName(cluster.code)"
              class="region-flag shrink-0 mt-0.5"
            >
            <div class="min-w-0 flex-1">
              <NText class="text-sm font-medium block truncate">
                {{ cluster.label || getRegionDisplayName(cluster.code) || cluster.code }}
              </NText>
              <NText depth="3" class="text-xs block truncate">
                {{ cluster.servers }} 台
                <template v-if="cluster.onlineServers > 0">
                  · 在线 {{ cluster.onlineServers }}
                </template>
              </NText>
            </div>
            <div class="flex shrink-0 flex-col gap-1 items-end">
              <NTag v-if="cluster.onlineServers > 0" type="success" size="small">
                在线
              </NTag>
              <NTag v-if="cluster.servers > cluster.onlineServers" size="small">
                离线 {{ cluster.servers - cluster.onlineServers }}
              </NTag>
            </div>
          </li>
        </ul>
      </NCard>
    </div>
  </div>
</template>

<style scoped lang="scss">
.earth-map-panel__globe-host {
  isolation: isolate;
}
</style>
