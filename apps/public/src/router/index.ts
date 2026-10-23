import { createRouter, createWebHistory } from 'vue-router'

const extraPage = () => import('@/views/HomeView.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/provider-value',
      name: 'provider-value',
      component: extraPage,
      meta: { panel: 'providerValue' },
    },
    {
      path: '/asset-value',
      name: 'asset-value',
      alias: ['/finance-value'],
      component: extraPage,
      meta: { panel: 'financeValue' },
    },
    {
      path: '/network-quality',
      name: 'network-quality',
      component: extraPage,
      meta: { panel: 'networkQuality' },
    },
    {
      path: '/earth-map',
      name: 'earth-map',
      alias: ['/node-map'],
      component: extraPage,
      meta: { panel: 'earthMap' },
    },
    {
      path: '/ip-quality',
      name: 'ip-quality',
      alias: ['/ipquality', '/ipquaility'],
      component: extraPage,
      meta: { panel: 'ipQuality' },
    },
    {
      path: '/instance/:id',
      name: 'instance-detail',
      component: () => import('@/views/InstanceDetail.vue'),
    },
  ],
})

router.beforeEach(() => {
  window.$loadingBar.start()
})

router.afterEach(() => {
  window.$loadingBar.finish()
})

export default router
