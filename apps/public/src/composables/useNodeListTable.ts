import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { DEFAULT_NODE_LIST_ROW_HEIGHT } from '@/constants/nodeListTable'
import { useAppStore } from '@/stores/app'

/** 与 NodeList 一致的列表行高（主题 listRowHeight 优先，否则用统一默认值） */
export function useNodeListTable(tableMinWidth?: MaybeRefOrGetter<string>) {
  const appStore = useAppStore()

  const resolvedRowHeight = computed(() => {
    const configured = appStore.listRowHeight?.trim()
    return configured || DEFAULT_NODE_LIST_ROW_HEIGHT
  })

  const listTableStyle = computed(() => {
    const style: Record<string, string> = {
      '--node-list-row-height': resolvedRowHeight.value,
    }
    const minW = tableMinWidth !== undefined ? toValue(tableMinWidth) : ''
    if (minW)
      style['--node-list-scroll-min-width'] = minW
    return style
  })

  return { listTableStyle, resolvedRowHeight }
}
