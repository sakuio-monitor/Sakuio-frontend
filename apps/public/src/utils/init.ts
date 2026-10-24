/**
 * 应用初始化模块
 * 负责应用启动时的初始化流程和 WebSocket 连接管理
 */

import type { Client, SakuioRpc, NodeStatus } from '@/utils/rpc'
import { h } from 'vue'
import LoginDialog from '@/components/LoginDialog.vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getSharedApi, RealtimeWebSocket } from '@/utils/api'
import { getSharedRpc, RpcError } from '@/utils/rpc'

/** 初始化配置 */
interface InitConfig {
  /** WebSocket 重连间隔（毫秒） */
  wsReconnectInterval?: number
  /** WebSocket 最大重连次数（失败后回落 POST） */
  wsMaxReconnectAttempts?: number
  /** 后端健康检查超时（毫秒） */
  healthCheckTimeout?: number
  /** POST 模式连续失败次数阈值 */
  postFailureThreshold?: number
}

const DEFAULT_CONFIG: Required<InitConfig> = {
  wsReconnectInterval: 3000,
  wsMaxReconnectAttempts: 5,
  healthCheckTimeout: 5000,
  postFailureThreshold: 3,
}

/** 初始化状态管理 */
class InitManager {
  private config: Required<InitConfig>
  private rpc: SakuioRpc
  private appStore: ReturnType<typeof useAppStore>
  private nodesStore: ReturnType<typeof useNodesStore>
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isPolling = false
  private isInitialized = false
  private loadedAllNodes = false
  private useWebSocket: boolean | null = null // 根据主题配置决定
  private sse: EventSource | null = null
  private realtimeWs: RealtimeWebSocket | null = null
  private postFailureCount = 0
  private visibilityHandler: (() => void) | null = null

  constructor(config: InitConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.rpc = getSharedRpc()
    this.appStore = useAppStore()
    this.nodesStore = useNodesStore()
  }

  /**
   * 获取轮询间隔（毫秒）
   * 从 publicSettings.theme_settings.dataUpdateInterval 读取，默认 3 秒
   */
  private getPollInterval(): number {
    const settings = this.appStore.publicSettings?.theme_settings
    const interval = settings?.dataUpdateInterval
    // 确保值在合理范围内（1-60秒）
    if (typeof interval === 'number' && interval >= 1 && interval <= 60) {
      return interval * 1000 // 转换为毫秒
    }
    return 1000 // 默认 1 秒
  }

  /**
   * 执行初始化流程
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[InitManager] Already initialized')
      return
    }

    try {
      // 1. 测试后端服务是否正常
      await this.healthCheck()

      // 2. 获取服务端公开属性
      await this.fetchPublicSettings()

      // 3. 获取用户信息
      await this.fetchUserInfo()

      // 4. 获取节点信息和最新状态
      await this.fetchNodesData()
      await this.fetchAdminIps()

      // 5. 解除加载状态
      this.appStore.loading = false

      // 6. 建立 WebSocket 连接并开始轮询
      this.startWebSocketAndPolling()

      this.isInitialized = true
    }
    catch (error) {
      console.error('[InitManager] Initialization failed:', error)
      // 即使失败也解除加载状态，显示错误页面
      this.appStore.loading = false
      throw error
    }
  }

  /**
   * 健康检查 - 测试后端服务是否正常
   * 如果返回 401，说明是私有站点，需要强制登录
   */
  private async healthCheck(): Promise<void> {
    try {
      const result = await this.rpc.ping()
      if (result !== 'pong') {
        throw new RpcError(-32000, 'Unexpected health check response')
      }
    }
    catch (error) {
      // 检查是否为 401 错误（私有站点需要登录）
      if (error instanceof RpcError && error.code === 401) {
        console.warn('[InitManager] Private site detected, requiring login')
        this.appStore.requireLogin = true
        this.showForceLoginModal()
        return
      }
      console.error('[InitManager] Health check failed:', error)
      this.appStore.connectionError = true
      throw new Error('Backend service unavailable')
    }
  }

