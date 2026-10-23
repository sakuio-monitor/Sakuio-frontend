/**
 * Tier-1、教育网、常见家庭宽带等 ISP（关键词 + ASN + Iconify/simple-icons 或线路 SVG）。
 * 与 lineProviderCatalog 互补；ASN 映射后合并，后者可覆盖同号冲突项。
 */

import { lineProviderIconPath } from '@/constants/lineProviderCatalog'

export interface IspProviderDef {
  name: string
  icon: string
  keywords: string[]
  asns: number[]
}

const I = lineProviderIconPath

/** @see https://en.wikipedia.org/wiki/Tier_1_network */
const TIER1_AND_TRANSIT: IspProviderDef[] = [
  { name: 'Cogent', icon: 'simple-icons:cogent', keywords: ['cogent', 'cogent communications', 'psinet'], asns: [174] },
  { name: 'Verizon Business', icon: 'simple-icons:verizon', keywords: ['verizon', 'uunet', 'mci communications'], asns: [701, 702, 703] },
  { name: 'Arelion', icon: 'simple-icons:telia', keywords: ['arelion', 'telia carrier', 'telia company'], asns: [1299] },
  { name: 'GTT', icon: 'tabler:world', keywords: ['gtt', 'gtt communications', 'interoute'], asns: [3257, 3549] },
  { name: 'Lumen', icon: 'simple-icons:lumen', keywords: ['lumen', 'level 3', 'level3', 'centurylink', 'colt'], asns: [3356, 3549] },
  { name: 'Deutsche Telekom', icon: 'simple-icons:deutschetelekom', keywords: ['deutsche telekom', 'dtag', 'telekom'], asns: [3320, 31334] },
  { name: 'Orange', icon: 'simple-icons:orange', keywords: ['orange', 'france telecom', 'ft group'], asns: [5511, 3215] },
  { name: 'PCCW Global', icon: 'tabler:world', keywords: ['pccw global', 'console connect', 'pccw'], asns: [3491, 4760] },
  { name: 'Tata Communications', icon: 'simple-icons:tata', keywords: ['tata communications', 'tata indica'], asns: [6453] },
  { name: 'Zayo', icon: 'tabler:world', keywords: ['zayo', 'zayo bandwidth', 'above net'], asns: [6461] },
  { name: 'Telecom Italia Sparkle', icon: 'simple-icons:tim', keywords: ['telecom italia sparkle', 'ti sparkle', 'seabone', 'sparkle'], asns: [6762, 3269] },
  { name: 'Liberty Global', icon: 'tabler:world', keywords: ['liberty global', 'upc', 'virgin media international'], asns: [6830] },
  { name: 'AT&T', icon: 'simple-icons:att', keywords: ['at t', 'att', 'at&t services'], asns: [7018, 2685] },
  { name: 'Telxius', icon: 'simple-icons:telefonica', keywords: ['telxius', 'telefonica international wholesale'], asns: [12956] },
  { name: 'RETN', icon: 'tabler:world', keywords: ['retn', 'retn.net'], asns: [9002] },
  { name: 'Vodafone', icon: 'simple-icons:vodafone', keywords: ['vodafone', 'cable wireless', 'c w'], asns: [1273, 3209] },
  { name: 'Telstra', icon: 'simple-icons:telstra', keywords: ['telstra', 'telstra internet'], asns: [4637, 1221] },
  { name: 'Singtel', icon: 'simple-icons:singtel', keywords: ['singtel', 'singapore telecommunications', 'singtel ix'], asns: [7473, 45143, 3758] },
  { name: 'Hurricane Electric', icon: 'simple-icons:hurricaneelectric', keywords: ['hurricane electric', 'he.net'], asns: [6939] },
  { name: 'T-Mobile US', icon: 'simple-icons:tmobile', keywords: ['t mobile', 'tmobile', 'sprint'], asns: [1239, 21928] },
]

const CN_EDU_AND_SPECIAL: IspProviderDef[] = [
  { name: 'CERNET', icon: 'tabler:school', keywords: ['cernet', 'china education', 'education and research network', '中国教育和科研计算机网', '教育网'], asns: [4538, 4788, 23910, 23911, 58246, 59067] },
  { name: 'CSTNET', icon: 'tabler:flask', keywords: ['cstnet', 'china science', '科技网'], asns: [7497, 24151] },
  { name: 'CN2', icon: I('cn-telecom.svg'), keywords: ['cn2', 'chinanet cn2', 'telecom cn2'], asns: [4809, 23724] },
]

const HK_MO: IspProviderDef[] = [
  { name: '3HK', icon: 'tabler:antenna-bars-5', keywords: ['3hk', 'three hk', 'hutchison', '和记', '香港和记'], asns: [45474, 45758] },
  { name: 'SmarTone', icon: 'tabler:antenna-bars-5', keywords: ['smartone', 'smart tone', '数码通'], asns: [4515, 10103] },
  { name: 'PCCW', icon: 'tabler:antenna-bars-5', keywords: ['pccw hkt', 'netvigator', '香港电讯'], asns: [4760] },
  { name: 'China Mobile Hong Kong', icon: I('cn-mobile.svg'), keywords: ['china mobile hk', 'cmhk', '中国移动香港'], asns: [9231, 58453] },
]

