import type { Client, NodeStatus } from '@/utils/rpc'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { parseNodeGroups } from '@/utils/groupHelper'

/** 流量限制类型 */
export type TrafficLimitType = 'up' | 'down' | 'min' | 'max' | 'sum'

/** 节点完整信息（合并 Client 和 Status） */
export interface NodeData {
  uuid: string
  // Client 信息
  name: string
  cpu_name: string
  virtualization: string
  arch: string
  cpu_cores: number
  os: string
  kernel_version: string
  gpu_name?: string
  ipv4?: string
  ipv6?: string
  region: string
  remark?: string
  public_remark: string
  mem_total: number
  swap_total: number
  disk_total: number
  version?: string
  weight: number
  price: number
  billing_cycle: number
  auto_renewal: boolean
  currency: string
  expired_at: string
  group: string
  tags: string
  hidden: boolean
  traffic_limit: number
  traffic_limit_type: TrafficLimitType
  created_at: string
  updated_at: string
  // Status 信息
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
}

/** WebSocket 连接状态 */
export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/** 状态数据（用于更新） */
interface StatusData {
  online: boolean
  time: string
  cpu: number
  gpu: number
  ram: number
  swap: number
  load: number
  load5: number
  load15: number
  temp: number
  disk: number
  net_in: number
  net_out: number
  net_total_up: number
  net_total_down: number
  process: number
  connections: number
  connections_udp: number
  uptime: number
}

