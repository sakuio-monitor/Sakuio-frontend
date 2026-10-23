<script setup lang="ts">
</script>

<template>
  <div class="loading-cover" role="status" aria-label="加载中">
    <span class="sakuio-spinner" aria-hidden="true">
      <span class="sakuio-spinner__outer" />
      <span class="sakuio-spinner__inner" />
    </span>
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

.sakuio-spinner {
  position: relative;
  display: inline-block;
  flex: none;
  box-sizing: border-box;
  width: 30px;
  height: 30px;
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
