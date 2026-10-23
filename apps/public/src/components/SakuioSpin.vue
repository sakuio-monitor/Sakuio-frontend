<script setup lang="ts">
import SakuioSpinner from './SakuioSpinner.vue'

withDefaults(defineProps<{ show?: boolean; size?: number }>(), {
  show: false,
  size: 30,
})
</script>

<template>
  <div class="sakuio-spin">
    <slot />
    <div v-if="show" class="sakuio-spin__overlay">
      <SakuioSpinner :size="size" />
    </div>
  </div>
</template>

<style scoped>
.sakuio-spin {
  position: relative;
  min-width: 0;
}

.sakuio-spin__overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: color-mix(in srgb, var(--ambient-base, #eef1f4) 35%, transparent);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
</style>
