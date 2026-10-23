<script setup lang="ts">
import { NAvatar, NButton, NFlex, NH3, NInput, NPopover } from 'naive-ui'
import { computed, h, inject, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import LoginDialog from './LoginDialog.vue'

const router = useRouter()
const appStore = useAppStore()

// 从 Provider 注入滚动状态
const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = ref('/favicon.ico')
const searchPopoverVisible = ref(false)
const searchInputRef = ref<{ focus: () => void } | null>(null)

const hasActiveSearch = computed(() => appStore.nodeSearchText.trim().length > 0)

async function handleSearchPopoverShow(show: boolean) {
  searchPopoverVisible.value = show
  if (show) {
    await nextTick()
    searchInputRef.value?.focus()
  }
}

function clearNodeSearch() {
  appStore.nodeSearchText = ''
}

// 计算页面容器的样式
const containerStyle = computed(() => {
  if (appStore.fullWidth) {
    return {}
  }
  return {
    maxWidth: appStore.maxPageWidth,
    marginInline: 'auto',
  }
})

const searchButtonMeta = computed(() => ({
  title: hasActiveSearch.value ? '搜索中（点击修改）' : '搜索节点',
  icon: 'i-lucide-search',
  active: hasActiveSearch.value,
}))

function toggleSearchPopover() {
  searchPopoverVisible.value = !searchPopoverVisible.value
  if (searchPopoverVisible.value) {
    void handleSearchPopoverShow(true)
  }
}

const actionButtons = computed(() => {
  const buttons = [
    {
      title: appStore.themeMode === 'auto' ? '自动主题' : appStore.themeMode === 'light' ? '浅色主题' : '深色主题',
      icon: appStore.themeMode === 'auto' ? 'i-lucide-monitor' : appStore.themeMode === 'light' ? 'i-lucide-sun' : 'i-lucide-moon',
      action: 'toggleTheme',
      disabled: false,
      active: false,
    },
  ]

  // 已登录时显示设置按钮，未登录时根据配置决定是否显示登录按钮
  if (appStore.isLoggedIn) {
    buttons.push({
      title: '后台管理',
      icon: 'i-lucide-settings',
      action: 'jumpToSetting',
      disabled: false,
      active: false,
    })
  }
  else if (appStore.showLoginButton) {
    buttons.push({
      title: '登录',
      icon: 'i-lucide-log-in',
      action: 'openLoginDialog',
      disabled: false,
      active: false,
    })
  }

  return buttons
})

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      break
    case 'jumpToSetting':
      // 设置页由 Server 提供，不能使用无极路由
      location.href = '/admin'
      break
    case 'openLoginDialog':
      window.$modal.create({
        title: '登录',
        preset: 'dialog',
        showIcon: false,
        content: () => h(LoginDialog),
      })
      break
  }
}
</script>

<template>
  <div class="transition-all duration-200 top-0 position-sticky z-10" :class="isScrolled ? 'bg-$n-color shadow-sm backdrop-blur-md' : 'bg-transparent'">
    <div class="px-4 flex-between h-16" :style="containerStyle">
      <NFlex class="flex-center cursor-pointer" @click="router.push('/')">
        <NAvatar :src="siteFavicon" round />
        <NH3 class="m-0">
          {{ appStore.publicSettings?.sitename || 'Sakuio Monitor' }}
        </NH3>
      </NFlex>
      <NFlex class="flex gap-4 items-center">
        <NPopover
          :show="searchPopoverVisible"
          trigger="manual"
          placement="bottom-end"
          :show-arrow="false"
          @update:show="handleSearchPopoverShow"
        >
          <template #trigger>
            <NPopover>
              <template #trigger>
                <NButton
                  class="p-2 h-8 w-8"
                  text
                  :type="searchButtonMeta.active ? 'primary' : 'default'"
                  @click="toggleSearchPopover"
                >
                  <div :class="searchButtonMeta.icon" />
                </NButton>
              </template>
              <template #default>
                {{ searchButtonMeta.title }}
              </template>
            </NPopover>
          </template>
          <template #default>
            <div class="header-search-popover w-72 flex flex-col gap-2">
              <NInput
                ref="searchInputRef"
                v-model:value="appStore.nodeSearchText"
                placeholder="搜索节点名称、地区、系统"
                clearable
                @keydown.esc="searchPopoverVisible = false"
                @clear="clearNodeSearch"
              >
                <template #prefix>
                  <div class="i-lucide-search" />
                </template>
              </NInput>
            </div>
          </template>
        </NPopover>
        <NPopover v-for="button in actionButtons" :key="button.action" :disabled="button.disabled">
          <template #trigger>
            <NButton
              :disabled="button.disabled"
              class="p-2 h-8 w-8"
              text
              :type="button.active ? 'primary' : 'default'"
              @click="handleButtonClick(button.action)"
            >
              <div :class="button.icon" />
            </NButton>
          </template>
          <template #default>
            {{ button.title }}
          </template>
        </NPopover>
      </NFlex>
    </div>
  </div>
</template>
