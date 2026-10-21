import type { TFunction } from 'i18next'
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@sakuio/ui'
import type { Column } from './DataTable/DataTable'
import { CellTooltip } from './CellTooltip/CellTooltip'
import { RegionFlag } from './RegionFlag'
import { formatIpv6Display } from '../utils/ipDisplay'
import { countryFlagUrl, getCountryDisplayName } from '../utils/iso3166'
import { uuidFirstSegment } from '../utils/shortId'
import './EntityListLeadingCells.css'

/** 前 4 列（ID / 状态 / 地区 / IP）锁死列宽，不随内容变化 */
export const ENTITY_LIST_FIXED_COL_COUNT = 4

export const ENTITY_LIST_COL_ID = 80
export const ENTITY_LIST_COL_STATUS = 68
export const ENTITY_LIST_COL_REGION = 56
export const ENTITY_LIST_COL_IP = 93
/** 服务器列表 IP 列默认宽度（双行 + 复制按钮） */
export const AGENT_SERVER_COL_IP = 220
export const ENTITY_LIST_COL_NAME = 88

export type EntityListLeadingFields = {
  id: string
  online: boolean
  region: string
  ip: string | null | undefined
  name: string
}

/** 服务器列表名称列：地区 flag SVG + 名称 */
export function AgentServerNameCell({
  name,
  region,
}: {
  name: string
  region?: string
}) {
  const full = name.trim() || '—'
  const display =
    full === '—' || full.length <= 25 ? full : `${full.slice(0, 25)}...`
  return (
    <CellTooltip
      tip={full === '—' ? undefined : full}
      className="entity-list-cell entity-list-cell--name data-table-cell"
    >
      <span className="entity-list-cell--name-with-flag">
        <RegionFlag
          code={region}
          className="entity-list-cell--name-flag"
        />
        <span className="entity-list-cell__name-text">{display}</span>
      </span>
    </CellTooltip>
  )
}

function copyIpAddress(text: string, successMessage: string, errorMessage: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(successMessage),
    () => toast.error(errorMessage),
  )
}

