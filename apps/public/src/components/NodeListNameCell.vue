<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { NodeDisplayTag } from '@/composables/useNodeListDisplayTags'
import { NBadge, NTag, NText, NTooltip } from 'naive-ui'
import { computed } from 'vue'
import ProviderBrandIcon from '@/components/ProviderBrandIcons.vue'
import { useNodeListDisplayTags } from '@/composables/useNodeListDisplayTags'
import { useAppStore } from '@/stores/app'

const props = withDefaults(defineProps<{
  node: NodeData
  nodes: NodeData[]
  /** 与列表节点列一致（含剩余天数标签） */
  sublineMode?: 'list' | 'renewal'
}>(), {
  sublineMode: 'list',
})

const appStore = useAppStore()

const { getNodeNameSublineTags, getNodeNameSublineTagsForRenewal } = useNodeListDisplayTags(() => props.nodes)

const sublineTags = computed<NodeDisplayTag[]>(() => {
  if (props.sublineMode === 'renewal')
    return getNodeNameSublineTagsForRenewal(props.node)
  return getNodeNameSublineTags(props.node)
})
</script>

<template>
  <div class="node-list-item__name min-w-0">
    <NText class="node-list-item__name-text text-sm font-semibold">
      {{ node.name }}
    </NText>
    <div
      v-if="sublineTags.length > 0"
      class="node-list-item__name-tags compact-node-tags node-network-tags"
    >
      <template v-if="appStore.listTagsStyle === 'tag'">
        <div
          v-for="tag in sublineTags"
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
          v-for="tag in sublineTags"
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
</template>
