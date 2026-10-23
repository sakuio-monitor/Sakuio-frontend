<script setup lang="ts">
withDefaults(defineProps<{ size?: number; label?: string }>(), {
  size: 20,
  label: '',
})
</script>

<template>
  <span class="sakuio-spinner" :style="{ width: `${size}px`, height: `${size}px` }" role="status" :aria-label="label || '加载中'">
    <span class="sakuio-spinner__outer" />
    <span class="sakuio-spinner__inner" />
  </span>
</template>

<style scoped>
.sakuio-spinner {
  position: relative;
  display: inline-block;
  flex: none;
  box-sizing: border-box;
  color: var(--primary-color, #18a058);
}

.sakuio-spinner__outer,
.sakuio-spinner__inner {
  position: absolute;
  box-sizing: border-box;
  border-radius: 50%;
  border: 2px solid transparent;
}

.sakuio-spinner__outer {
  inset: 0;
  border-top-color: currentColor;
  border-right-color: currentColor;
  animation: sakuio-spinner-rotate .9s linear infinite;
}

.sakuio-spinner__inner {
  inset: 28%;
  border-bottom-color: currentColor;
  border-left-color: currentColor;
  animation: sakuio-spinner-rotate-reverse .65s linear infinite;
}

@keyframes sakuio-spinner-rotate {
  to { transform: rotate(360deg); }
}

@keyframes sakuio-spinner-rotate-reverse {
  to { transform: rotate(-360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sakuio-spinner__outer,
  .sakuio-spinner__inner { animation-duration: 2.4s; }
}
</style>
