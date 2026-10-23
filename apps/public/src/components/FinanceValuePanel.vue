<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { useNow } from '@vueuse/core'
import { NCard, NText } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import FinanceNodeRenewalTable, { type FinanceNodeTableRow } from '@/components/FinanceNodeRenewalTable.vue'
import { useNodeListSurface } from '@/composables/useNodeListSurface'
import { useAppStore } from '@/stores/app'
import * as financeHelper from '@/utils/financeHelper'
import { getDaysUntilExpired, hasNoRenewAfterExpireTag, isFreeNode } from '@/utils/tagHelper'

const props = defineProps<{
  nodes: NodeData[]
  groupLabel: string
}>()

const appStore = useAppStore()
const router = useRouter()
const now = useNow({ interval: 60_000 })
const { cardSurfaceClass, hasBackgroundBlur } = useNodeListSurface()

const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
const financeCurrency = ref(financeHelper.getStoredFinanceCurrency())
onMounted(async () => {
  const { rates } = await financeHelper.getDailyExchangeRates()
  exchangeRates.value = financeHelper.applyExchangeRateOverrides(rates)
})

function formatAmountCNY(amountCNY: number): string {
  if (!Number.isFinite(amountCNY))
    return '—'
  const rate = financeCurrency.value === 'CNY' ? 1 : (exchangeRates.value[financeCurrency.value] || 1)
  const formatted = financeHelper.formatFinanceAmount(amountCNY * rate, financeCurrency.value)
  return `${formatted.symbol}${formatted.value}`
}

const billableNodes = computed(() =>
  props.nodes.filter((node) => {
    if (node.hidden)
      return false
    if (isFreeNode(node))
      return false
    return Number(node.price) > 0
  }),
)

const totalValueCNY = computed(() =>
  billableNodes.value.reduce((sum, node) => {
    if (hasNoRenewAfterExpireTag(node.tags) && financeHelper.isNodePastExpiry(node, now.value))
      return sum
    return sum + financeHelper.getPriceCNY(node, exchangeRates.value)
  }, 0),
)

const totalRemainingCNY = computed(() =>
  billableNodes.value.reduce(
    (sum, node) => sum + financeHelper.calculateRemainingValueCNY(node, exchangeRates.value, now.value),
    0,
  ),
)

const projectedYearlyCNY = computed(() =>
  billableNodes.value.reduce(
    (sum, node) => sum + financeHelper.calculateForwardPeriodCostCNY(node, exchangeRates.value, 365, now.value),
    0,
  ),
)

const projectedMonthlyAvgCNY = computed(() => projectedYearlyCNY.value / 12)

const totalEffectiveMonthlyCNY = computed(() =>
  billableNodes.value.reduce(
    (sum, node) => sum + financeHelper.calculateEffectiveMonthlyCostCNY(node, exchangeRates.value, now.value),
    0,
  ),
)

interface RenewalRow {
  node: NodeData
  renewalCNY: number
  expiredAt: Date
  daysLeft: number
}

function buildRenewalRows(monthOffset: 0 | 1): RenewalRow[] {
  const current = now.value
  const rangeStart = monthOffset === 0
    ? current
    : new Date(current.getFullYear(), current.getMonth() + 1, 1)
  const rangeEnd = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0, 23, 59, 59, 999)

  return billableNodes.value
    .filter((node) => {
      if (!financeHelper.shouldCountRenewalPayment(node))
        return false
      if (!node.expired_at)
        return false
      const expiredAt = new Date(node.expired_at)
      if (!Number.isFinite(expiredAt.getTime()))
        return false
      if (monthOffset === 0)
        return expiredAt >= current && expiredAt <= rangeEnd
      return expiredAt >= rangeStart && expiredAt <= rangeEnd
    })
    .map((node) => {
      const expiredAt = new Date(node.expired_at)
      return {
        node,
        renewalCNY: financeHelper.getPriceCNY(node, exchangeRates.value),
        expiredAt,
        daysLeft: Math.max(0, getDaysUntilExpired(node.expired_at)),
      }
    })
    .sort((a, b) => a.expiredAt.getTime() - b.expiredAt.getTime())
}

const thisMonthRenewalRows = computed(() => buildRenewalRows(0))
const nextMonthRenewalRows = computed(() => buildRenewalRows(1))

const thisMonthRenewalCNY = computed(() =>
  thisMonthRenewalRows.value.reduce((sum, row) => sum + row.renewalCNY, 0),
)

const nextMonthRenewalCNY = computed(() =>
  nextMonthRenewalRows.value.reduce((sum, row) => sum + row.renewalCNY, 0),
)

function mapRenewalRows(rows: RenewalRow[]): FinanceNodeTableRow[] {
  return rows.map(row => ({
    key: `renew-${row.node.uuid}`,
    node: row.node,
    expiredAt: row.expiredAt,
    daysLeft: row.daysLeft,
    renewalCNY: row.renewalCNY,
  }))
}

const thisMonthTableRows = computed(() => mapRenewalRows(thisMonthRenewalRows.value))
const nextMonthTableRows = computed(() => mapRenewalRows(nextMonthRenewalRows.value))

