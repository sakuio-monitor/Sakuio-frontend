import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '../DataTable/DataTable'
import { PageListHeader } from '../PageListHeader'
import type { EntityListLayoutId } from '../../utils/entityListLayout'

export type CursorListResponse<T> = {
  items: T[]
  next_cursor: string | null
}

type CursorEntityListProps<T> = {
  listLayoutId?: EntityListLayoutId
  columns: Column<T>[]
  queryKey: readonly unknown[]
  fetchPage: (params: { cursor?: string; limit: number }) => Promise<CursorListResponse<T>>
  rowKey: (row: T) => string
  refetchInterval?: number | false
  enabled?: boolean
  resetPageWhen?: unknown
  emptyText?: string
  tableClassName?: string
}

export function CursorEntityList<T>({
  listLayoutId,
  columns,
  queryKey,
  fetchPage,
  rowKey,
  refetchInterval = false,
  enabled = true,
  resetPageWhen,
  emptyText,
  tableClassName = 'data-table--entity-list',
}: CursorEntityListProps<T>) {
  const { t } = useTranslation()
  const [pageSize, setPageSize] = useState(20)
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined])
  const [cursorIndex, setCursorIndex] = useState(0)
  const [items, setItems] = useState<T[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  const querySignature = JSON.stringify(queryKey)

  useEffect(() => {
    setCursorStack([undefined])
    setCursorIndex(0)
  }, [resetPageWhen, querySignature])

  const activeCursor = cursorStack[cursorIndex]

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchPage({
        cursor: activeCursor,
        limit: pageSize,
      })
      setItems(payload.items)
      setNextCursor(payload.next_cursor)
    } catch (err) {
      setError(err)
      setItems([])
      setNextCursor(null)
    } finally {
      setLoading(false)
    }
  }, [activeCursor, enabled, fetchPage, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!refetchInterval || !enabled) return undefined
    const timer = window.setInterval(() => void load(), refetchInterval)
    return () => window.clearInterval(timer)
  }, [enabled, load, refetchInterval])

  const hasPrev = cursorIndex > 0
  const hasNext = Boolean(nextCursor)

  const goPrev = () => {
    if (!hasPrev) return
    setCursorIndex((i) => i - 1)
  }

  const goNext = () => {
    if (!nextCursor) return
    setCursorStack((stack) => {
      const trimmed = stack.slice(0, cursorIndex + 1)
      return [...trimmed, nextCursor]
    })
    setCursorIndex((i) => i + 1)
  }

  if (error) {
    return (
      <p className="page-card p-5 text-sm text-apple-red" role="alert">
        {t('common.error')}
      </p>
    )
  }

  const from = items.length === 0 ? 0 : cursorIndex * pageSize + 1
  const to = items.length === 0 ? 0 : from + items.length - 1

  return (
    <DataTable
      tableClassName={tableClassName}
      listLayoutId={listLayoutId}
      columns={columns}
      data={items}
      rowKey={rowKey}
      loading={loading}
      emptyText={emptyText ?? t('common.empty')}
      pagination={{
        mode: 'cursor',
        page: cursorIndex + 1,
        size: pageSize,
        hasPrev,
        hasNext,
        rangeFrom: from,
        rangeTo: to,
      }}
      onCursorPrev={goPrev}
      onCursorNext={goNext}
      onSizeChange={(size) => {
        setPageSize(size)
        setCursorStack([undefined])
        setCursorIndex(0)
      }}
    />
  )
}

type EntityListPageProps<T> = CursorEntityListProps<T> & {
  titleKey: string
  actions?: ReactNode
  toolbar?: ReactNode
}

export function EntityListPage<T>({
  titleKey,
  actions,
  toolbar,
  ...list
}: EntityListPageProps<T>) {
  return (
    <section className="page-container page-container--entity-list">
      <PageListHeader titleKey={titleKey} actions={actions} />
      {toolbar ? <div className="entity-list-toolbar">{toolbar}</div> : null}
      <CursorEntityList {...list} />
    </section>
  )
}
