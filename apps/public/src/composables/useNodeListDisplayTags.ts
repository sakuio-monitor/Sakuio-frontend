import type { MaybeRefOrGetter } from 'vue'
import type { NodeData } from '@/stores/nodes'
import { computed, toValue } from 'vue'
import { useNodeProviderMetadata } from '@/composables/useNodeProviderMetadata'
import { useAppStore } from '@/stores/app'
import { cleanProviderOrg, providerListSvgIcon } from '@/utils/providerInfo'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, parseTags } from '@/utils/tagHelper'

export interface NodeDisplayTag {
  key: string
  text: string
  color: string
  icon?: string
  title?: string
}

const LIST_NAME_NETWORK_FIELDS = ['provider', 'asn'] as const

interface NodeMetadataItem {
  key: string
  value: string
  title?: string
  icon?: string
  color?: string
}

function getExpireBadgeColor(status: string): string {
  switch (status) {
    case 'expired':
    case 'critical':
      return '#E54D2E'
    case 'warning':
      return '#F97316'
    case 'long_term':
      return '#8D8D8D'
    case 'normal':
    default:
      return '#30A46C'
  }
}

export function useNodeListDisplayTags(nodes: MaybeRefOrGetter<NodeData[]>) {
  const appStore = useAppStore()

  const { metadataByUuid, getNodeProviderMetadata } = useNodeProviderMetadata({
    nodes: () => toValue(nodes),
    customAliases: () => appStore.providerAliases,
    enabled: () => true,
    allowGeoLookup: () => appStore.privateFeaturesAllowed,
  })

  function buildNodeNetworkItems(node: NodeData): NodeMetadataItem[] {
    const items: NodeMetadataItem[] = []
    const providerMetadata = getNodeProviderMetadata(node)
    const resolved = providerMetadata?.provider

    for (const field of LIST_NAME_NETWORK_FIELDS) {
      switch (field) {
        case 'provider': {
          if (!resolved?.displayName)
            break
          items.push({
            key: 'provider',
            value: resolved.displayName,
            icon: providerListSvgIcon(resolved.primary.icon),
            title: resolved.tooltipLines.length > 0 ? resolved.tooltipLines.join('\n') : resolved.displayName,
          })
          break
        }
        case 'asn': {
          const asn = providerMetadata?.geo?.asn
          if (!asn)
            break
          items.push({
            key: 'asn',
            value: asn,
            title: (() => {
              const org = providerMetadata?.geo?.org
              if (!org)
                return asn
              const orgLabel = cleanProviderOrg(org)
              return orgLabel ? `${asn}\n${orgLabel}` : asn
            })(),
          })
          break
        }
      }
    }

    return items
  }

  function metadataItemToDisplayTag(item: NodeMetadataItem): NodeDisplayTag {
    if (item.key === 'provider') {
      return {
        key: item.key,
        text: item.value,
        color: '#6366F1',
        icon: item.icon,
        title: item.title ?? item.value,
      }
    }
    if (item.key === 'asn') {
      return {
        key: item.key,
        text: item.value,
        color: '#0EA5E9',
        title: item.title,
      }
    }
    return {
      key: item.key,
      text: item.value,
      color: item.color ?? '#64748B',
      icon: item.icon,
      title: item.title,
    }
  }

  const nodeNetworkItemsByUuid = computed(() => {
    void metadataByUuid.value
    const itemsByUuid: Record<string, NodeMetadataItem[]> = {}
    for (const node of toValue(nodes))
      itemsByUuid[node.uuid] = buildNodeNetworkItems(node)
    return itemsByUuid
  })

  function getNodeNetworkTags(node: NodeData): NodeDisplayTag[] {
    return (nodeNetworkItemsByUuid.value[node.uuid] ?? []).map(item => metadataItemToDisplayTag(item))
  }

  function getNodeExpireTag(node: NodeData): NodeDisplayTag | null {
    if (node.price === 0)
      return null

    const lang = appStore.lang
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    const color = getExpireBadgeColor(status)

    if (status === 'expired') {
      return { key: 'expire', text: lang === 'zh-CN' ? '已过期' : 'Expired', color }
    }
    if (status === 'long_term') {
      return { key: 'expire', text: lang === 'zh-CN' ? '长期' : 'Long-term', color }
    }
    return { key: 'expire', text: lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`, color }
  }

  function getNodeNameSublineTags(node: NodeData): NodeDisplayTag[] {
    const expire = getNodeExpireTag(node)
    return [...getNodeNetworkTags(node), ...(expire ? [expire] : [])]
  }

  function getNodeListColumnTags(node: NodeData): NodeDisplayTag[] {
    const tags: NodeDisplayTag[] = []
    const lang = appStore.lang

    if (node.price !== 0) {
      const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
      tags.push({ key: 'price', text: priceText, color: '#0090FF' })
    }

    for (const [index, tag] of parseTags(node.tags).entries()) {
      tags.push({
        key: `tag-${index}`,
        text: tag.text,
        color: tag.hex,
        title: tag.text,
      })
    }

    return tags
  }

  /** 名称下方最多 3 个：厂商 / ASN / 价格或自定义标签（不含剩余天数，避免与「剩余」列重复） */
  function getNodeNameSublineTagsForRenewal(node: NodeData): NodeDisplayTag[] {
    const merged = [...getNodeNetworkTags(node), ...getNodeListColumnTags(node)]
    return merged.slice(0, 3)
  }

  return {
    getNodeNameSublineTags,
    getNodeNameSublineTagsForRenewal,
    getNodeListColumnTags,
    getNodeNetworkTags,
  }
}
