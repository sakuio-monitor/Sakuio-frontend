import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function PageListHeader({
  title,
  titleKey,
  actions,
}: {
  title?: string
  titleKey?: string
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  const resolved = title?.trim() || (titleKey ? t(titleKey) : '')

  return (
    <div className="page-header">
      <h1 className="page-header__title">{resolved}</h1>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  )
}
