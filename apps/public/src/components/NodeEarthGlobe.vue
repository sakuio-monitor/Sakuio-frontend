<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { useAttrs } from 'vue'
import NodeEarthRealisticGlobe from '@/components/NodeEarthRealisticGlobe.vue'

defineProps<{
  nodes?: NodeData[]
  layout?: 'embedded' | 'fullscreen'
}>()

const attrs = useAttrs()
</script>

<template>
  <NodeEarthRealisticGlobe v-bind="attrs" :nodes="nodes" :layout="layout ?? 'embedded'" />
</template>
