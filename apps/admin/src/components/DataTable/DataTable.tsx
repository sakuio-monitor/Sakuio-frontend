import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react'
import { Loader2, ArrowUp, ArrowDown, ArrowUpDown, GripVertical } from 'lucide-react'
import { formatCellDisplay } from "../../utils/formatCellDisplay";
import {
  type EntityListLayoutId,
  ENTITY_LIST_COLUMN_GAP,
  ENTITY_LIST_DRAG_HANDLE_PX,
  ENTITY_LIST_SELECT_PX,
  entityListGrowColumnKeys,
  ENTITY_LIST_PAGE_MAX_WIDTH,
  distributeEntityListColumnLayout,
  entityListMinTableWidth,
  entityListPageMaxWidthPx,
  entityListUsesFluidTableWidth,
  isEntityListActionsColumn,
  isEntityListLockedColumnForList,
} from "../../utils/entityListLayout";
import { Pagination } from './Pagination'
import './DataTable.css'

export interface RowContext {
  level: number
  expanded: boolean
  canExpand: boolean
  onToggleExpand?: (key: string | number) => void
}

export interface Column<T> {
  key: string
  title: string
  width?: number | string
  /** 与 width 相同，且 min/max 锁死，列宽不随内容伸缩 */
  fixedWidth?: boolean
  sortable?: boolean
  render?: (row: T, index: number, ctx?: RowContext) => ReactNode
}

function columnWidthCss(width: number | string): string {
  return typeof width === 'number' ? `${width}px` : width
}