  /**
   * 显示强制登录 Modal
   * 用于私有站点，用户必须登录才能访问
   */
  private showForceLoginModal(): void {
    // 解除加载状态
    this.appStore.loading = false

    window.$modal.create({
      title: '登录',
      preset: 'dialog',
      showIcon: false,
      closeOnEsc: false,
      maskClosable: false,
      closable: false,
      autoFocus: true,
      content: () => h(LoginDialog, {
        forceLogin: true,
        onLoginSuccess: () => {
          // 登录成功后重新初始化
          this.reinitAfterForceLogin()
        },
      }),
    })
  }

  /**
   * 登录成功后刷新用户信息与节点（管理员可获得完整 IP，供 ASN/Org 查询）
   */
  async refreshAfterLogin(): Promise<void> {
    await this.fetchUserInfo()
    await this.fetchNodesData()
    await this.fetchAdminIps()
  }

  /**
   * 强制登录成功后重新初始化
   */
  private async reinitAfterForceLogin(): Promise<void> {
    // 重置登录要求状态
    this.appStore.requireLogin = false

    // 关闭登录 Modal
    window.$modal?.destroyAll()

    try {
      // 重新执行初始化流程
      await this.fetchPublicSettings()
      await this.fetchUserInfo()
      await this.fetchNodesData()
      await this.fetchAdminIps()

      // 解除加载状态
      this.appStore.loading = false

      // 建立 WebSocket 连接并开始轮询
      this.startWebSocketAndPolling()

      this.isInitialized = true
    }
    catch (error) {
      console.error('[InitManager] Re-initialization after login failed:', error)
      this.appStore.connectionError = true
    }
  }

  /**
   * 获取服务端公开属性
   */
  private async fetchPublicSettings(): Promise<void> {
    try {
      const api = getSharedApi()
      const publicSettings = await api.getPublicSettings()
      this.appStore.publicSettings = publicSettings
    }
    catch (error) {
      console.error('[InitManager] Failed to fetch public settings:', error)
      // 非关键错误，继续初始化
    }
  }

  /**
   * 获取用户信息
   */
  private async fetchUserInfo(): Promise<void> {
    try {
      const api = getSharedApi()
      const userInfo = await api.getMe()
      this.appStore.setUserInfo(userInfo)
    }
    catch (error) {
      console.error('[InitManager] Failed to fetch user info:', error)
      // 非关键错误，继续初始化
    }
  }

  /**
   * 获取节点数据和最新状态
   */
  private async fetchNodesData(forceAll = false): Promise<void> {
    try {
      const detailUuid = forceAll ? null : this.detailUuid()
      if (detailUuid) {
        // A direct /instance/<uuid> load only needs that node. The full list
        // is fetched lazily when the user returns to the home page.
        const [client, status] = await Promise.all([
          this.rpc.getNodes(detailUuid) as Promise<Client>,
          this.rpc.getNodesLatestStatus(detailUuid) as Promise<NodeStatus>,
        ])
        this.nodesStore.initNodes(
          { [detailUuid]: client },
          { [detailUuid]: status },
        )
        this.loadedAllNodes = false
        return
      }

      // 并行获取节点信息和最新状态
      const [clientsResult, statusesResult] = await Promise.all([
        this.rpc.getNodes() as Promise<Record<string, Client>>,
        this.rpc.getNodesLatestStatus() as Promise<Record<string, NodeStatus>>,
      ])

      // 初始化节点数据
      this.nodesStore.initNodes(clientsResult, statusesResult)
      this.loadedAllNodes = true
    }
    catch (error) {
      console.error('[InitManager] Failed to fetch nodes data:', error)
      throw error
    }
  }

  /** Returns the UUID when the current route is a single instance page. */
  private detailUuid(): string | null {
    const match = window.location.pathname.match(/^\/instance\/([^/]+)/)
    if (!match?.[1])
      return null
    try {
      return decodeURIComponent(match[1])
    }
    catch {
      return null
    }
  }

  /** Loads the full list only when a detail-first navigation needs it. */
  async ensureFullNodes(): Promise<void> {
    if (this.isInitialized && !this.loadedAllNodes)
      await this.fetchNodesData(true)
  }

