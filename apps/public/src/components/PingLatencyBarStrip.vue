<script setup lang="ts">
import type { PingLatencyBar } from '@/utils/pingHistoryBars'
import { NTooltip } from 'naive-ui'
import { computed } from 'vue'
import { createEmptyPingLatencyBars, PING_HISTORY_BAR_COUNT } from '@/utils/pingHistoryBars'

const props = withDefaults(defineProps<{
  bars?: readonly PingLatencyBar[]
  loading?: boolean
}>(), {
  bars: () => [],
  loading: false,
})

const displayBars = computed(() => {
  if (props.loading)
    return createEmptyPingLatencyBars()
  if (props.bars.length > 0)
    return props.bars
  return createEmptyPingLatencyBars()
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${displayBars.value.length || PING_HISTORY_BAR_COUNT}, minmax(0, 1fr))`,
}))
</script>

<template>
  <div
    class="ping-latency-bar-strip"
    :style="gridStyle"
  >
    <NTooltip
      v-for="bar in displayBars"
      :key="bar.key"
      placement="top"
      :disabled="!bar.tooltip"
    >
      <template #trigger>
        <span class="ping-latency-bar-strip__cell">
          <span class="ping-latency-bar-strip__fill" :class="bar.className" />
        </span>
      </template>
      <span class="ping-latency-bar-strip__tooltip">{{ bar.tooltip }}</span>
    </NTooltip>
  </div>
</template>

<style scoped lang="scss">
.ping-latency-bar-strip {
  display: grid;
  align-items: end;
  gap: 1px;
  width: 100%;
  min-width: 72px;
  height: 10px;
  transition: height 0.15s ease;

  &:hover {
    height: 14px;
  }

  &__cell {
    display: block;
    height: 100%;
    min-width: 0;
    cursor: default;
  }

  &__fill {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 1px;
  }

  &__tooltip {
    white-space: pre-line;
    font-size: 12px;
    line-height: 1.45;
  }
}

:deep(.ping-bar--empty) {
  background: rgba(128, 128, 128, 0.22);
}

:deep(.ping-bar--loss) {
  background: rgba(229, 77, 46, 0.75);
}

:deep(.ping-bar--l1) {
  background: #30a46c;
}

:deep(.ping-bar--l2) {
  background: #12a594;
}

:deep(.ping-bar--l3) {
  background: #f5a623;
}

:deep(.ping-bar--l4) {
  background: #f97316;
}

:deep(.ping-bar--l5) {
  background: #e54d2e;
}

html.dark {
  .ping-latency-bar-strip :deep(.ping-bar--empty) {
    background: rgba(255, 255, 255, 0.14);
  }
}
</style>