function cellClassName(col: Pick<Column<unknown>, 'key' | 'fixedWidth'>, entityList: boolean): string {
  return [
    col.fixedWidth ? 'data-table__col--fixed-width' : '',
    entityList && isEntityListActionsColumn(col.key) ? 'data-table__td--actions' : '',
    !entityList && col.key === 'action' ? 'data-table__td--sticky-right' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function headerClassName(col: Pick<Column<unknown>, 'key' | 'fixedWidth' | 'sortable'>, entityList: boolean): string {
  return [
    col.fixedWidth ? 'data-table__col--fixed-width' : '',
    entityList && isEntityListActionsColumn(col.key) ? 'data-table__th--actions' : '',
    !entityList && col.key === 'action' ? 'data-table__th--sticky-right' : '',
    col.sortable ? 'data-table__th--sortable' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export type EntityListLayoutOptions = {
  entityList: true
  listLayoutId: EntityListLayoutId
  columnWidthPxByKey: Record<string, number>
  columnMinPxByKey?: Record<string, number>
  columnMaxPxByKey?: Record<string, number>
}

export function columnLayoutStyle(
  col: Pick<Column<unknown>, 'key' | 'width' | 'fixedWidth'>,
  options?: EntityListLayoutOptions,
): CSSProperties | undefined {
  if (options?.entityList) {
    if (entityListGrowColumnKeys(options.listLayoutId).has(col.key)) return undefined
    const px = options.columnWidthPxByKey[col.key]
    if (px == null) return undefined
    const w = `${px}px`
    if (entityListUsesFluidTableWidth(options.listLayoutId)) {
      const max = options.columnMaxPxByKey?.[col.key]
      return {
        width: w,
        maxWidth: max != null ? `${max}px` : undefined,
      }
    }
    return { width: w, minWidth: w, maxWidth: w }
  }
  if (col.width == null) return undefined
  const w = columnWidthCss(col.width)
  if (col.fixedWidth) {
    return { width: w, minWidth: w, maxWidth: w }
  }
  return { width: w }
}

export interface SortState {
  field: string
  order: 'asc' | 'desc'
}

/** 通用拖拽排序：把手列按下开始拖动，drop 到目标行回调 from → to（行索引） */
export interface RowDragOptions {
  onReorder: (fromIndex: number, toIndex: number) => void
  /** 把手 hover 提示文案 */
  handleLabel?: string
}

export interface PaginationState {
  page: number
  size: number
  total?: number
  mode?: 'offset' | 'cursor'
  hasPrev?: boolean
  hasNext?: boolean
  rangeFrom?: number
  rangeTo?: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string | number
  loading?: boolean
  pagination?: PaginationState
  onPageChange?: (page: number) => void
  onSizeChange?: (size: number) => void
  onCursorPrev?: () => void
  onCursorNext?: () => void
  emptyText?: string
  selectable?: boolean
  selectedKeys?: Set<string | number>
  onSelectionChange?: (keys: Set<string | number>) => void
  /** 拖拽排序（通用）：传入即在最左侧渲染拖动把手列（无表头） */
  rowDrag?: RowDragOptions
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  header?: ReactNode
  footer?: ReactNode
  expandedRowKeys?: (string | number)[]
  renderExpanded?: (row: T) => ReactNode
  getChildren?: (row: T) => T[]
  hasChildren?: (row: T) => boolean
  expandedKeys?: Set<string | number>
  onToggleExpand?: (key: string | number) => void
  getLevel?: (row: T) => number
  /** 例如 `data-table--entity-list`，用于节点/Client 等固定前列宽 */
  tableClassName?: string
  /** 与 `tableClassName="data-table--entity-list"` 同用，nodes / clients 各一套硬编码列宽 */
  listLayoutId?: EntityListLayoutId
}

interface TableRowProps<T> {
  row: T
  index: number
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  selectable: boolean
  selectedKeys?: Set<string | number>
  onToggleRow?: (key: string | number) => void
  rowDrag?: RowDragOptions
  dragging: boolean
  dragOver: boolean
  onDragStartRow?: (index: number) => void
  onDragOverRow?: (index: number) => void
  onDragEndRow?: () => void
  expandedKeys?: Set<string | number>
  renderExpanded?: (row: T) => ReactNode
  getChildren?: (row: T) => T[]
  hasChildren?: (row: T) => boolean
  onToggleExpand?: (key: string | number) => void
  getLevel?: (row: T) => number
  level: number
  columnLayoutOptions?: EntityListLayoutOptions
}

function TableRowImpl<T>({
  row,
  index,
  columns,
  rowKey,
  selectable,
  selectedKeys,
  onToggleRow,
  rowDrag,
  dragging,
  dragOver,
  onDragStartRow,
  onDragOverRow,
  onDragEndRow,
  expandedKeys,
  renderExpanded,
  getChildren,
  hasChildren,
  onToggleExpand,
  getLevel,
  level,
  columnLayoutOptions,
}: TableRowProps<T>) {
  const key = rowKey(row)
  const checked = selectedKeys?.has(key) ?? false
  const isExpanded = expandedKeys?.has(key) ?? false
  const canExpand = hasChildren ? hasChildren(row) : false
  const colSpan = columns.length + (selectable ? 1 : 0) + (rowDrag ? 1 : 0)

  const rows: ReactNode[] = [
    <tr
      key={key}
      className={[
        checked ? 'data-table__row--selected' : '',
        dragging ? 'data-table__row--dragging' : '',
        dragOver ? 'data-table__row--drag-over' : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined}
      onDragOver={
        rowDrag
          ? (e) => {
              // 仅响应行把手拖起的会话（dataTransfer 带 text/plain 标记）
              if (dragging || !e.dataTransfer.types.includes('text/plain')) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              onDragOverRow?.(index)
            }
          : undefined
      }
      onDrop={
        rowDrag
          ? (e) => {
              e.preventDefault()
              // 把手拖起时记录的行号在 dataTransfer 里，drop 行即目标位置
              const from = Number(e.dataTransfer.getData('text/plain'))
              if (Number.isInteger(from) && from !== index) rowDrag.onReorder(from, index)
            }
          : undefined
      }
    >
      {rowDrag && (
        <td className="data-table__td-drag">
          <span
            className="data-table__drag-handle"
            title={rowDrag.handleLabel}
            aria-label={rowDrag.handleLabel}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', String(index))
              onDragStartRow?.(index)
            }}
            onDragEnd={() => onDragEndRow?.()}
          >
            <GripVertical size={14} aria-hidden />
          </span>
        </td>
      )}
      {selectable && (
        <td className="data-table__td-check">
          <input
            type="checkbox"
            className="data-table__checkbox"
            checked={checked}
            onChange={() => onToggleRow?.(key)}
          />
        </td>
      )}
      {columns.map((col) => (
        <td
          key={col.key}
          style={columnLayoutStyle(col, columnLayoutOptions)}
          className={cellClassName(col, Boolean(columnLayoutOptions?.entityList)) || undefined}
        >
          {col.render
            ? col.render(row, index, { level, expanded: isExpanded, canExpand, onToggleExpand })
            : formatCellDisplay(col.key, (row as Record<string, unknown>)[col.key])}
        </td>
      ))}
    </tr>,
  ]
  if (isExpanded && renderExpanded) {
    rows.push(
      <tr key={`${key}-expanded`} className="data-table__row--expanded">
        <td colSpan={colSpan} style={{ padding: 0, border: 'none' }}>
          {renderExpanded(row)}
        </td>
      </tr>,
    )
  }
  if (isExpanded && getChildren && canExpand) {
    const children = getChildren(row)
    children.forEach((child, childIdx) => {
      rows.push(
        <TableRow
          key={rowKey(child)}
          row={child}
          index={childIdx}
          columns={columns}
          rowKey={rowKey}
          selectable={selectable}
          selectedKeys={selectedKeys}
          onToggleRow={onToggleRow}
          dragging={false}
          dragOver={false}
          expandedKeys={expandedKeys}
          renderExpanded={renderExpanded}
          getChildren={getChildren}
          hasChildren={hasChildren}
          onToggleExpand={onToggleExpand}
          getLevel={getLevel}
          level={level + 1}
          columnLayoutOptions={columnLayoutOptions}
        />
      )
    })
  }
  return <>{rows}</>
}

const TableRow = memo(TableRowImpl, (prev, next) => {
  return prev.row === next.row &&
    prev.index === next.index &&
    prev.columns === next.columns &&
    prev.selectable === next.selectable &&
    prev.selectedKeys === next.selectedKeys &&
    prev.rowDrag === next.rowDrag &&
    prev.dragging === next.dragging &&
    prev.dragOver === next.dragOver &&
    prev.onDragStartRow === next.onDragStartRow &&
    prev.onDragOverRow === next.onDragOverRow &&
    prev.onDragEndRow === next.onDragEndRow &&
    prev.expandedKeys === next.expandedKeys &&
    prev.level === next.level &&
    prev.columnLayoutOptions === next.columnLayoutOptions
}) as <T>(props: TableRowProps<T>) => ReactNode

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  pagination,
  onPageChange,
  onSizeChange,
  onCursorPrev,
  onCursorNext,
  emptyText = '暂无数据',
  selectable = false,
  selectedKeys,
  onSelectionChange,
  rowDrag,
  sort,
  onSortChange,
  header,
  footer,
  expandedRowKeys,
  renderExpanded,
  getChildren,
  hasChildren,
  expandedKeys,
  onToggleExpand,
  getLevel,
  tableClassName,
  listLayoutId,
}: DataTableProps<T>) {
  const safeData = Array.isArray(data) ? data : []
  const allKeys = useMemo(() => safeData.map((r) => rowKey(r)), [safeData, rowKey])
  const allSelected = useMemo(
    () => allKeys.length > 0 && selectedKeys != null && allKeys.every((k) => selectedKeys.has(k)),
    [allKeys, selectedKeys],
  )

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return
    if (allSelected) {
      const next = new Set(selectedKeys)
      allKeys.forEach((k) => next.delete(k))
      onSelectionChange(next)
    } else {
      const next = new Set(selectedKeys)
      allKeys.forEach((k) => next.add(k))
      onSelectionChange(next)
    }
  }, [allSelected, allKeys, selectedKeys, onSelectionChange])

  const toggleRow = useCallback(
    (key: string | number) => {
      if (!onSelectionChange || !selectedKeys) return
      const next = new Set(selectedKeys)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      onSelectionChange(next)
    },
    [selectedKeys, onSelectionChange],
  )

  const colSpan = columns.length + (selectable ? 1 : 0) + (rowDrag ? 1 : 0)

  // 拖拽会话状态：把手 dragStart 记录起始行，行 dragOver 记录目标行，drop 结束
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const clearDrag = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  const isEntityList = tableClassName === 'data-table--entity-list'
  // 测量外层 wrapper 而非滚动容器：滚动条出现/消失不影响 wrapper 宽度，
  // 避免拖动窗口宽度时在阈值附近来回振荡导致滚动条闪烁
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!isEntityList) return
    const el = wrapperRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setAvailableWidth(w)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [isEntityList])

  const tableMinWidthPx = useMemo(() => {
    if (!isEntityList || !listLayoutId) return 0
    // 把手 / 复选框前置列也占宽度预算，避免业务列被挤出容器
    const extras = (rowDrag ? ENTITY_LIST_DRAG_HANDLE_PX : 0) + (selectable ? ENTITY_LIST_SELECT_PX : 0)
    return entityListMinTableWidth(columns, listLayoutId) + extras
  }, [columns, isEntityList, listLayoutId, rowDrag, selectable])

  const colLayoutOpts = useMemo((): EntityListLayoutOptions | undefined => {
    if (!isEntityList || !listLayoutId) return undefined
    const pageMax = entityListPageMaxWidthPx()
    // 业务列只分配「容器宽 - 前置固定列」的预算
    const extras = (rowDrag ? ENTITY_LIST_DRAG_HANDLE_PX : 0) + (selectable ? ENTITY_LIST_SELECT_PX : 0)
    const tableWidth =
      availableWidth != null && availableWidth > 0
        ? Math.min(Math.max(availableWidth - extras, 280), pageMax)
        : pageMax
    const layout = distributeEntityListColumnLayout(columns, listLayoutId, tableWidth)
    return {
      entityList: true,
      listLayoutId,
      columnWidthPxByKey: layout.widthPxByKey,
      columnMinPxByKey: layout.minPxByKey,
      columnMaxPxByKey: layout.maxPxByKey,
    }
  }, [columns, isEntityList, listLayoutId, availableWidth, rowDrag, selectable])

  const entityListWrapperStyle = useMemo((): CSSProperties | undefined => {
    if (!isEntityList) return undefined
    return {
      ['--admin-list-column-gap' as string]: ENTITY_LIST_COLUMN_GAP,
      // 容器窄于列宽之和时，表格按此最小宽横向滚动
      ['--entity-list-table-min-width' as string]: `${tableMinWidthPx}px`,
    }
  }, [isEntityList, tableMinWidthPx])

  const effectiveExpandedKeys = useMemo(() => {
    if (expandedKeys) return expandedKeys
    if (expandedRowKeys && expandedRowKeys.length > 0) return new Set(expandedRowKeys)
    return null
  }, [expandedKeys, expandedRowKeys])

  return (
    <div
      ref={isEntityList ? wrapperRef : undefined}
      className={['data-table-wrapper', isEntityList ? 'data-table-wrapper--entity-list' : '']
        .filter(Boolean)
        .join(' ')}
      style={entityListWrapperStyle}
    >
      {header && <div className="data-table-header">{header}</div>}
      <div className="data-table-body">
      <div className="data-table-scroll">
        <table
          className={['data-table', tableClassName, listLayoutId ? `data-table--list-${listLayoutId}` : '']
            .filter(Boolean)
            .join(' ')}
          style={
            isEntityList && listLayoutId && entityListUsesFluidTableWidth(listLayoutId)
              ? { width: '100%' }
              : isEntityList && tableMinWidthPx > 0
                ? { minWidth: tableMinWidthPx, width: 'max(100%, var(--entity-list-table-min-width))' }
                : undefined
          }
        >
          {isEntityList ? (
            <colgroup>
              {rowDrag && <col style={{ width: `${ENTITY_LIST_DRAG_HANDLE_PX}px` }} />}
              {selectable && <col style={{ width: `${ENTITY_LIST_SELECT_PX}px` }} />}
              {columns.map((col) => (
                <col
                  key={col.key}
                  className={[
                    col.fixedWidth ? 'data-table__col--fixed-width' : '',
                    listLayoutId && isEntityListLockedColumnForList(listLayoutId, col.key)
                      ? 'data-table__col--locked'
                      : '',
                    listLayoutId && entityListGrowColumnKeys(listLayoutId).has(col.key)
                      ? 'data-table__col--grow'
                      : '',
                    isEntityListActionsColumn(col.key) ? 'data-table__col--actions' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined}
                  style={columnLayoutStyle(col, colLayoutOpts)}
                />
              ))}
            </colgroup>
          ) : null}
          <thead>
            <tr>
              {rowDrag && <th className="data-table__th-drag" style={{ width: 36 }} aria-hidden />}
              {selectable && (
                <th className="data-table__td-check" style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    className="data-table__checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={columnLayoutStyle(col, colLayoutOpts)}
                  className={headerClassName(col, isEntityList)}
                  onClick={col.sortable && onSortChange ? () => {
                    if (sort?.field === col.key) {
                      onSortChange({ field: col.key, order: sort.order === 'asc' ? 'desc' : 'asc' })
                    } else {
                      onSortChange({ field: col.key, order: 'asc' })
                    }
                  } : undefined}
                >
                  <span className="data-table__th-content">
                    {col.title}
                    {col.sortable && (
                      <span className="data-table__sort-icon">
                        {sort?.field === col.key
                          ? sort.order === 'asc'
                            ? <ArrowUp size={14} />
                            : <ArrowDown size={14} />
                          : <ArrowUpDown size={14} />}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="data-table__loading">
                    <Loader2 size={20} className="data-table__spinner" />
                    <span>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : safeData.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <div className="data-table__empty">{emptyText}</div>
                </td>
              </tr>
            ) : (
              safeData.map((row, idx) => (
                <TableRow
                  key={rowKey(row)}
                  row={row}
                  index={idx}
                  columns={columns}
                  rowKey={rowKey}
                  selectable={selectable}
                  selectedKeys={selectedKeys}
                  onToggleRow={toggleRow}
                  rowDrag={rowDrag}
                  dragging={dragIndex === idx}
                  dragOver={dragOverIndex === idx && dragIndex !== idx}
                  onDragStartRow={rowDrag ? setDragIndex : undefined}
                  onDragOverRow={rowDrag ? setDragOverIndex : undefined}
                  onDragEndRow={clearDrag}
                  expandedKeys={effectiveExpandedKeys ?? undefined}
                  renderExpanded={renderExpanded}
                  getChildren={getChildren}
                  hasChildren={hasChildren}
                  onToggleExpand={onToggleExpand}
                  getLevel={getLevel}
                  level={getLevel ? getLevel(row) : 0}
                  columnLayoutOptions={colLayoutOpts}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      </div>
      {footer && <div className="data-table-footer">{footer}</div>}
      {pagination && (
        <Pagination
          {...pagination}
          onPageChange={onPageChange}
          onSizeChange={onSizeChange}
          onCursorPrev={onCursorPrev}
          onCursorNext={onCursorNext}
        />
      )}
    </div>
  )
}
