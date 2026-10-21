import type { Column } from "../components/DataTable/DataTable";
import { columnWeightFromListSettings, parseCssLengthToPx } from "./listColumnTrack";

const ENTITY_LIST_COL_ID = 80;
const ENTITY_LIST_COL_STATUS = 68;
const ENTITY_LIST_COL_REGION = 56;
const ENTITY_LIST_COL_IP = 93;

export type EntityListLayoutId =
  | 'nodes'
  | 'clients'
  | 'agent_servers'
  | 'users'
  | 'tunnels'
  | 'plans'
  | 'certificates'

export const ENTITY_LIST_PAGE_MAX_WIDTH = '1800px'
export const ENTITY_LIST_COLUMN_GAP = '12px'
export const ENTITY_LIST_BORDER_RADIUS = '8px'

/** 不设固定像素宽，由 table-layout:fixed 吃满剩余空间（按列表页） */
export function entityListGrowColumnKeys(listId: EntityListLayoutId): Set<string> {
  switch (listId) {
    case 'users':
      return new Set(['email'])
    case 'nodes':
    case 'clients':
      return new Set(['name'])
    case 'agent_servers':
      return new Set([])
    case 'tunnels':
      return new Set([])
    case 'plans':
      return new Set(['name'])
    case 'certificates':
      return new Set(['domains'])
  }
}

/** 前 4 列：ID / 状态 / 地区 / IP，宽度永不参与比例伸缩 */
export const ENTITY_LIST_LOCKED_COLUMN_PX: Record<string, number> = {
  id: ENTITY_LIST_COL_ID,
  online: ENTITY_LIST_COL_STATUS,
  region: ENTITY_LIST_COL_REGION,
  public_host: ENTITY_LIST_COL_IP,
  public_ip: ENTITY_LIST_COL_IP,
  status: 76,
}

export function isEntityListLockedColumn(key: string): boolean {
  return key in ENTITY_LIST_LOCKED_COLUMN_PX
}

