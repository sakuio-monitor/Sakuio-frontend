/**
 * 线路/云/运营商品牌目录（关键词 + ASN）。
 *
 * 静态 SVG 目录规范（与 IkuaiPortal `frontend/public/icons/lines/` 文件名一致）：
 * - `public/images/logo/lines/*.svg` — 列表 ISP 图标，直接 `<img src>`，勿内联生成
 * - `public/images/logo/os/*.svg` — 操作系统 SVG 图标
 * - `public/images/logo/*.{png,webp,ico}` — 无 SVG 的 OS 图标
 * - `public/images/flags/*.svg` — 国旗
 *
 * 项目独有 SVG（参考库无）：akile、cn-broadcast、azure、ibm-cloud 等保留在 lines/
 */

export interface LineProviderDef {
  /** SVG 文件名 */
  file: string
  /** UI 展示名 */
  name: string
  keywords: string[]
  /** 不含 AS 前缀 */
  asns: number[]
}

export function lineProviderIconPath(file: string): string {
  return `/images/logo/lines/${file}`
}

/** 与 IkuaiPortal lineIcons 中 SVG 一一对应（另含 cn-broadcast、akile） */
export const LINE_PROVIDER_CATALOG: LineProviderDef[] = [
  {
    file: 'cn-telecom.svg',
    name: '中国电信',
    keywords: [
      'china telecom',
      'chinanet',
      'chinatelecom',
      'chinatelecom-',
      'chinacache',
      'ctcc',
      'ctg',
      '中国电信',
      '电信',
    ],
    asns: [4134, 4809, 4811, 4812, 4816, 23724, 58466, 58852, 136188],
  },
  {
    file: 'cn-mobile.svg',
    name: '中国移动',
    keywords: ['china mobile', 'china mobile communications', 'cmcc', 'cmi', 'chinamobile', '中国移动', '移动'],
    asns: [9808, 58453, 24547, 56046, 9231],
  },
  {
    file: 'cn-unicom.svg',
    name: '中国联通',
    keywords: ['china unicom', 'unicom', 'cucc', 'cuii', 'chinaunicom', '中国联通', '联通'],
    asns: [4837, 9929, 10099, 63835, 17621, 136958],
  },
  {
    file: 'cn-broadcast.svg',
    name: '中国广电',
    keywords: ['china broadnet', 'cbn', '中国广电', '广电', 'broadcast network', '中国广播电视网络'],
    asns: [58539, 136190, 139587, 140053],
  },
  {
    file: 'aliyun.svg',
    name: '阿里云',
    keywords: ['alibaba', 'aliyun', 'alibabacloud', '阿里云'],
    asns: [45102, 37963, 134963, 59034],
  },
  {
    file: 'tencent-cloud.svg',
    name: '腾讯云',
    keywords: ['tencent', 'qcloud', 'tencent cloud', '腾讯云'],
    asns: [132203, 45090, 132591, 139341],
  },
  {
    file: 'huawei.svg',
    name: '华为云',
    keywords: ['huawei', 'huawei cloud', '华为云'],
    asns: [136907, 55990, 63827],
  },
  {
    file: 'baidu.svg',
    name: '百度智能云',
    keywords: ['baidu', 'baidu cloud', '百度', '百度智能云'],
    asns: [38365, 55967, 134758],
  },
  {
    file: 'volcengine.svg',
    name: '火山引擎',
    keywords: [
      'volcengine',
      'volcano engine',
      'beijing volcano engine',
      'volcano engine technology',
      '火山引擎',
    ],
    asns: [137718],
  },
  {
    file: 'aws.svg',
    name: 'Amazon AWS',
    keywords: ['amazon', 'aws', 'amazon web services'],
    asns: [16509, 14618, 7224, 8987],
  },
  {
    file: 'google-cloud.svg',
    name: 'Google Cloud',
    keywords: ['google cloud', 'google', 'gcp'],
    asns: [15169, 396982, 19527],
  },
  {
    file: 'azure.svg',
    name: 'Microsoft Azure',
    keywords: ['microsoft', 'azure', 'microsoft azure', 'windows azure'],
    asns: [8075, 8068, 8069, 12076, 13399, 16555, 22606, 23468, 35106, 52985],
  },
  {
    file: 'ibm-cloud.svg',
    name: 'IBM Cloud',
    keywords: ['ibm', 'ibm cloud', 'softlayer'],
    asns: [36351, 13884, 12876],
  },
  {
    file: 'oracle.svg',
    name: 'Oracle Cloud',
    keywords: ['oracle', 'oracle cloud'],
    asns: [31898, 14340],
  },
  {
    file: 'digitalocean.svg',
    name: 'DigitalOcean',
    keywords: ['digitalocean', 'digital ocean'],
    asns: [14061, 394362],
  },
  {
    file: 'vultr.svg',
    name: 'Vultr',
    keywords: ['vultr', 'choopa', 'constant'],
    asns: [20473, 64515],
  },
  {
    file: 'akamai.svg',
    name: 'Akamai (Linode)',
    keywords: ['linode', 'akamai', 'akamai technologies'],
    asns: [63949, 16625, 20940, 12222],
  },
  {
    file: 'hetzner.svg',
    name: 'Hetzner',
    keywords: ['hetzner'],
    asns: [24940, 213230],
  },
  {
    file: 'ovh.svg',
    name: 'OVHcloud',
    keywords: ['ovh', 'ovhcloud'],
    asns: [16276, 35540],
  },
  {
    file: 'cloudflare.svg',
    name: 'Cloudflare',
    keywords: ['cloudflare'],
    asns: [13335, 209242],
  },
  {
    file: 'hkbn.svg',
    name: '香港宽频',
    keywords: ['hkbn', 'hong kong broadband', '香港宽频', 'hkbn 香港宽频'],
    asns: [9269, 10103],
  },
  {
    file: 'hgc.svg',
    name: 'HGC 环球全域电讯',
    keywords: ['hgc', 'hutchison', '环球全域'],
    asns: [9304, 3853],
  },
  {
    file: 'hinet.svg',
    name: '中华电信 HiNet',
    keywords: ['hinet', 'chunghwa telecom', '中华电信'],
    asns: [3462, 1659],
  },
  {
    file: 'fareastone.svg',
    name: '远传电信',
    keywords: ['far eastone', 'fareastone', 'fetnet', '远传'],
    asns: [9674],
  },
  {
    file: 'taiwan-mobile.svg',
    name: '台湾大哥大',
    keywords: ['taiwan mobile', 'twm', '台湾大哥大'],
    asns: [24158, 24157],
  },
  {
    file: 'ntt.svg',
    name: 'NTT',
    keywords: ['ntt communications', 'ntt com', 'nippon telegraph'],
    asns: [2914, 4713],
  },
  {
    file: 'ntt-docomo.svg',
    name: 'NTT Docomo',
    keywords: ['ntt docomo', 'docomo'],
    asns: [9605, 2516],
  },
  {
    file: 'au-kddi.svg',
    name: 'KDDI / au',
    keywords: ['kddi', 'au one', 'au-net'],
    asns: [2516, 17676],
  },
  {
    file: 'softbank.svg',
    name: 'SoftBank',
    keywords: ['softbank', 'bbtec', 'softbank corp'],
    asns: [4725, 9381, 17676],
  },
  {
    file: 'rakuten.svg',
    name: 'Rakuten Mobile',
    keywords: ['rakuten', 'rakuten mobile'],
    asns: [138384, 131965, 9824],
  },
  {
    file: 'lg.svg',
    name: 'LG U+',
    keywords: ['lg u+', 'lg uplus', 'lguplus'],
    asns: [17858, 3786],
  },
  {
    file: 'samsung.svg',
    name: 'Samsung',
    keywords: ['samsung', 'samsung sds'],
    asns: [6188],
  },
  {
    file: 'akile.svg',
    name: 'Akile',
    keywords: ['akile', 'akilecloud'],
    asns: [152672, 61112],
  },
]

export function buildLineProviderAsnMap(): Record<string, { name: string, icon: string }> {
  const map: Record<string, { name: string, icon: string }> = {}
  for (const line of LINE_PROVIDER_CATALOG) {
    const info = { name: line.name, icon: lineProviderIconPath(line.file) }
    for (const asn of line.asns)
      map[`AS${asn}`] = info
  }
  return map
}