const JP_BROADBAND: IspProviderDef[] = [
  { name: 'BIGLOBE', icon: 'tabler:antenna-bars-5', keywords: ['biglobe', 'big globe'], asns: [2518, 17506] },
  { name: 'IIJ', icon: 'tabler:antenna-bars-5', keywords: ['iij', 'internet initiative japan'], asns: [2497] },
  { name: 'OCN', icon: 'tabler:antenna-bars-5', keywords: ['ocn', 'ntt communications ocn'], asns: [4713, 7684] },
  { name: 'So-net', icon: 'tabler:antenna-bars-5', keywords: ['so net', 'so-net', 'sony network communications', 'sony network'], asns: [2527] },
  { name: '@nifty', icon: 'tabler:antenna-bars-5', keywords: ['nifty', 'at nifty'], asns: [4694, 2518] },
  { name: 'J:COM', icon: 'tabler:antenna-bars-5', keywords: ['j com', 'jcom', 'jupiter telecommunication'], asns: [9824] },
]

const US_RESIDENTIAL: IspProviderDef[] = [
  { name: 'Comcast', icon: 'simple-icons:comcast', keywords: ['comcast', 'xfinity', 'comcast cable'], asns: [7922, 7992, 33650, 33659] },
  { name: 'Charter / Spectrum', icon: 'simple-icons:charter', keywords: ['charter', 'spectrum', 'charter communications', 'time warner cable'], asns: [11426, 20115, 10796, 33363] },
  { name: 'Cox', icon: 'tabler:antenna-bars-5', keywords: ['cox', 'cox communications'], asns: [22773] },
  { name: 'Frontier', icon: 'tabler:antenna-bars-5', keywords: ['frontier', 'frontier communications'], asns: [5650, 5653] },
  { name: 'Optimum', icon: 'tabler:antenna-bars-5', keywords: ['optimum', 'altice', 'cablevision'], asns: [6128, 11492] },
  { name: 'Google Fiber', icon: 'simple-icons:googlefiber', keywords: ['google fiber'], asns: [16591] },
  { name: 'Windstream', icon: 'tabler:antenna-bars-5', keywords: ['windstream', 'windstream communications'], asns: [7029, 27357] },
  { name: 'Mediacom', icon: 'tabler:antenna-bars-5', keywords: ['mediacom'], asns: [30036] },
  { name: 'CenturyLink Consumer', icon: 'simple-icons:lumen', keywords: ['centurylink consumer', 'qwest'], asns: [209, 11492] },
]

const SG_MY_TH: IspProviderDef[] = [
  { name: 'StarHub', icon: 'tabler:antenna-bars-5', keywords: ['starhub', 'star hub'], asns: [4657, 55430, 10310] },
  { name: 'M1', icon: 'tabler:antenna-bars-5', keywords: ['m1 limited', 'm1 telecom'], asns: [4773, 17547] },
  { name: 'MyRepublic', icon: 'tabler:antenna-bars-5', keywords: ['myrepublic'], asns: [56300, 131445] },
  { name: 'AIS', icon: 'tabler:antenna-bars-5', keywords: ['ais', 'advanced info service'], asns: [131445, 45430] },
  { name: 'TRUE', icon: 'tabler:antenna-bars-5', keywords: ['true internet', 'true corp'], asns: [7470, 132061] },
]

const KR: IspProviderDef[] = [
  { name: 'KT', icon: 'tabler:antenna-bars-5', keywords: ['korea telecom', 'kt telecop', 'kt corp korea', 'kt olleh'], asns: [4766, 9286] },
  { name: 'SK Broadband', icon: 'tabler:antenna-bars-5', keywords: ['sk broadband', 'sk telecom', 'skbroadband'], asns: [9318, 9644, 17858] },
  { name: 'LG U+', icon: I('lg.svg'), keywords: ['lg uplus korea'], asns: [17858] },
  { name: 'SEJONG NETWORKS', icon: 'tabler:antenna-bars-5', keywords: ['sejong networks', 'sejong network'], asns: [9848] },
]

/** Org/ASN 常见 VPS、机房与小 ISP（优先 org 关键词，避免同 ASN 误映射） */
const HOSTING_AND_MISC: IspProviderDef[] = [
  { name: 'Viet Storage', icon: 'tabler:server', keywords: ['viet storage', 'viet storage technology'], asns: [135932] },
  { name: 'cognetcloud', icon: 'tabler:server', keywords: ['cognetcloud', 'cognet cloud'], asns: [401701] },
  { name: 'VH Global', icon: 'tabler:server', keywords: ['vh global'], asns: [42960] },
  { name: 'XNNET', icon: 'tabler:server', keywords: ['xnnet', 'xnnet llc'], asns: [] },
  { name: 'Overland Storage', icon: 'tabler:server', keywords: ['overland storage'], asns: [] },
  { name: 'ColoCrossing', icon: 'tabler:server', keywords: ['colocrossing', 'colo crossing'], asns: [36352, 8100] },
  { name: 'RackNerd', icon: 'tabler:server', keywords: ['racknerd', 'rack nerd'], asns: [] },
  { name: 'HostPapa', icon: 'tabler:server', keywords: ['hostpapa', 'host papa'], asns: [] },
]