const allServerTableRows = computed<FinanceNodeTableRow[]>(() =>
  billableNodes.value.map((node) => {
    const parsed = node.expired_at ? new Date(node.expired_at) : null
    const expiredAt = parsed && Number.isFinite(parsed.getTime()) ? parsed : null
    return {
      key: node.uuid,
      node,
      expiredAt,
      daysLeft: node.expired_at ? Math.max(0, getDaysUntilExpired(node.expired_at)) : 0,
      renewalCNY: financeHelper.getPriceCNY(node, exchangeRates.value),
    }
  }).sort((a, b) => {
    const at = a.expiredAt?.getTime() ?? Number.MAX_SAFE_INTEGER
    const bt = b.expiredAt?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (at !== bt)
      return at - bt
    return a.node.name.localeCompare(b.node.name, 'zh-CN')
  }),
)

const summaryItems = computed(() => [
  { key: 'total', label: '当前总价值', value: formatAmountCNY(totalValueCNY.value) },
  { key: 'remaining', label: '剩余价值', value: formatAmountCNY(totalRemainingCNY.value) },
  { key: 'renewal', label: '本月续费', value: formatAmountCNY(thisMonthRenewalCNY.value) },
  { key: 'yearly', label: '年化支出', value: formatAmountCNY(projectedYearlyCNY.value) },
  { key: 'monthly', label: '月均支出', value: formatAmountCNY(projectedMonthlyAvgCNY.value) },
])

const columnGap = computed(() => appStore.listColumnGap || '12px')

const statusColWidth = computed(() => appStore.listColumnWidths.status || '76px')
const regionColWidth = computed(() => appStore.listColumnWidths.region || '32px')

const financeTableGridStyle = computed(() => ({
  gridTemplateColumns: `${statusColWidth.value} ${regionColWidth.value} minmax(220px, 1fr) 108px 96px minmax(160px, 0.75fr) 108px`,
  gap: columnGap.value,
}))

function formatExpiryDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

function formatRemainingDays(daysLeft: number): string {
  return `剩余${daysLeft}天`
}

function openNode(node: NodeData) {
  router.push({ name: 'instance-detail', params: { id: node.uuid } })
}

const billableNodeCount = computed(() => billableNodes.value.length)
</script>

<template>
  <div class="finance-value-panel flex flex-col gap-4 min-w-0 max-w-full">
    <NCard
      :bordered="!hasBackgroundBlur"
      content-class="finance-toolbar-card"
      :class="cardSurfaceClass"
    >
      <div class="finance-toolbar min-w-0">
        <NText class="text-base font-semibold">
          资产价值
        </NText>
        <NText depth="3" class="text-sm block mt-0.5">
          {{ groupLabel }} {{ billableNodeCount }} 台(不含免费)
        </NText>
      </div>
    </NCard>

    <div class="finance-kpi-grid gap-3 grid grid-cols-2 lg:grid-cols-5 min-w-0 max-w-full">
      <NCard
        v-for="item in summaryItems"
        :key="item.key"
        hoverable
        :bordered="!hasBackgroundBlur"
        :class="cardSurfaceClass"
        content-class="h-full"
      >
        <div class="flex flex-col h-full justify-between" :style="{ fontFamily: appStore.numberFontFamily }">
          <NText depth="3" class="text-xs">
            {{ item.label }}
          </NText>
          <NText class="text-xl font-bold mt-1">
            {{ item.value }}
          </NText>
        </div>
      </NCard>
    </div>

    <FinanceNodeRenewalTable
      title="本月需续费"
      :summary="`${thisMonthTableRows.length} 台 合计 ${formatAmountCNY(thisMonthRenewalCNY)}`"
      :rows="thisMonthTableRows"
      empty-description="本月暂无计划续费"
      :grid-style="financeTableGridStyle"
      :nodes="nodes"
      :format-amount="formatAmountCNY"
      :format-expiry-date="formatExpiryDate"
      :format-remaining-days="formatRemainingDays"
      @open-node="openNode"
    />

    <FinanceNodeRenewalTable
      title="下月需续费"
      :summary="`${nextMonthTableRows.length} 台 合计 ${formatAmountCNY(nextMonthRenewalCNY)}`"
      :rows="nextMonthTableRows"
      empty-description="下月暂无计划续费"
      :grid-style="financeTableGridStyle"
      :nodes="nodes"
      :format-amount="formatAmountCNY"
      :format-expiry-date="formatExpiryDate"
      :format-remaining-days="formatRemainingDays"
      @open-node="openNode"
    />

    <FinanceNodeRenewalTable
      title="全部服务器"
      :summary="`${allServerTableRows.length} 台 剩余 ${formatAmountCNY(totalRemainingCNY)} 月成本 ${formatAmountCNY(totalEffectiveMonthlyCNY)}`"
      :rows="allServerTableRows"
      empty-description="暂无付费节点"
      :grid-style="financeTableGridStyle"
      :nodes="nodes"
      :format-amount="formatAmountCNY"
      :format-expiry-date="formatExpiryDate"
      :format-remaining-days="formatRemainingDays"
      @open-node="openNode"
    />
  </div>
</template>

<style scoped lang="scss">
.light-general-contrast {
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.12);
}
</style>
