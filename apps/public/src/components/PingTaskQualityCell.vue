<script setup lang="ts">
import type { NodePingQualityEntry } from '@/composables/useNodesPingQuality'
import { NText } from 'naive-ui'
import { computed } from 'vue'
import PingLatencyBarStrip from '@/components/PingLatencyBarStrip.vue'
import { useAppStore } from '@/stores/app'
import { formatPingAverageLine } from '@/utils/pingSummary'

const props = defineProps<{
  entry: NodePingQualityEntry
  loading?: boolean
}>()

const appStore = useAppStore()

const summaryText = computed(() => {
  if (props.loading)
    return ''
  if (props.entry.error)
    return '—'
  if (props.entry.unassigned)
    return '未加入'
  if (props.entry.sampleCount <= 0)
    return '—'
  return formatPingAverageLine(props.entry)
})

const summaryTitle = computed(() => {
  if (props.entry.unassigned)
    return '该节点未加入此探测任务'
  if (props.entry.sampleCount <= 0)
    return '暂无采样'
  return `窗口内平均：${formatPingAverageLine(props.entry)}`
})
</script>

<template>
  <div class="ping-task-quality-cell">
    <NText
      class="ping-task-quality-cell__summary text-xs tabular-nums"
      depth="3"
      :title="summaryTitle"
      :style="{ fontFamily: appStore.numberFontFamily }"
    >
      {{ summaryText }}
    </NText>
    <PingLatencyBarStrip
      :bars="entry.latencyBars"
      :loading="loading"
    />
  </div>
</template>

<style scoped lang="scss">
.ping-task-quality-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  width: 100%;
  min-height: 28px;
}

.ping-task-quality-cell__summary {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
