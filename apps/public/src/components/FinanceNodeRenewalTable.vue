<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { NBadge, NEmpty, NList, NListItem, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import NodeListNameCell from '@/components/NodeListNameCell.vue'
import { useNodeListSurface } from '@/composables/useNodeListSurface'
import { useNodeListTable } from '@/composables/useNodeListTable'
import { estimateMinWidthFromGridTemplate } from '@/constants/nodeListTable'
import { useAppStore } from '@/stores/app'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle } from '@/utils/tagHelper'

export interface FinanceNodeTableRow {
  key: string
  node: NodeData
  expiredAt: Date | null
  daysLeft: number
  renewalCNY: number
}

const props = defineProps<{
  title: string
  summary: string
  rows: FinanceNodeTableRow[]
  emptyDescription: string
  gridStyle: Record<string, string>
  nodes: NodeData[]
  formatAmount: (amount: number) => string
  formatExpiryDate: (date: Date) => string
  formatRemainingDays: (daysLeft: number) => string
}>()

const emit = defineEmits<{
  openNode: [node: NodeData]
}>()

const appStore = useAppStore()
const { listSurfaceClass } = useNodeListSurface()

const tableMinWidth = computed(() =>
  estimateMinWidthFromGridTemplate(
    String(props.gridStyle.gridTemplateColumns ?? ''),
    String(props.gridStyle.gap ?? '12px'),
  ),
)

const { listTableStyle } = useNodeListTable(tableMinWidth)

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}
</script>

<template>
  <div class="finance-table-block min-w-0 max-w-full flex flex-col gap-2">
    <div class="flex flex-wrap gap-2 items-baseline justify-between min-w-0">
      <NText class="text-sm font-semibold">
        {{ title }}
      </NText>
      <NText depth="3" class="text-sm">
        {{ summary }}
      </NText>
    </div>
    <div class="node-list-table min-w-0 max-w-full" :style="listTableStyle">
      <div class="node-list-table__scroll app-scrollbar">
        <NList
          hoverable
          clickable
          bordered
          class="node-list-table__surface"
          :class="listSurfaceClass"
        >
          <template #header>
            <div class="node-list-header finance-renewal-grid" :style="gridStyle">
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
              <div class="finance-renewal-grid__cell">
                <NText :depth="3" class="text-xs">
                  到期
                </NText>
              </div>
              <div class="finance-renewal-grid__cell">
                <NText :depth="3" class="text-xs">
                  剩余
                </NText>
              </div>
              <div class="finance-renewal-grid__cell">
                <NText :depth="3" class="text-xs">
                  计费
                </NText>
              </div>
              <div class="finance-renewal-grid__cell finance-renewal-grid__cell--end">
                <NText :depth="3" class="text-xs">
                  续费
                </NText>
              </div>
            </div>
          </template>
          <NListItem v-if="rows.length === 0" class="node-list-row">
            <NEmpty :description="emptyDescription" size="small" />
          </NListItem>
          <NListItem
            v-for="row in rows"
            :key="row.key"
            class="node-list-row"
            @click="emit('openNode', row.node)"
          >
            <div class="node-list-item finance-renewal-grid" :style="gridStyle">
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
              <NodeListNameCell :node="row.node" :nodes="nodes" subline-mode="renewal" />
              <div class="finance-renewal-grid__cell">
                <NText depth="3" class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ row.expiredAt && Number.isFinite(row.expiredAt.getTime()) ? formatExpiryDate(row.expiredAt) : '—' }}
                </NText>
              </div>
              <div class="finance-renewal-grid__cell">
                <NText depth="3" class="text-sm tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ row.node.expired_at ? formatRemainingDays(row.daysLeft) : '—' }}
                </NText>
              </div>
              <div class="finance-renewal-grid__cell">
                <NText depth="3" class="text-sm truncate">
                  {{ formatPriceWithCycle(row.node.price, row.node.billing_cycle, row.node.currency, appStore.lang) }}
                </NText>
              </div>
              <div class="finance-renewal-grid__cell finance-renewal-grid__cell--end">
                <NText class="text-sm font-semibold tabular-nums" :style="{ fontFamily: appStore.numberFontFamily }">
                  {{ formatAmount(row.renewalCNY) }}
                </NText>
              </div>
            </div>
          </NListItem>
        </NList>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.finance-renewal-grid {
  align-items: center;
}

.finance-renewal-grid__cell {
  min-width: 0;
  overflow: hidden;
}

.finance-renewal-grid__cell--end {
  text-align: right;
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