  /**
   * The public node API intentionally hides IPs. A logged-in administrator
   * may read the admin client list so IP quality / ASN metadata can work.
   */
  private async fetchAdminIps(): Promise<void> {
    if (!this.appStore.isLoggedIn || this.detailUuid())
      return
    try {
      const overrides: Record<string, { ipv4?: string, ipv6?: string }> = {}
      let cursor: string | undefined
      for (let page = 0; page < 50; page++) {
        const params = new URLSearchParams({ limit: '100' })
        if (cursor)
          params.set('cursor', cursor)
        const response = await fetch(`/api/admin/clients?${params.toString()}`, {
          credentials: 'include',
        })
        if (!response.ok)
          return
        const body = await response.json() as {
          items?: Array<{ uuid: string, ipv4?: string, ipv6?: string }>
          next_cursor?: string | null
        }
        for (const item of body.items ?? []) {
          overrides[item.uuid] = { ipv4: item.ipv4, ipv6: item.ipv6 }
        }
        cursor = body.next_cursor?.trim() || undefined
        if (!cursor)
          break
      }
      this.nodesStore.applyIpOverrides(overrides)
    }
    catch (error) {
      console.warn('[InitManager] Failed to load admin IP metadata:', error)
    }
  }

  /**
   * 启动 WebSocket 连接和轮询
   */
  private startWebSocketAndPolling(): void {
    // 根据主题配置决定初始连接模式
    const configuredMode = this.appStore.rpcTransportMode

    if (configuredMode === 'sse') {
      this.startSse()
      this.bindVisibilityListener()
      return
    }

    this.useWebSocket = configuredMode === 'websocket'

    if (this.useWebSocket) {
      // 尝试建立 WebSocket 连接
      this.connectWebSocket()
      this.startRealtimeWebSocket()
    }
    else {
      // HTTP 模式：直接设置 RPC 客户端为 HTTP 模式
      const client = this.rpc.getClient()
      client.setTransport(false)
      this.nodesStore.updateWsState('disconnected', this.config.wsMaxReconnectAttempts)
    }

    // WebSocket mode is push-based. Polling here caused the ui to keep
    // POSTing to /api/rpc2 even while the WebSocket was healthy.
    if (!this.useWebSocket) {
      this.startPolling()
    }

    // 监听页面可见性变化，切回前台时检查 WebSocket 状态
    this.bindVisibilityListener()
  }

