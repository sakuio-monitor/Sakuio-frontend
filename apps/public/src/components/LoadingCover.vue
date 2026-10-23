<script setup lang="ts">
import SakuioSpinner from './SakuioSpinner.vue'
</script>

<template>
  <div class="loading-cover" role="status" aria-label="加载中">
    <SakuioSpinner :size="30" />
    <span class="loading-cover__label">加载中…</span>
  </div>
</template>

<style scoped>
.loading-cover {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  color: var(--color-gray-500, #7b8388);
  background: transparent;
}

.loading-cover__label {
  font-size: 13px;
  letter-spacing: .02em;
}
</style>
