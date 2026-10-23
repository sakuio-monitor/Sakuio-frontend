<script setup lang="ts">
import { computed } from 'vue'
import { resolveProviderBrandIconSrc } from '@/utils/providerBrandIcon'

const props = defineProps<{
  icon?: string
}>()

const src = computed(() => resolveProviderBrandIconSrc(props.icon))
</script>

<template>
  <img
    v-if="src"
    :src="src"
    class="provider-brand-icon"
    alt=""
    draggable="false"
    loading="lazy"
    decoding="async"
  >
</template>

<style scoped>
.provider-brand-icon {
  display: block;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  object-fit: contain;
}
</style>
