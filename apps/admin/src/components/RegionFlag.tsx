import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";

const REGIONAL_INDICATOR_START = 0x1f1e6;
const ASCII_ALPHA_START = 0x41;

function countryCodeFromFlagEmoji(emoji: string): string | null {
  const chars = Array.from(emoji);
  if (chars.length !== 2) {
    return null;
  }
  const codePoint1 = chars[0].codePointAt(0)!;
  const codePoint2 = chars[1].codePointAt(0)!;
  if (
    codePoint1 >= REGIONAL_INDICATOR_START &&
    codePoint1 <= 0x1f1ff &&
    codePoint2 >= REGIONAL_INDICATOR_START &&
    codePoint2 <= 0x1f1ff
  ) {
    const letter1 = String.fromCodePoint(
      codePoint1 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START,
    );
    const letter2 = String.fromCodePoint(
      codePoint2 - REGIONAL_INDICATOR_START + ASCII_ALPHA_START,
    );
    return `${letter1}${letter2}`;
  }
  return null;
}

function resolveFlagFileName(region: string | undefined, ipCode: string | null): string {
  if (ipCode) {
    return ipCode;
  }
  const flag = region?.trim() ?? "";
  if (!flag) {
    return "UN";
  }
  const fromEmoji = countryCodeFromFlagEmoji(flag);
  if (fromEmoji) {
    return fromEmoji;
  }
  if (flag.length === 2 && /^[a-zA-Z]{2}$/.test(flag)) {
    return flag.toUpperCase();
  }
  return "UN";
}

function normalizeCode(code: string | undefined): string | null {
  const trimmed = code?.trim() ?? "";
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
}

type RegionFlagProps = {
  /** 后端统一 GeoIP 缓存解析出的国家代码（节点 IPv4 归属） */
  code?: string;
  /** 旧字段回退：region 值（国家代码或旗帜 emoji） */
  region?: string;
  className?: string;
};

/** 名称列旗帜：使用后端解析好的国家代码，无码回退 region 字段 */
export const RegionFlag = memo(function RegionFlag({
  code,
  region,
  className,
}: RegionFlagProps) {
  const { t } = useTranslation();
  const normalized = normalizeCode(code);
  const fileName = useMemo(
    () => resolveFlagFileName(region, normalized),
    [region, normalized],
  );
  const src = `${import.meta.env.BASE_URL}assets/flags/${fileName}.svg`;
  const alt = t("admin.servers.regionFlagAlt", { code: fileName });

  return (
    <span className={className ?? "admin-region-flag"}>
      <img className="admin-region-flag__img" src={src} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
});

type IpRegionFlagProps = {
  /** 该 IP 归属地的国家代码（v4 行传 region，v6 行传 region6） */
  code?: string;
  /** 回退：节点 region 字段 */
  region?: string;
};

/** 侧栏 IP 行旗帜：直接使用后端解析好的国家代码，无码且无地区时不渲染 */
export const IpRegionFlag = memo(function IpRegionFlag({
  code,
  region,
}: IpRegionFlagProps) {
  const { t } = useTranslation();
  const normalized = normalizeCode(code);
  if (!normalized && !region?.trim()) {
    return null;
  }
  const fileName = resolveFlagFileName(region, normalized);
  const src = `${import.meta.env.BASE_URL}assets/flags/${fileName}.svg`;
  const alt = t("admin.servers.regionFlagAlt", { code: fileName });
  return (
    <span className="admin-info-row__flag" title={alt}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
    </span>
  );
});