const EU_UK: IspProviderDef[] = [
  { name: 'BT', icon: 'simple-icons:bt', keywords: ['british telecom', 'bt group', 'bt internet'], asns: [2856, 5400] },
  { name: 'Virgin Media O2', icon: 'simple-icons:virginmedia', keywords: ['virgin media', 'virgin media o2', 'nntl'], asns: [5089, 5607, 13285] },
  { name: 'Sky UK', icon: 'simple-icons:sky', keywords: ['sky uk', 'sky broadband', 'bskyb'], asns: [5607, 210126] },
  { name: 'Free', icon: 'tabler:antenna-bars-5', keywords: ['free sas', 'free.fr', 'iliad free'], asns: [12322, 6830] },
  { name: 'Telefonica', icon: 'simple-icons:telefonica', keywords: ['telefonica', 'movistar'], asns: [12956, 3352] },
  { name: 'Swisscom', icon: 'simple-icons:swisscom', keywords: ['swisscom'], asns: [3303, 8220] },
  { name: 'KPN', icon: 'simple-icons:kpn', keywords: ['kpn', 'koninklijke kpn'], asns: [1136, 286] },
  { name: 'Proximus', icon: 'tabler:antenna-bars-5', keywords: ['proximus', 'belgacom'], asns: [5432, 6774] },
]

const AU_NZ_CA: IspProviderDef[] = [
  { name: 'TPG Telecom', icon: 'tabler:antenna-bars-5', keywords: ['tpg', 'tpg telecom', 'ii net'], asns: [7545, 4804] },
  { name: 'Optus', icon: 'tabler:antenna-bars-5', keywords: ['optus', 'optus internet'], asns: [4804, 7474] },
  { name: 'Spark NZ', icon: 'tabler:antenna-bars-5', keywords: ['spark nz', 'telecom new zealand'], asns: [4771, 4648] },
  { name: 'Rogers', icon: 'simple-icons:rogers', keywords: ['rogers', 'rogers communications'], asns: [812, 22742] },
  { name: 'Bell Canada', icon: 'simple-icons:bell', keywords: ['bell canada', 'bell mobility'], asns: [577, 6539] },
  { name: 'Telus', icon: 'simple-icons:telus', keywords: ['telus', 'telus communications'], asns: [852, 5769] },
  { name: 'Shaw', icon: 'tabler:antenna-bars-5', keywords: ['shaw', 'shaw communications'], asns: [6327, 11426] },
]

const IN_LATAM: IspProviderDef[] = [
  { name: 'Reliance Jio', icon: 'tabler:antenna-bars-5', keywords: ['reliance jio', 'jio', 'jio infocomm'], asns: [55836, 64049] },
  { name: 'Airtel', icon: 'tabler:antenna-bars-5', keywords: ['airtel', 'bharti airtel'], asns: [9498, 24560] },
  { name: 'Tata Play Fiber', icon: 'simple-icons:tata', keywords: ['tata teleservices', 'tata indicom'], asns: [4755, 17813] },
  { name: 'Claro', icon: 'tabler:antenna-bars-5', keywords: ['claro', 'america movil'], asns: [28573, 27699] },
  { name: 'Vivo', icon: 'tabler:antenna-bars-5', keywords: ['vivo', 'telefonica brasil'], asns: [18881, 26599] },
]

export const ISP_PROVIDER_CATALOG: IspProviderDef[] = [
  ...HOSTING_AND_MISC,
  ...TIER1_AND_TRANSIT,
  ...CN_EDU_AND_SPECIAL,
  ...HK_MO,
  ...JP_BROADBAND,
  ...US_RESIDENTIAL,
  ...SG_MY_TH,
  ...KR,
  ...EU_UK,
  ...AU_NZ_CA,
  ...IN_LATAM,
]

export function buildIspProviderAsnMap(): Record<string, { name: string, icon: string }> {
  const map: Record<string, { name: string, icon: string }> = {}
  for (const isp of ISP_PROVIDER_CATALOG) {
    const info = { name: isp.name, icon: isp.icon }
    for (const asn of isp.asns)
      map[`AS${asn}`] = info
  }
  return map
}

export function buildIspProviderEntries(): Array<{ name: string, icon: string, keywords: string[] }> {
  return ISP_PROVIDER_CATALOG.map(({ name, icon, keywords }) => ({ name, icon, keywords }))
}