  /**
   * Public SSE transport. It consumes the same v2 snapshot as `/api/clients`
   * and falls back to HTTP polling if the stream cannot be established.
   */
  private startSse(): void {
    this.realtimeWs?.close()
    this.realtimeWs = null
    this.sse?.close()
    this.useWebSocket = false
    this.nodesStore.updateWsState('connecting', 0)
    const source = new EventSource('/api/clients/sse')
    this.sse = source
    let sseErrors = 0

    source.onopen = () => {
      sseErrors = 0
      this.nodesStore.updateWsState('connected', 0)
    }

    source.addEventListener('nodes', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          data?: { online?: string[], data?: Record<string, any> }
        }
        const online = new Set(payload.data?.online ?? [])
        this.nodesStore.applySseSnapshot(online, payload.data?.data ?? {})
        this.nodesStore.updateWsState('connected', 0)
        this.appStore.connectionError = false
        this.stopPolling()
      }
      catch (error) {
        console.warn('[InitManager] Invalid SSE payload:', error)
      }
    })

    source.onerror = () => {
      if (sseErrors < 3 && source.readyState === EventSource.CONNECTING) {
        // EventSource reconnects automatically after transient network errors;
        // do not turn a healthy SSE deployment into permanent HTTP polling.
        sseErrors += 1
        this.nodesStore.updateWsState('reconnecting', sseErrors)
        return
      }
      source.close()
      this.sse = null
      this.nodesStore.updateWsState('disconnected')
      // Only after repeated failures fall back to the HTTP polling path.
      this.rpc.getClient().setTransport(false)
      this.startPolling()
    }
  }

  /**
   * Node-list realtime WebSocket. The JSON-RPC WebSocket is request/response,
   * so it cannot deliver node snapshots by itself.
   */
  private startRealtimeWebSocket(): void {
    this.realtimeWs?.close()
    const ws = new RealtimeWebSocket({
      reconnectInterval: this.config.wsReconnectInterval,
      maxReconnectAttempts: this.config.wsMaxReconnectAttempts,
    })
    this.realtimeWs = ws
    ws.subscribe((payload) => {
      if (payload.status !== 'success')
        return
      const online = new Set(payload.data?.online ?? [])
      this.nodesStore.applySseSnapshot(online, payload.data?.data ?? {})
      this.nodesStore.updateWsState('connected', 0)
      this.appStore.connectionError = false
      this.stopPolling()
    })
    ws.onError(() => this.nodesStore.updateWsState('reconnecting', 1))
    void ws.connect().catch(() => {
      this.nodesStore.updateWsState('disconnected')
      // Only fall back to HTTP if the realtime WS cannot connect.
      this.startPolling()
    })
  }

  /**
   * 建立 WebSocket 连接
   */
  private async connectWebSocket(): Promise<void> {
    // 如果已回落到 POST 模式或配置为 HTTP 模式，不再尝试 WebSocket
    if (this.useWebSocket === false) {
      return
    }

    const client = this.rpc.getClient()

    // 切换到 WebSocket 模式
    client.setTransport(true)
    this.nodesStore.updateWsState('connecting', this.nodesStore.wsReconnectAttempts)

    try {
      // 使用 ping 验证连接，10 秒超时
      await client.ensureWebSocketConnectedWithPing(10000)
      this.nodesStore.updateWsState('connected', 0)

      // 连接成功，重置错误状态
      this.appStore.connectionError = false

      // 监听连接状态变化
      this.monitorWebSocketConnection()
    }
    catch (error) {
      console.error('[InitManager] WebSocket connection failed:', error)
      this.nodesStore.updateWsState('disconnected')
      this.scheduleReconnect()
    }
  }

  /**
   * 绑定页面可见性监听
   */
  private bindVisibilityListener(): void {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
    }
    this.visibilityHandler = () => this.handleVisibilityChange()
    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  /**
   * 处理页面可见性变化
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState !== 'visible') {
      return
    }
    if (this.useWebSocket === false) {
      return
    }

    const state = this.nodesStore.wsConnectionState
    // 正在连接或重连中，不重复触发
    if (state === 'connecting' || state === 'reconnecting') {
      return
    }

    const client = this.rpc.getClient()
    if (client.getWsReadyState() !== WebSocket.OPEN) {
      // 连接未建立或已断开，立即重连
      this.nodesStore.updateWsState('disconnected', 0)
      this.connectWebSocket()
    }
  }

  /**
   * 监控 WebSocket 连接状态
   */
  private monitorWebSocketConnection(): void {
    const client = this.rpc.getClient()
    const ws = client.getWebSocket()

    if (!ws) {
      return
    }

    ws.onclose = () => {
      // 如果当前是已连接状态且还在使用 WebSocket 模式，触发重连
      if (this.useWebSocket === true && this.nodesStore.wsConnectionState === 'connected') {
        this.nodesStore.updateWsState('disconnected')
        this.scheduleReconnect()
      }
    }

    ws.onerror = () => {
      console.error('[InitManager] WebSocket error')
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    const attempts = this.nodesStore.wsReconnectAttempts

    // 达到最大重连次数，回落到 POST 模式
    if (attempts >= this.config.wsMaxReconnectAttempts) {
      console.error('[InitManager] Max reconnect attempts reached, falling back to POST mode')
      this.fallbackToPostMode()
      return
    }

    // 首次失败时显示提示
    if (attempts === 0) {
      window.$message?.error('WebSocket 建立失败，正在尝试重连。')
    }

    this.nodesStore.updateWsState('reconnecting', attempts + 1)

    setTimeout(async () => {
      try {
        const client = this.rpc.getClient()
        client.close()
        await this.connectWebSocket()
      }
      catch (error) {
        console.error('[InitManager] Reconnect failed:', error)
        this.scheduleReconnect()
      }
    }, this.config.wsReconnectInterval)
  }

  /**
   * 回落到 POST 模式
   */
  private fallbackToPostMode(): void {
    this.useWebSocket = false
    this.nodesStore.updateWsState('disconnected', this.config.wsMaxReconnectAttempts)

    // 关闭 WebSocket 连接
    const client = this.rpc.getClient()
    client.setTransport(false)
    client.close()

    // 显示提示
    window.$message?.warning('WebSocket 无法连接，尝试回落 POST 模式。')
    this.startPolling()
  }

  /**
   * 开始轮询
   */
  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
    }

    this.pollTimer = setInterval(() => {
      this.poll()
    }, this.getPollInterval())
  }

  /**
   * 执行轮询任务
   */
  private async poll(): Promise<void> {
    if (this.isPolling) {
      return
    }

    this.isPolling = true

    try {
      // 并行执行三个请求
      const [, clientsResult, statusesResult] = await Promise.all([
        // 1. Ping 测试服务器状态
        this.rpc.ping(),
        // 2. 获取节点信息
        this.rpc.getNodes() as Promise<Record<string, Client>>,
        // 3. 获取节点最新状态
        this.rpc.getNodesLatestStatus() as Promise<Record<string, NodeStatus>>,
      ])

      // 更新节点信息（会智能合并，不会重建数组）
      this.nodesStore.updateNodeClients(clientsResult)

      // 更新节点状态
      this.nodesStore.updateNodeStatuses(statusesResult)

      // 连接恢复正常，重置错误状态
      this.appStore.connectionError = false
    }
    catch (error) {
      if (error instanceof RpcError) {
        console.error('[InitManager] Poll RPC error:', error.message)
      }
      else {
        console.error('[InitManager] Poll error:', error)
      }

      // 一次失败就显示错误
      this.appStore.connectionError = true
    }
    finally {
      this.isPolling = false
    }
  }

  /**
   * 停止轮询
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /**
   * 登录后重新连接 WebSocket
   * 断开现有连接，重置状态，重新建立连接
   */
  async reconnectAfterLogin(): Promise<void> {
    const client = this.rpc.getClient()

    // 关闭现有 WebSocket 连接
    if (client.getWsReadyState() !== WebSocket.CLOSED) {
      client.close()
    }

    // 根据主题配置重置连接模式
    const configuredMode = this.appStore.rpcTransportMode
    this.useWebSocket = configuredMode === 'websocket'
    this.nodesStore.updateWsState('disconnected', 0)

    // 重新获取用户信息并拉取节点（管理员登录后可拿到完整 IP，供 ASN/Org 查询）
    await this.fetchUserInfo()
    await this.fetchNodesData()

    // 重新建立 WebSocket 连接（如果配置为 websocket 模式）
    this.connectWebSocket()
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.realtimeWs?.close()
    this.realtimeWs = null
    this.sse?.close()
    this.sse = null
    this.stopPolling()
    this.rpc.close()
    this.nodesStore.clearNodes()
    this.isInitialized = false

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }
}

// 单例实例
let initManager: InitManager | null = null

/**
 * 初始化应用
 */
export async function initApp(): Promise<void> {
  if (!initManager) {
    initManager = new InitManager()
  }

  await initManager.init()
}

/**
 * 获取初始化管理器实例
 */
export function getInitManager(): InitManager | null {
  return initManager
}

/** 普通登录成功后刷新节点数据（含 IP） */
export async function refreshAfterLogin(): Promise<void> {
  await initManager?.refreshAfterLogin()
}

/**
 * 销毁初始化管理器
 */
export function destroyInitManager(): void {
  if (initManager) {
    initManager.destroy()
    initManager = null
  }
}

/**
 * 登录后重新连接
 * 断开现有 WebSocket 连接并以登录状态重新建立
 */
export async function reconnectAfterLogin(): Promise<void> {
  if (initManager) {
    await initManager.reconnectAfterLogin()
  }
}
