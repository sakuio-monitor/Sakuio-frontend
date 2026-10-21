import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './CellTooltip.css'

type CellTooltipProps = {
  tip?: string | null
  children: ReactNode
  className?: string
  /** 传给外层包裹元素，默认 span */
  as?: 'span' | 'div'
}

/**
 * 通用悬停提示（侧栏与表格共用）：立即显示，玻璃气泡；portal 挂 body 避免被表格
 * overflow 裁切；水平以鼠标位置为中心（视觉上就在按钮/文字正下、正上方），垂直
 * 方向优先放下方（表格场景），下方空间不足再翻到上方。
 */
export function CellTooltip({ tip, children, className = '', as = 'span' }: CellTooltipProps) {
  const text = tip?.trim() ?? ''
  const ref = useRef<HTMLElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const mouseXRef = useRef(0)
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<CSSProperties>({})

  const show = useCallback(
    (e: React.MouseEvent | React.FocusEvent) => {
      if (!text) return
      const rect = ref.current?.getBoundingClientRect()
      if (!rect) return
      // focus 事件没有坐标；鼠标坐标缺失/非法时回退到元素中心
      const cx = (e as React.MouseEvent).clientX
      const x =
        typeof cx === 'number' && Number.isFinite(cx) && cx > 0
          ? cx
          : rect.left + rect.width / 2
      mouseXRef.current = x
      const gap = 6
      const spaceBelow = window.innerHeight - rect.bottom
      // 下方放得下（预留一个泡体高度）就放下方，避免盖住表头或行内容
      const placeBelow = spaceBelow >= 96 || rect.top < 120
      const ty = placeBelow ? '0%' : '-100%'
      setStyle({
        left: x,
        top: placeBelow ? rect.bottom + gap : rect.top - gap,
        transform: `translate(-50%, ${ty})`,
        ['--cell-tt-tx' as never]: '-50%',
        ['--cell-tt-ty' as never]: ty,
      } as CSSProperties)
      setOpen(true)
    },
    [text],
  )

  const hide = useCallback(() => setOpen(false), [])

  // 渲染后按气泡实际宽度钳回视口（useLayoutEffect 在绘制前修正，无闪烁）
  useLayoutEffect(() => {
    if (!open) return
    const bubble = bubbleRef.current
    if (!bubble) return
    const half = bubble.offsetWidth / 2
    if (!Number.isFinite(half) || half <= 0) return
    const base = Number.isFinite(mouseXRef.current) ? mouseXRef.current : window.innerWidth / 2
    const left = Math.min(Math.max(base, 8 + half), window.innerWidth - 8 - half)
    setStyle((s) => (s.left === left ? s : { ...s, left }))
  }, [open, style])

  const Tag = as
  const wrapClass = ['cell-tooltip', className].filter(Boolean).join(' ')

  if (!text) {
    return <Tag className={wrapClass || undefined}>{children}</Tag>
  }

  return (
    <>
      <Tag
        ref={ref as never}
        className={wrapClass}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </Tag>
      {open
        ? createPortal(
            <div ref={bubbleRef} className="cell-tooltip__bubble" style={style} role="tooltip">
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