function lockedColumnPxForList(
  listId: EntityListLayoutId,
  col: Pick<Column<unknown>, "key" | "width">,
): number | undefined {
  if (listId === "agent_servers") return undefined
  return ENTITY_LIST_LOCKED_COLUMN_PX[col.key]
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function distributeAgentServerColumnLayout(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  tableWidthPx: number,
): EntityListColumnLayout {
  const pageMax = entityListPageMaxWidthPx()
  const width = clamp(tableWidthPx, 280, pageMax)

  const specs = columns.map((col) => {
    const spec = AGENT_SERVER_COLUMN_SPEC[col.key] ?? { min: 72, max: 120, weight: 1 }
    return { key: col.key, ...spec }
  })

  const minPxByKey: Record<string, number> = {}
  const maxPxByKey: Record<string, number> = {}
  for (const s of specs) {
    minPxByKey[s.key] = s.min
    if (s.max != null) maxPxByKey[s.key] = s.max
  }

  const totalMin = specs.reduce((sum, s) => sum + s.min, 0)
  const widthPxByKey: Record<string, number> = {}

  // 宽度不足：全部按最小宽（操作列完整显示），表格在滚动容器内横向滑动
  if (width <= totalMin) {
    for (const s of specs) {
      widthPxByKey[s.key] = s.min
    }
    return { widthPxByKey, minPxByKey, maxPxByKey }
  }

  for (const s of specs) {
    widthPxByKey[s.key] = s.min
  }

  const extra = width - totalMin
  const weighted = specs.filter((s) => s.weight > 0)
  const weightSum = weighted.reduce((sum, s) => sum + s.weight, 0) || 1

  for (const s of weighted) {
    const add = Math.floor((extra * s.weight) / weightSum)
    const cap = s.max ?? s.min + add
    widthPxByKey[s.key] = clamp(s.min + add, s.min, cap)
  }

  const actions = specs.find((s) => s.key === 'actions')
  if (actions?.max != null) {
    widthPxByKey.actions = clamp(
      widthPxByKey.actions,
      actions.min,
      actions.max,
    )
  }

  // 剩余空间只分给内容列（按权重、不限 max），操作列保持固定不被拉伸
  let slack = width - specs.reduce((sum, s) => sum + widthPxByKey[s.key], 0)
  const growers = specs.filter((s) => s.key !== 'actions' && s.weight > 0)
  if (slack > 0 && growers.length > 0) {
    const growSum = growers.reduce((sum, s) => sum + s.weight, 0)
    for (const s of growers) {
      widthPxByKey[s.key] += Math.floor((slack * s.weight) / growSum)
    }
    const remain = width - specs.reduce((sum, s) => sum + widthPxByKey[s.key], 0)
    if (remain > 0) {
      widthPxByKey[growers[0]!.key] += remain
    }
  }

  return { widthPxByKey, minPxByKey, maxPxByKey }
}

export function distributeEntityListColumnLayout(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  listId: EntityListLayoutId,
  tableWidthPx?: number,
): EntityListColumnLayout {
  const pageMax = entityListPageMaxWidthPx()
  const measured = tableWidthPx != null && tableWidthPx > 0 ? tableWidthPx : pageMax

  if (listId === 'agent_servers') {
    return distributeAgentServerColumnLayout(columns, measured)
  }

  const widthPxByKey = distributeEntityListColumns(columns, listId, tableWidthPx)
  return { widthPxByKey, minPxByKey: {}, maxPxByKey: {} }
}

const COLUMN_WIDTHS_NODES: Record<string, string> = {
  id: '80px',
  online: '68px',
  region: '56px',
  public_host: '93px',
  name: 'minmax(160px, 1.2fr)',
  cpu: '116px',
  memory: '116px',
  bandwidth: '140px',
  tunnel_count: '72px',
  connections: '72px',
  last_seen_at: '156px',
}

const COLUMN_WIDTHS_USERS: Record<string, string> = {
  id: '80px',
  email: 'minmax(200px, 1fr)',
  status: '76px',
  role: '96px',
  subscription: '128px',
  traffic_used: '128px',
  traffic_total: '96px',
  expires_at: '168px',
  balance: '88px',
  created_at: '168px',
  actions: '168px',
}

const COLUMN_WIDTHS_TUNNELS: Record<string, string> = {
  id: '80px',
  user_id: '96px',
  client_id: '96px',
  status: '88px',
  carrier: '72px',
  remote_port: '150px',
  target: 'minmax(120px, 0.5fr)',
  traffic_speed: '140px',
  traffic_total: '100px',
  actions: '168px',
}

const COLUMN_WIDTHS_CERTIFICATES: Record<string, string> = {
  id: '80px',
  owner: '220px',
  domains: 'minmax(180px, 1fr)',
  issuer: '200px',
  not_after: '120px',
  source: '100px',
  actions: '168px',
}

const COLUMN_WIDTHS_PLANS: Record<string, string> = {
  name: 'minmax(120px, 0.5fr)',
  node_groups: '140px',
  traffic_quota: '120px',
  traffic_period: '140px',
  speed_limit_mbps: '88px',
  max_tunnels: '72px',
  enabled: '72px',
  actions: '168px',
}

/** 服务器列表：每列 min/max，表格随容器 100% 伸缩 */
const COLUMN_WIDTHS_AGENT_SERVERS: Record<string, string> = {
  name: 'minmax(120px, 220px)',
  public_ip: 'minmax(128px, 220px)',
  agent_version: 'minmax(72px, 112px)',
  group_name: 'minmax(72px, 150px)',
  private_remark: 'minmax(72px, 150px)',
  billing: 'minmax(96px, 160px)',
  actions: 'minmax(168px, 224px)',
}

/** 操作列：3×24px 按钮 + 2×8px 间距 + 单元格 padding（左 6px + 末列右 16px） */
export const AGENT_SERVER_ACTIONS_MIN_PX = 112
export const AGENT_SERVER_ACTIONS_MAX_PX = 160

/** entity-list 布局前置列：拖动把手 / 行选择复选框（固定宽，参与列宽预算） */
export const ENTITY_LIST_DRAG_HANDLE_PX = 36
export const ENTITY_LIST_SELECT_PX = 40

type AgentServerColSpec = { min: number; max: number | null; weight: number }

const AGENT_SERVER_COLUMN_SPEC: Record<string, AgentServerColSpec> = {
  name: { min: 120, max: 220, weight: 1.2 },
  public_ip: { min: 128, max: 220, weight: 2 },
  agent_version: { min: 72, max: 112, weight: 0.8 },
  group_name: { min: 72, max: 150, weight: 1.3 },
  private_remark: { min: 72, max: 150, weight: 1.5 },
  billing: { min: 96, max: 160, weight: 1.1 },
  actions: { min: AGENT_SERVER_ACTIONS_MIN_PX, max: AGENT_SERVER_ACTIONS_MAX_PX, weight: 0 },
}

export function entityListUsesFluidTableWidth(listId: EntityListLayoutId): boolean {
  return listId === 'agent_servers'
}

export function isEntityListLockedColumnForList(listId: EntityListLayoutId, key: string): boolean {
  if (listId === 'agent_servers') return false
  return isEntityListLockedColumn(key)
}

export type EntityListColumnLayout = {
  widthPxByKey: Record<string, number>
  minPxByKey: Record<string, number>
  maxPxByKey: Record<string, number>
}

const COLUMN_WIDTHS_CLIENTS: Record<string, string> = {
  id: '80px',
  online: '68px',
  region: '56px',
  public_ip: '93px',
  name: 'minmax(88px, 0.6fr)',
  user_email: 'minmax(160px, 1fr)',
  system: '200px',
  traffic_in: '100px',
  traffic_out: '100px',
  traffic_speed: '140px',
  tunnel_count: '72px',
  last_seen_at: '168px',
}

const NAME_COLUMN_MIN_PX = 88

function entityListGrowMinPx(listId: EntityListLayoutId, columnKey: string): number {
  if (listId === 'users' && columnKey === 'email') return 200
  if (listId === 'certificates' && columnKey === 'domains') return 180
  if (listId === 'nodes' && columnKey === 'name') return 160
  if (listId === 'agent_servers' && columnKey === 'name') return 160
  return NAME_COLUMN_MIN_PX
}

/** 三枚文字按钮 + gap，仅用于 table-layout:fixed 分栏（避免列宽 1% 把内容挤出卡片） */
export const ENTITY_LIST_ACTIONS_COLUMN_PX = 168

export function entityListActionsColumnPx(listId: EntityListLayoutId): number {
  if (listId === 'agent_servers') return AGENT_SERVER_ACTIONS_MIN_PX
  return ENTITY_LIST_ACTIONS_COLUMN_PX
}

export function isEntityListActionsColumn(key: string): boolean {
  return key === 'actions' || key === 'action'
}

export function columnWidthsForEntityList(listId: EntityListLayoutId): Record<string, string> {
  if (listId === 'nodes') return COLUMN_WIDTHS_NODES
  if (listId === 'agent_servers') return COLUMN_WIDTHS_AGENT_SERVERS
  if (listId === 'users') return COLUMN_WIDTHS_USERS
  if (listId === 'tunnels') return COLUMN_WIDTHS_TUNNELS
  if (listId === 'plans') return COLUMN_WIDTHS_PLANS
  if (listId === 'certificates') return COLUMN_WIDTHS_CERTIFICATES
  return COLUMN_WIDTHS_CLIENTS
}

export function entityListPageMaxWidthPx(): number {
  return parseCssLengthToPx(ENTITY_LIST_PAGE_MAX_WIDTH) || 1800
}

/** 各列最小宽度之和：窄屏时表格不低于此宽度，在容器内横向滑动 */
export function entityListMinTableWidth(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  listId: EntityListLayoutId,
): number {
  if (entityListUsesFluidTableWidth(listId)) {
    let sum = 0
    for (const col of columns) {
      if (isEntityListActionsColumn(col.key)) {
        sum += entityListActionsColumnPx(listId)
        continue
      }
      const spec = AGENT_SERVER_COLUMN_SPEC[col.key]
      sum += spec ? spec.min : 72
    }
    return sum + 32
  }
  const columnWidths = columnWidthsForEntityList(listId)
  const growKeys = entityListGrowColumnKeys(listId)
  let sum = 0
  for (const col of columns) {
    const locked = lockedColumnPxForList(listId, col)
    if (locked != null) {
      sum += locked
      continue
    }
    if (isEntityListActionsColumn(col.key)) {
      sum += entityListActionsColumnPx(listId)
      continue
    }
    if (growKeys.has(col.key)) {
      sum += entityListGrowMinPx(listId, col.key)
      continue
    }
    sum += columnWeightFromListSettings(
      col.key,
      columnWidths,
      typeof col.width === 'number' ? col.width : 72,
    )
  }
  return sum + 32
}

export function distributeEntityListColumns(
  columns: Pick<Column<unknown>, 'key' | 'width'>[],
  listId: EntityListLayoutId,
  tableWidthPx?: number,
): Record<string, number> {
  const columnWidths = columnWidthsForEntityList(listId)
  const pageMax = entityListPageMaxWidthPx()
  const measured = tableWidthPx != null && tableWidthPx > 0 ? tableWidthPx : pageMax
  const naturalMin = entityListMinTableWidth(columns, listId)
  // 容器更窄时仍按最小自然宽度分配，避免列被压扁；由滚动容器横向滑动
  const contentWidth = Math.max(naturalMin, Math.min(measured, pageMax))

  const lockedSum = columns.reduce((sum, col) => {
    const px = lockedColumnPxForList(listId, col)
    return px != null ? sum + px : sum
  }, 0)

  const growKeys = entityListGrowColumnKeys(listId)
  const growReserve = columns.reduce(
    (sum, col) => (growKeys.has(col.key) ? sum + entityListGrowMinPx(listId, col.key) : sum),
    0,
  )

  const flexColumns = columns.filter(
    (col) =>
      !growKeys.has(col.key) &&
      !isEntityListLockedColumn(col.key) &&
      !isEntityListActionsColumn(col.key),
  )
  const actionsCol = columns.find((col) => isEntityListActionsColumn(col.key))
  const actionsReserve = actionsCol ? entityListActionsColumnPx(listId) : 0
  const flexBudget = Math.max(160, contentWidth - lockedSum - growReserve - actionsReserve)

  const weights = flexColumns.map((col) =>
    columnWeightFromListSettings(
      col.key,
      columnWidths,
      typeof col.width === 'number' ? col.width : 72,
    ),
  )
  const weightSum = weights.reduce((sum, w) => sum + w, 0) || 1
  const allocatedFlex = weights.map((w) => Math.floor((w / weightSum) * flexBudget))
  let usedFlex = allocatedFlex.reduce((sum, w) => sum + w, 0)
  const remainder = flexBudget - usedFlex
  if (remainder !== 0 && allocatedFlex.length > 0) {
    allocatedFlex[allocatedFlex.length - 1] =
      (allocatedFlex[allocatedFlex.length - 1] ?? 0) + remainder
  }

  const map: Record<string, number> = {}
  let flexIndex = 0
  for (const col of columns) {
    if (growKeys.has(col.key)) continue
    if (isEntityListActionsColumn(col.key)) continue
    const locked = lockedColumnPxForList(listId, col)
    if (locked != null) {
      map[col.key] = locked
      continue
    }
    map[col.key] = allocatedFlex[flexIndex] ?? 72
    flexIndex += 1
  }

  if (actionsCol) {
    map[actionsCol.key] = entityListActionsColumnPx(listId)
  }

  return map
}
