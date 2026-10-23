/** 线路/运营商品牌 SVG：`public/images/logo/lines/`（与 IkuaiPortal `/icons/lines/` 同名） */

export const LINE_ICON_BASE = '/images/logo/lines'

const LINE_ICON_PREFIX = `${LINE_ICON_BASE}/`

export function lineIconUrl(file: string): string {
  return `${LINE_ICON_PREFIX}${file}`
}

export function resolveProviderBrandIconSrc(icon?: string): string | undefined {
  if (!icon?.trim())
    return undefined
  const value = icon.trim()
  if (value.startsWith(LINE_ICON_PREFIX) && value.endsWith('.svg'))
    return value
  if (value.endsWith('.svg') && !value.includes(':'))
    return `${LINE_ICON_PREFIX}${value.replace(/^\//, '')}`
  return undefined
}

export function hasProviderBrandIcon(icon?: string): boolean {
  return Boolean(resolveProviderBrandIconSrc(icon))
}
