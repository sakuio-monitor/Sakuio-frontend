import { computed } from 'vue'
import { useAppStore } from '@/stores/app'

/** 与 Provider / Network 等面板一致的 List 毛玻璃、高对比样式 class */
export function useNodeListSurface() {
  const appStore = useAppStore()

  const hasBackgroundBlur = computed(() => appStore.backgroundEnabled && appStore.cardBlurRadius > 0)

  const listBlurClass = computed(() => {
    if (!hasBackgroundBlur.value)
      return ''
    const radius = appStore.cardBlurRadius
    if (radius <= 8)
      return 'glass-8'
    if (radius <= 12)
      return 'glass-12'
    if (radius <= 16)
      return 'glass-16'
    if (radius <= 20)
      return 'glass-20'
    return `glass-${radius}`
  })

  const listSurfaceClass = computed(() => [
    { 'light-list-contrast': appStore.lightCardContrast && !appStore.isDark },
    { 'glass-list-enabled': hasBackgroundBlur.value },
    listBlurClass.value,
  ])

  const cardSurfaceClass = computed(() => [
    { 'glass-card-enabled': hasBackgroundBlur.value },
    listBlurClass.value,
    { 'light-general-contrast': appStore.lightCardContrast && !appStore.isDark },
  ])

  return {
    hasBackgroundBlur,
    listBlurClass,
    listSurfaceClass,
    cardSurfaceClass,
  }
}