/** 服务器列表 IP 列：双行 v4/v6，每行末尾复制按钮 */
export function AgentServerDualIpCell({ ipv4, ipv6 }: { ipv4: string; ipv6: string }) {
  const { t } = useTranslation()
  const v4 = ipv4?.trim() ?? ''
  const v6 = ipv6?.trim() ?? ''
  const copyLabel = t('common.copy')
  const copyOk = t('common.copySuccess')
  const copyFail = t('common.error')

  if (!v4 && !v6) {
    return (
      <span className="entity-list-cell entity-list-cell--fixed entity-list-cell--ip data-table-cell">—</span>
    )
  }

  return (
    <div className="entity-list-cell entity-list-cell--fixed entity-list-cell--ip entity-list-cell--ip-dual data-table-cell">
      <div className="ip-cell">
        {v4 ? (
          <span className="ip-cell__line">
            <span className="ip-cell__v6-text">{v4}</span>
            <CellTooltip tip={`${copyLabel} IPv4`}>
              <button
                type="button"
                className="ip-cell__copy"
                aria-label={`${copyLabel} IPv4`}
                onClick={() => copyIpAddress(v4, copyOk, copyFail)}
              >
                <Copy size={16} aria-hidden />
              </button>
            </CellTooltip>
          </span>
        ) : null}
        {v6 ? (
          <span className="ip-cell__line ip-cell__v6">
            <CellTooltip tip={v6}>
              <span className="ip-cell__v6-text">{formatIpv6Display(v6)}</span>
            </CellTooltip>
            <CellTooltip tip={`${copyLabel} IPv6`}>
              <button
                type="button"
                className="ip-cell__copy"
                aria-label={`${copyLabel} IPv6`}
                onClick={() => copyIpAddress(v6, copyOk, copyFail)}
              >
                <Copy size={16} aria-hidden />
              </button>
            </CellTooltip>
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** 两页共用同一套前列定义，避免列宽/渲染不一致 */
export function buildEntityListLeadingColumns<T>(options: {
  t: TFunction
  locale: string
  nameFieldKey: string
  ipColumnKey: string
  pick: (row: T) => EntityListLeadingFields
}): Column<T>[] {
  const { t, locale, nameFieldKey, ipColumnKey, pick } = options
  return [
    {
      key: 'id',
      title: t('fields.id'),
      width: ENTITY_LIST_COL_ID,
      fixedWidth: true,
      render: (row) => <EntityIdCell id={pick(row).id} />,
    },
    {
      key: 'online',
      title: t('fields.status'),
      width: ENTITY_LIST_COL_STATUS,
      fixedWidth: true,
      render: (row) => {
        const { online } = pick(row)
        return (
          <EntityStatusCell
            online={online}
            onlineLabel={t('common.online')}
            offlineLabel={t('common.offline')}
          />
        )
      },
    },
    {
      key: 'region',
      title: t('fields.region'),
      width: ENTITY_LIST_COL_REGION,
      fixedWidth: true,
      render: (row) => <EntityRegionFlagCell code={pick(row).region} locale={locale} />,
    },
    {
      key: ipColumnKey,
      title: t('fields.ip_address'),
      width: ENTITY_LIST_COL_IP,
      fixedWidth: true,
      render: (row) => <EntityIpCell value={pick(row).ip} />,
    },
    {
      key: 'name',
      title: t(`fields.${nameFieldKey}`),
      width: ENTITY_LIST_COL_NAME,
      render: (row) => <EntityNameCell name={pick(row).name} />,
    },
  ]
}

export function EntityStatusCell({
  online,
  onlineLabel,
  offlineLabel,
}: {
  online: boolean
  onlineLabel: string
  offlineLabel: string
}) {
  return (
    <span className="entity-list-cell entity-list-cell--fixed entity-list-cell--status data-table-cell">
      <span
        className={`data-table-tag entity-list-cell__status-tag ${online ? 'data-table-tag--online' : 'data-table-tag--offline'}`}
      >
        {online ? onlineLabel : offlineLabel}
      </span>
    </span>
  )
}

export function EntityIdCell({ id, title }: { id: string; title?: string }) {
  return (
    <CellTooltip tip={title?.trim() || id} className="entity-list-cell entity-list-cell--fixed entity-list-cell--id data-table-cell">
      {uuidFirstSegment(id)}
    </CellTooltip>
  )
}

export function EntityRegionFlagCell({ code, locale }: { code: string; locale: string }) {
  const upper = code.trim().toUpperCase()
  if (!upper) {
    return <span className="entity-list-cell entity-list-cell--fixed entity-list-cell--region data-table-cell">—</span>
  }
  const flag = countryFlagUrl(upper)
  const name = getCountryDisplayName(upper, locale)
  return (
    <CellTooltip tip={name} className="entity-list-cell entity-list-cell--fixed entity-list-cell--region data-table-cell">
      {flag ? <img src={flag} alt="" className="entity-list-cell__flag" loading="lazy" /> : upper}
    </CellTooltip>
  )
}

export function EntityIpCell({ value }: { value: string | null | undefined }) {
  const ip = value?.trim() ?? ''
  if (!ip) {
    return <span className="entity-list-cell entity-list-cell--fixed entity-list-cell--ip data-table-cell">—</span>
  }
  return (
    <CellTooltip tip={ip} className="entity-list-cell entity-list-cell--fixed entity-list-cell--ip data-table-cell">
      {ip}
    </CellTooltip>
  )
}

export function EntityNameCell({ name }: { name: string }) {
  const text = name.trim() || '—'
  return (
    <CellTooltip tip={text === '—' ? undefined : text} className="entity-list-cell entity-list-cell--name data-table-cell">
      {text}
    </CellTooltip>
  )
}
