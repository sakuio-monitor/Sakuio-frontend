/** 主题未配置 listRowHeight 时，所有列表表格统一使用的行高 */
export const DEFAULT_NODE_LIST_ROW_HEIGHT = '56px'

/** 表头/行 `.node-list-header`、`.node-list-item` 左右 padding 各 16px */
export const NODE_LIST_TABLE_HORIZONTAL_PADDING_PX = 32

function parseCssLengthToPx(value: string): number {
  const trimmed = value.trim()
  const match = trimmed.match(/^([\d.]+)\s*(px|rem)?$/i)
  if (!match)
    return 0
  const num = Number(match[1])
  if (!Number.isFinite(num))
    return 0
  if (match[2]?.toLowerCase() === 'rem')
    return num * 16
  return num
}

/** 解析 `grid-template-columns` 为各列 track（支持 minmax(...)） */
export function splitGridTemplateColumns(template: string): string[] {
  const tracks: string[] = []
  let i = 0
  const s = template.trim()
  while (i < s.length) {
    while (i < s.length && s[i] === ' ')
      i++
    if (i >= s.length)
      break
    if (s.startsWith('minmax(', i)) {
      let depth = 0
      let j = i
      for (; j < s.length; j++) {
        if (s[j] === '(')
          depth++
        else if (s[j] === ')') {
          depth--
          if (depth === 0) {
            j++
            break
          }
        }
      }
      tracks.push(s.slice(i, j).trim())
      i = j
    }
    else {
      let j = i
      while (j < s.length && s[j] !== ' ')
        j++
      tracks.push(s.slice(i, j).trim())
      i = j
    }
  }
  return tracks.filter(Boolean)
}

/** 从 grid 列宽字符串提取最小占位（px） */
export function minWidthFromColumnTrack(track: string): number {
  const trimmed = track.trim()
  const minmax = trimmed.match(/minmax\(\s*([^,\s]+)/i)
  if (minmax)
    return parseCssLengthToPx(minmax[1]!)
  return parseCssLengthToPx(trimmed) || 72
}

/** 估算 List 网格最小总宽度，供水平滚动 */
export function estimateListGridMinWidth(
  columns: readonly string[],
  widths: Record<string, string>,
  gap = '12px',
): string {
  let sum = 0
  for (const col of columns) {
    const track = widths[col]?.trim() || 'auto'
    sum += minWidthFromColumnTrack(track === 'auto' ? '72px' : track)
  }
  const gapPx = parseCssLengthToPx(gap) || 12
  if (columns.length > 1)
    sum += (columns.length - 1) * gapPx
  sum += NODE_LIST_TABLE_HORIZONTAL_PADDING_PX
  return `${Math.ceil(sum)}px`
}

/** 由完整 grid-template-columns 估算最小总宽度（面板自定义 grid 用） */
export function estimateMinWidthFromGridTemplate(
  gridTemplateColumns: string,
  gap = '12px',
): string {
  const tracks = splitGridTemplateColumns(gridTemplateColumns)
  let sum = 0
  for (const track of tracks)
    sum += minWidthFromColumnTrack(track)
  const gapPx = parseCssLengthToPx(gap) || 12
  if (tracks.length > 1)
    sum += (tracks.length - 1) * gapPx
  sum += NODE_LIST_TABLE_HORIZONTAL_PADDING_PX
  return `${Math.ceil(sum)}px`
}