const useNodesStore = defineStore('nodes', () => {
  // ===== 状态 =====
  const nodes = ref<NodeData[]>([])
  const wsConnectionState = ref<WsConnectionState>('disconnected')
  const wsReconnectAttempts = ref<number>(0)

  // ===== 计算属性 =====
  /** 在线节点数量 */
  const onlineCount = computed(() => nodes.value.filter(n => n.online).length)

  /** 总节点数量 */
  const totalCount = computed(() => nodes.value.length)

  /** 所有分组（节点 group 字段支持用 ; 分隔多个分类） */
  const groups = computed(() => {
    const groupSet = new Set<string>()
    nodes.value.forEach((n) => {
      for (const g of parseNodeGroups(n.group)) {
        groupSet.add(g)
      }
    })
    return Array.from(groupSet).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  /** 按 UUID 索引的节点映射 */
  const nodesByUuid = computed(() => {
    const map = new Map<string, NodeData>()
    nodes.value.forEach((n) => {
      map.set(n.uuid, n)
    })
    return map
  })

  // ===== 方法 =====

  /**
   * 从 Client 对象创建节点数据
   */
  function createNodeFromClient(client: Client): NodeData {
    return {
      uuid: client.uuid,
      name: client.name,
      cpu_name: client.cpu_name,
      virtualization: client.virtualization,
      arch: client.arch,
      cpu_cores: client.cpu_cores,
      os: client.os,
      kernel_version: client.kernel_version,
      gpu_name: client.gpu_name,
      ipv4: client.ipv4,
      ipv6: client.ipv6,
      region: client.region,
      remark: client.remark,
      public_remark: client.public_remark,
      mem_total: client.mem_total,
      swap_total: client.swap_total,
      disk_total: client.disk_total,
      version: client.version,
      weight: client.weight,
      price: client.price,
      billing_cycle: client.billing_cycle,
      auto_renewal: client.auto_renewal,
      currency: client.currency,
      expired_at: client.expired_at,
      group: client.group,
      tags: client.tags,
      hidden: client.hidden,
      traffic_limit: client.traffic_limit,
      traffic_limit_type: client.traffic_limit_type as TrafficLimitType,
      created_at: client.created_at,
      updated_at: client.updated_at,
      // Status 默认值
      online: false,
      time: '',
      cpu: 0,
      gpu: 0,
      ram: 0,
      swap: 0,
      load: 0,
      load5: 0,
      load15: 0,
      temp: 0,
      disk: 0,
      net_in: 0,
      net_out: 0,
      net_total_up: 0,
      net_total_down: 0,
      process: 0,
      connections: 0,
      connections_udp: 0,
      uptime: 0,
    }
  }

  /**
   * 更新节点的状态数据
   */
  function updateNodeStatus(node: NodeData, status: StatusData): NodeData {
    return {
      ...node,
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
    }
  }

  function assignStatusInPlace(node: NodeData, status: StatusData): void {
    const next = updateNodeStatus(node, status)
    for (const key of Object.keys(next) as Array<keyof NodeData>) {
      if (node[key] !== next[key])
        (node as Record<string, unknown>)[key] = next[key]
    }
  }

  /**
   * 从 NodeStatus 提取状态数据
   */
  function extractStatusData(status: NodeStatus): StatusData {
    return {
      online: status.online,
      time: status.time,
      cpu: status.cpu,
      gpu: status.gpu,
      ram: status.ram,
      swap: status.swap,
      load: status.load,
      load5: status.load5,
      load15: status.load15,
      temp: status.temp,
      disk: status.disk,
      net_in: status.net_in,
      net_out: status.net_out,
      net_total_up: status.net_total_up,
      net_total_down: status.net_total_down,
      process: status.process,
      connections: status.connections,
      connections_udp: status.connections_udp,
      uptime: status.uptime,
    }
  }

  /**
   * 初始化节点数据（首次加载）
   */
  function initNodes(clients: Record<string, Client>, statuses: Record<string, NodeStatus>): void {
    const uuids = Object.keys(clients)
    const existingUuids = new Set(nodes.value.map(n => n.uuid))

    // 更新现有节点或添加新节点
    uuids.forEach((uuid) => {
      const client = clients[uuid]
      if (!client)
        return

      const status = statuses[uuid]
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (existingUuids.has(uuid) && index !== -1) {
        // 更新现有节点
        const baseNode = createNodeFromClient(client)
        nodes.value[index] = status
          ? updateNodeStatus(baseNode, extractStatusData(status))
          : baseNode
      }
      else {
        // 添加新节点
        const newNode = createNodeFromClient(client)
        nodes.value.push(status
          ? updateNodeStatus(newNode, extractStatusData(status))
          : newNode,
        )
      }
    })

    // 移除不存在的节点
    const newUuids = new Set(uuids)
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // 按 weight 降序排序（weight 越大越靠前）
    sortNodesByWeight()
  }

  /**
   * 按 weight 升序排序节点（weight 越小越靠前）
   */
  function sortNodesByWeight(): void {
    nodes.value.sort((a, b) => a.weight - b.weight)
  }

  /**
   * 更新节点状态（实时更新）
   */
  function updateNodeStatuses(statuses: Record<string, NodeStatus>): void {
    Object.entries(statuses).forEach(([uuid, status]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)
      if (index === -1)
        return

      const node = nodes.value[index]
      if (!node)
        return

      assignStatusInPlace(node, extractStatusData(status))
    })
  }

  /**
   * Apply the public SSE snapshot (same v2 payload as `/api/clients`).
   * Missing nodes are marked offline without wiping their last metrics.
   */
  function applySseSnapshot(online: Set<string>, data: Record<string, any>): void {
    // Mutate the existing array in place. Replacing the whole array makes the
    // entire keyed v-for tree re-render even when only one node changed.
    for (let i = 0; i < nodes.value.length; i++) {
      const node = nodes.value[i]
      if (!node)
        continue
      const isOnline = online.has(node.uuid)
      const raw = data[node.uuid]
      if (!raw) {
        if (node.online !== isOnline)
          node.online = isOnline
        continue
      }
      assignStatusInPlace(node, {
        client: node.uuid,
        time: String(raw.updated_at ?? ''),
        cpu: Number(raw.cpu?.usage ?? 0),
        gpu: Number(raw.gpu ?? 0),
        ram: Number(raw.ram?.used ?? 0),
        ram_total: Number(raw.ram?.total ?? 0),
        swap: Number(raw.swap?.used ?? 0),
        swap_total: Number(raw.swap?.total ?? 0),
        load: Number(raw.load?.load1 ?? 0),
        load5: Number(raw.load?.load5 ?? 0),
        load15: Number(raw.load?.load15 ?? 0),
        temp: 0,
        disk: Number(raw.disk?.used ?? 0),
        disk_total: Number(raw.disk?.total ?? 0),
        net_in: Number(raw.network?.down ?? 0),
        net_out: Number(raw.network?.up ?? 0),
        net_total_up: Number(raw.network?.totalUp ?? 0),
        net_total_down: Number(raw.network?.totalDown ?? 0),
        process: Number(raw.process ?? 0),
        connections: Number(raw.connections?.tcp ?? 0) + Number(raw.connections?.udp ?? 0),
        connections_udp: Number(raw.connections?.udp ?? 0),
        online: isOnline,
        uptime: Number(raw.uptime ?? 0),
      })
    }
  }

  /**
   * 更新节点基本信息
   */
  function updateNodeClients(clients: Record<string, Client>): void {
    const newUuids = new Set(Object.keys(clients))

    // 更新现有节点信息或添加新节点
    Object.entries(clients).forEach(([uuid, client]) => {
      const index = nodes.value.findIndex(n => n.uuid === uuid)

      if (index !== -1) {
        // 更新现有节点，保留状态信息
        const currentNode = nodes.value[index]
        if (!currentNode)
          return

        const baseNode = createNodeFromClient(client)
        // The public API may hide IPs for guests; keep the authenticated IP
        // override when the periodic public client payload omits it.
        baseNode.ipv4 = client.ipv4 || currentNode.ipv4
        baseNode.ipv6 = client.ipv6 || currentNode.ipv6
        nodes.value[index] = updateNodeStatus(baseNode, {
          online: currentNode.online,
          time: currentNode.time,
          cpu: currentNode.cpu,
          gpu: currentNode.gpu,
          ram: currentNode.ram,
          swap: currentNode.swap,
          load: currentNode.load,
          load5: currentNode.load5,
          load15: currentNode.load15,
          temp: currentNode.temp,
          disk: currentNode.disk,
          net_in: currentNode.net_in,
          net_out: currentNode.net_out,
          net_total_up: currentNode.net_total_up,
          net_total_down: currentNode.net_total_down,
          process: currentNode.process,
          connections: currentNode.connections,
          connections_udp: currentNode.connections_udp,
          uptime: currentNode.uptime,
        })
      }
      else {
        // 添加新节点（不带状态）
        nodes.value.push(createNodeFromClient(client))
      }
    })

    // 移除不存在的节点
    for (let i = nodes.value.length - 1; i >= 0; i--) {
      const node = nodes.value[i]
      if (node && !newUuids.has(node.uuid)) {
        nodes.value.splice(i, 1)
      }
    }

    // 按 weight 降序排序
    sortNodesByWeight()
  }

  /**
   * 更新 WebSocket 连接状态
   */
  function updateWsState(state: WsConnectionState, attempts?: number): void {
    wsConnectionState.value = state
    if (attempts !== undefined) {
      wsReconnectAttempts.value = attempts
    }
  }

  function applyIpOverrides(overrides: Record<string, { ipv4?: string, ipv6?: string }>): void {
    nodes.value = nodes.value.map((node) => {
      const value = overrides[node.uuid]
      return value
        ? { ...node, ipv4: value.ipv4 || node.ipv4, ipv6: value.ipv6 || node.ipv6 }
        : node
    })
  }

  /**
   * 清空所有节点数据
   */
  function clearNodes(): void {
    nodes.value = []
  }

  return {
    // 状态
    nodes,
    wsConnectionState,
    wsReconnectAttempts,
    // 计算属性
    onlineCount,
    totalCount,
    groups,
    nodesByUuid,
    // 方法
    initNodes,
    updateNodeStatuses,
    updateNodeClients,
    applySseSnapshot,
    applyIpOverrides,
    sortNodesByWeight,
    updateWsState,
    clearNodes,
  }
})

export { useNodesStore }
