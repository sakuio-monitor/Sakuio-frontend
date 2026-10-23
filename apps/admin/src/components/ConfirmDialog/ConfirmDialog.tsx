import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@sakuio/ui'
import './ConfirmDialog.css'

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 危险操作（删除等）确认按钮显示红色 */
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * 应用内二次确认弹窗（禁用 window.confirm 等原生控件）。
 * `const { confirm, confirmDialog } = useConfirmDialog()`
 * `confirm({ title, danger: true, onConfirm })`，然后把 {confirmDialog} 放进 JSX。
 */
export function useConfirmDialog() {
  const { t } = useTranslation()
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const [running, setRunning] = useState(false)

  const confirm = useCallback((opts: ConfirmOptions) => setPending(opts), [])
  const close = useCallback(() => {
    setPending(null)
    setRunning(false)
  }, [])

  const confirmDialog = pending ? (
    <ConfirmDialog
      open
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel ?? t('common.confirm')}
      cancelLabel={pending.cancelLabel ?? t('common.cancel')}
      danger={pending.danger}
      loading={running}
      onConfirm={() => {
        setRunning(true)
        void Promise.resolve(pending.onConfirm()).finally(close)
      }}
      onCancel={close}
    />
  ) : null

  return { confirm, confirmDialog }
}

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return createPortal(
    <div className="confirm-dialog-overlay" onClick={loading ? undefined : onCancel}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="confirm-dialog__title">{title}</h3>
        {description ? <p className="confirm-dialog__description">{description}</p> : null}
        <div className="confirm-dialog__actions">
          <Button type="button" size="sm" variant="ghost" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            className={danger ? 'confirm-dialog__danger' : undefined}
            disabled={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
