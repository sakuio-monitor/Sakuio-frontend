import { Button, Input, Select, toast } from "@sakuio/ui";
import { Activity, Cpu, Download, HardDrive, Info, MemoryStick, Menu, RotateCcw, Terminal, Trash2 } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { CellTooltip } from "./CellTooltip/CellTooltip";
import { useConfirmDialog } from "./ConfirmDialog/ConfirmDialog";
import { GenericSidebar } from "./GenericSidebar/GenericSidebar";
import { InstallSidebar } from "./InstallSidebar/InstallSidebar";
import { IpRegionFlag } from "./RegionFlag";
import { Tabs } from "./Tabs/Tabs";
import { Switch } from "./ui/Switch";
import { TagSelectInput } from "./ui/TagSelectInput";

export type ServerActionRow = {
  uuid: string;
  name: string;
  /** Agent 令牌（管理端列表返回，用于渲染安装命令） */
  token?: string;
  region?: string;
  region6?: string;
  ipv4: string;
  ipv6: string;
  agent_version?: string | null;
  group_name?: string;
  tags?: string;
  private_remark?: string;
  price?: number;
  billing_cycle?: number;
  currency?: string;
  expired_at?: string | null;
  auto_renewal?: boolean;
  traffic_threshold?: number;
  traffic_stat_mode?: string;
  traffic_used_up?: number;
  traffic_used_down?: number;
  traffic_cycle_start?: string | null;
  traffic_reset_mode?: string;
  bandwidth?: number;
  bandwidth_unit?: string;
  report_interval_ms?: number;
  last_seen_at?: string | null;
  created_at?: string;
  basic_info?: {
    hostname?: string | null;
    cpu_name?: string | null;
    cpu_cores?: number | null;
    cpu_physical_cores?: number | null;
    arch?: string | null;
    os?: string | null;
    kernel_version?: string | null;
    mem_total?: number | null;
    swap_total?: number | null;
    disk_total?: number | null;
    gpu_name?: string | null;
    virtualization?: string | null;
    version?: string | null;
  } | null;
  runtime?: {
    net_total_up?: number | null;
    net_total_down?: number | null;
    disk_used?: number | null;
    disk_total?: number | null;
    uptime_secs?: number | null;
  } | null;
};

type ServerRowActionsProps = {
  row: ServerActionRow;
  /** 全量候选分组（来自当前列表所有行，用于分组选择输入框的实时匹配） */
  groupOptions?: string[];
  /** 全量候选标签（来自当前列表所有行，用于标签选择输入框的实时匹配） */
  tagOptions?: string[];
  onChanged: () => void;
};

type MoreTab = "host" | "edit" | "billing";

/** group_name/tags 以分号分隔存储多个值；兼容历史逗号分组。 */
function splitValues(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatUptime(secs: number | null | undefined): string {
  if (secs == null || secs <= 0) return "—";
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function text(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const s = String(value).trim();
  return s ? s : "—";
}

/** 货币符号候选（存符号本身） */
const CURRENCY_OPTIONS = ["¥", "$", "€", "£", "₽", "₣", "₹", "₫", "฿"];

/** 流量统计方式（与后端 traffic_stat_mode 对应） */
const STAT_MODES: { value: string; labelKey: string }[] = [
  { value: "both", labelKey: "admin.servers.statModeBoth" },
  { value: "max", labelKey: "admin.servers.statModeMax" },
  { value: "min", labelKey: "admin.servers.statModeMin" },
  { value: "up", labelKey: "admin.servers.statModeUp" },
  { value: "down", labelKey: "admin.servers.statModeDown" },
];

/** 流量重置方式（与后端 traffic_reset_mode 对应） */
const RESET_MODES: { value: string; labelKey: string }[] = [
  { value: "cycle", labelKey: "admin.servers.resetModeCycle" },
  { value: "monthly", labelKey: "admin.servers.resetModeMonthly" },
  { value: "never", labelKey: "admin.servers.resetModeNever" },
];

/** 带宽单位（与后端 BANDWIDTH_UNITS 对应） */
const BANDWIDTH_UNITS = ["Kbps", "Mbps", "Gbps", "Tbps"];

/** 流量阈值单位（KB/MB/GB/TB，1KB = 1024 字节） */
const THRESHOLD_UNITS: { unit: string; factor: number }[] = [
  { unit: "KB", factor: 1024 },
  { unit: "MB", factor: 1024 ** 2 },
  { unit: "GB", factor: 1024 ** 3 },
  { unit: "TB", factor: 1024 ** 4 },
];

/** 阈值字节数 → {数值, 单位}（选能容纳的最小数值单位，0 保持 GB 默认） */
function bytesToThreshold(bytes: number | null | undefined): { value: string; unit: string } {
  const raw = bytes ?? 0;
  if (raw <= 0) return { value: "0", unit: "GB" };
  for (let i = THRESHOLD_UNITS.length - 1; i >= 0; i -= 1) {
    const { unit, factor } = THRESHOLD_UNITS[i];
    if (raw >= factor) {
      return { value: String(+(raw / factor).toFixed(2)), unit };
    }
  }
  return { value: String(raw), unit: "KB" };
}

/** {数值, 单位} → 阈值字节数（非法输入返回 0） */
function thresholdToBytes(value: string, unit: string): number {
  const num = parseFloat(value.trim());
  const { factor } = THRESHOLD_UNITS.find((u) => u.unit === unit) ?? THRESHOLD_UNITS[2];
  if (Number.isNaN(num) || num < 0) return 0;
  return Math.round(num * factor);
}

// 服务端时间一律是 UTC；无时区后缀的裸时间戳按 UTC 解析
function parseDbTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  const withTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  const d = withTz ? new Date(s) : new Date(`${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// 按浏览器时区 / 本地习惯显示
function formatDateTime(value: string | null | undefined): string {
  const d = parseDbTime(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ServerRowActions({ row, groupOptions, tagOptions, onChanged }: ServerRowActionsProps) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [moreOpen, setMoreOpen] = useState(false);
  const [tab, setTab] = useState<MoreTab>("host");
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState(row.name);
  const [editGroups, setEditGroups] = useState<string[]>(splitValues(row.group_name));
  const [editTags, setEditTags] = useState<string[]>(splitValues(row.tags));
  const [editRemark, setEditRemark] = useState(row.private_remark ?? "");
  const [editReportInterval, setEditReportInterval] = useState(
    String(row.report_interval_ms ?? 1000),
  );

  const [price, setPrice] = useState(String(row.price ?? 0));
  const [billingCycle, setBillingCycle] = useState(String(row.billing_cycle ?? 0));
  const [currency, setCurrency] = useState(row.currency?.trim() || "$");
  const [expiredAt, setExpiredAt] = useState(row.expired_at?.slice(0, 10) ?? "");
  const [autoRenewal, setAutoRenewal] = useState(row.auto_renewal ?? false);
  const [thresholdValue, setThresholdValue] = useState("0");
  const [thresholdUnit, setThresholdUnit] = useState("GB");
  const [bandwidth, setBandwidth] = useState(String(row.bandwidth ?? 0));
  const [bandwidthUnit, setBandwidthUnit] = useState(row.bandwidth_unit?.trim() || "Mbps");
  const [statMode, setStatMode] = useState(row.traffic_stat_mode?.trim() || "max");
  const [resetMode, setResetMode] = useState(row.traffic_reset_mode?.trim() || "cycle");

  const [installOpen, setInstallOpen] = useState(false);

  const info = row.basic_info;
  const runtime = row.runtime;
  const currencyOptions = useMemo(() => {
    const current = currency.trim();
    const base = CURRENCY_OPTIONS.filter((c) => c !== current);
    return current ? [current, ...base] : base;
  }, [currency]);

  const infoItems: { label: string; value: string; sub?: string; flagCode?: string }[] = [
    { label: t("admin.servers.info.hostname"), value: text(info?.hostname) },
    {
      label: "CPU",
      value: text(info?.cpu_name),
      sub: info?.cpu_cores != null ? `x${info.cpu_cores}` : undefined,
    },
    { label: t("admin.servers.info.arch"), value: text(info?.arch) },
    { label: t("admin.servers.info.gpu"), value: text(info?.gpu_name) },
    {
      label: t("admin.servers.info.os"),
      value: text(info?.os),
      sub: info?.kernel_version ? `${t("admin.servers.info.kernel")}: ${info.kernel_version}` : undefined,
    },
    { label: t("admin.servers.info.virtualization"), value: text(info?.virtualization) },
    { label: t("admin.servers.info.memTotal"), value: formatBytes(info?.mem_total) },
    { label: t("admin.servers.info.swapTotal"), value: formatBytes(info?.swap_total) },
    { label: t("admin.servers.info.diskTotal"), value: formatBytes(info?.disk_total) },
    { label: t("admin.servers.info.agentVersion"), value: text(row.agent_version) },
    {
      label: t("admin.servers.info.ipv4"),
      value: text(row.ipv4),
      flagCode: row.ipv4.trim() ? row.region || undefined : undefined,
    },
    {
      label: t("admin.servers.info.ipv6"),
      value: text(row.ipv6),
      flagCode: row.ipv6.trim() ? row.region6?.trim() || row.region || undefined : undefined,
    },
    { label: t("admin.servers.info.lastSeen"), value: formatDateTime(row.last_seen_at) },
    { label: t("admin.servers.info.createdAt"), value: formatDateTime(row.created_at) },
  ];

  async function patchClient(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/clients/${encodeURIComponent(row.uuid)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(data.message ?? t("common.error"));
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await patchClient({
        name: editName,
        group_name: editGroups.join(";"),
        tags: editTags.join(";"),
        private_remark: editRemark,
        report_interval_ms: Math.max(200, Math.min(3_600_000, Number(editReportInterval) || 1000)),
      });
      toast.success(t("admin.servers.saveSuccess"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function saveBilling() {
    setSaving(true);
    try {
      const priceRaw = price.trim();
      const priceNum = priceRaw === "" ? 0 : parseFloat(priceRaw);
      const cycleRaw = billingCycle.trim();
      const cycleNum = cycleRaw === "" ? 0 : parseInt(cycleRaw, 10);
      const thresholdRaw = thresholdValue.trim();
      const thresholdNum = thresholdToBytes(thresholdRaw, thresholdUnit);
      const bandwidthNum = bandwidth.trim() === "" ? 0 : parseFloat(bandwidth.trim());
      if (Number.isNaN(priceNum) || priceNum < -1) {
        toast.error(t("admin.servers.invalidPrice"));
        return;
      }
      if (Number.isNaN(cycleNum) || cycleNum < -1) {
        toast.error(t("admin.servers.invalidBillingCycle"));
        return;
      }
      if (Number.isNaN(bandwidthNum) || bandwidthNum < 0) {
        toast.error(t("admin.servers.invalidBandwidth"));
        return;
      }
      await patchClient({
        price: priceNum,
        billing_cycle: cycleNum,
        currency,
        expired_at: expiredAt.trim(),
        auto_renewal: autoRenewal,
        traffic_threshold: thresholdNum,
        traffic_stat_mode: statMode,
        traffic_reset_mode: resetMode,
        bandwidth: Number.isNaN(bandwidthNum) ? 0 : bandwidthNum,
        bandwidth_unit: bandwidthUnit,
      });
      toast.success(t("admin.servers.saveSuccess"));
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function removeServer() {
    confirm({
      title: t("admin.servers.deleteConfirm", { name: row.name }),
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/clients/${encodeURIComponent(row.uuid)}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { message?: string };
            throw new Error(data.message ?? t("common.error"));
          }
          toast.success(t("admin.servers.deleteSuccess"));
          onChanged();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("common.error"));
        }
      },
    });
  }

  function openTerminal() {
    const url = `${import.meta.env.BASE_URL}terminal?uuid=${encodeURIComponent(row.uuid)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openMore() {
    setEditName(row.name);
    setEditGroups(splitValues(row.group_name));
    setEditTags(splitValues(row.tags));
    setEditRemark(row.private_remark ?? "");
    setPrice(String(row.price ?? 0));
    setBillingCycle(String(row.billing_cycle ?? 0));
    setCurrency(row.currency?.trim() || "$");
    setExpiredAt(row.expired_at?.slice(0, 10) ?? "");
    setAutoRenewal(row.auto_renewal ?? false);
    const threshold = bytesToThreshold(row.traffic_threshold);
    setThresholdValue(threshold.value);
    setThresholdUnit(threshold.unit);
    setBandwidth(String(row.bandwidth ?? 0));
    setBandwidthUnit(row.bandwidth_unit?.trim() || "Mbps");
    setStatMode(row.traffic_stat_mode?.trim() || "max");
    setResetMode(row.traffic_reset_mode?.trim() || "cycle");
    setTab("host");
    setMoreOpen(true);
  }

  function resetTraffic() {
    confirm({
      title: t("admin.servers.resetTrafficConfirm", { name: row.name }),
      onConfirm: async () => {
        try {
          const res = await fetch(
            `/api/admin/clients/${encodeURIComponent(row.uuid)}/reset-traffic`,
            { method: "POST" },
          );
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { message?: string };
            throw new Error(data.message ?? t("common.error"));
          }
          toast.success(t("admin.servers.resetTrafficSuccess"));
          onChanged();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("common.error"));
        }
      },
    });
  }

  return (
    <>
      <div className="data-table-actions data-table-actions--icons">
        {confirmDialog}
        <CellTooltip tip={t("admin.servers.terminal")}>
          <button
            type="button"
            className="data-table-icon-btn"
            aria-label={t("admin.servers.terminal")}
            onClick={openTerminal}
          >
            <Terminal size={18} aria-hidden />
          </button>
        </CellTooltip>
        <CellTooltip tip={t("admin.servers.install")}>
          <button
            type="button"
            className="data-table-icon-btn"
            aria-label={t("admin.servers.install")}
            onClick={() => setInstallOpen(true)}
          >
            <Download size={18} aria-hidden />
          </button>
        </CellTooltip>
        <CellTooltip tip={t("common.more")}>
          <button
            type="button"
            className="data-table-icon-btn"
            aria-label={t("common.more")}
            onClick={openMore}
          >
            <Menu size={18} aria-hidden />
          </button>
        </CellTooltip>
        <CellTooltip tip={t("common.delete")}>
          <button
            type="button"
            className="data-table-icon-btn data-table-icon-btn--danger"
            aria-label={t("common.delete")}
            onClick={() => void removeServer()}
          >
            <Trash2 size={18} aria-hidden />
          </button>
        </CellTooltip>
      </div>

      <GenericSidebar
        open={moreOpen}
        title={`${t("common.more")} - ${row.name}`}
        onClose={() => setMoreOpen(false)}
      >
        <Tabs
          items={[
            { id: "host", label: t("admin.servers.tabHost") },
            { id: "edit", label: t("admin.servers.tabEdit") },
            { id: "billing", label: t("admin.servers.tabBilling") },
          ]}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
          stretch
        />

        {tab === "host" ? (
          <div className="admin-sidebar-form">
            <div className="admin-metric-cards">
              <div className="admin-metric-card">
                <div className="admin-metric-card__label">
                  <Cpu size={14} aria-hidden />
                  CPU
                </div>
                <div className="admin-metric-card__value" title={text(info?.cpu_name)}>
                  {text(info?.cpu_name)}
                </div>
                <div className="admin-metric-card__sub">
                  {info?.cpu_cores != null
                    ? [
                        t("admin.servers.coresLogical", { n: info.cpu_cores }),
                        info?.cpu_physical_cores
                          ? t("admin.servers.coresPhysical", { n: info.cpu_physical_cores })
                          : null,
                      ]
                          .filter(Boolean)
                          .join(" / ")
                    : "—"}
                </div>
              </div>
              <div className="admin-metric-card">
                <div className="admin-metric-card__label">
                  <MemoryStick size={14} aria-hidden />
                  RAM
                </div>
                <div className="admin-metric-card__value">{formatBytes(info?.mem_total)}</div>
                <div className="admin-metric-card__sub">
                  {t("admin.servers.swap")} {formatBytes(info?.swap_total)}
                </div>
              </div>
              <div className="admin-metric-card">
                <div className="admin-metric-card__label">
                  <HardDrive size={14} aria-hidden />
                  DISK
                </div>
                <div className="admin-metric-card__value">{formatBytes(info?.disk_total)}</div>
                <div className="admin-metric-card__sub">
                  {t("admin.servers.installed")} {formatBytes(runtime?.disk_used)}
                </div>
              </div>
              <div className="admin-metric-card">
                <div className="admin-metric-card__label">
                  <Activity size={14} aria-hidden />
                  {t("admin.servers.runtimeStatus")}
                </div>
                <div className="admin-metric-card__value">{formatUptime(runtime?.uptime_secs)}</div>
                <div className="admin-metric-card__sub">
                  {t("admin.servers.info.lastSeen")} {formatDateTime(row.last_seen_at)}
                </div>
              </div>
            </div>
            <h3 className="admin-info-section-title">{t("admin.servers.systemOverview")}</h3>
            <div className="admin-info-rows">
              {infoItems.map((item) => (
                <div key={item.label} className="admin-info-row">
                  <div className="admin-info-row__label">{item.label}</div>
                  <div className="admin-info-row__value">
                    {item.flagCode ? <IpRegionFlag code={item.flagCode} region={row.region} /> : null}
                    <div className="admin-info-row__value-text">
                      {item.value}
                      {item.sub ? <div className="admin-info-row__sub">{item.sub}</div> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "edit" ? (
          <div className="admin-sidebar-form">
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.name")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.name")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                aria-label={t("admin.servers.name")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.group")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.group")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <TagSelectInput
                value={editGroups}
                onChange={setEditGroups}
                suggestions={groupOptions}
                placeholder={t("admin.servers.groupPlaceholder")}
                inputAriaLabel={t("admin.servers.group")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.tags")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.tags")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <TagSelectInput
                value={editTags}
                onChange={setEditTags}
                suggestions={tagOptions}
                placeholder={t("admin.servers.tagsPlaceholder")}
                inputAriaLabel={t("admin.servers.tags")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.privateRemark")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.privateRemark")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Input
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                aria-label={t("admin.servers.privateRemark")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.reportInterval")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.reportInterval")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Input
                type="number"
                min={200}
                max={3600000}
                value={editReportInterval}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEditReportInterval(e.target.value)
                }
                aria-label={t("admin.servers.reportInterval")}
              />
            </label>
            <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdit()}>
              {t("common.save")}
            </Button>
          </div>
        ) : null}

        {tab === "billing" ? (
          <div className="admin-sidebar-form">
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.price")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.price")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder={t("admin.servers.pricePlaceholder")}
                aria-label={t("admin.servers.price")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.billingCycle")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.billingCycle")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Input
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                inputMode="numeric"
                placeholder={t("admin.servers.billingCyclePlaceholder")}
                aria-label={t("admin.servers.billingCycle")}
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.servers.currency")}
              <Select
                value={currency}
                onChange={(v) => setCurrency(String(v))}
                options={currencyOptions.map((c) => ({ value: c, label: c }))}
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.servers.expiredAt")}
              <Input
                type="date"
                value={expiredAt}
                onChange={(e) => setExpiredAt(e.target.value)}
                aria-label={t("admin.servers.expiredAt")}
              />
            </label>
            <div className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.autoRenewal")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.autoRenewal")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Switch
                checked={autoRenewal}
                label={t("admin.servers.autoRenewal")}
                onChange={setAutoRenewal}
              />
            </div>

            <h3 className="admin-info-section-title">{t("admin.servers.trafficSection")}</h3>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.bandwidth")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.bandwidth")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <div className="admin-field-row">
                <Input
                  value={bandwidth}
                  onChange={(e) => setBandwidth(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={t("admin.servers.bandwidth")}
                />
                <div className="admin-field-row__unit">
                  <Select
                    value={bandwidthUnit}
                    onChange={(v) => setBandwidthUnit(String(v))}
                    options={BANDWIDTH_UNITS.map((u) => ({ value: u, label: u }))}
                  />
                </div>
              </div>
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.trafficThreshold")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.trafficThreshold")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <div className="admin-field-row">
                <Input
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  aria-label={t("admin.servers.trafficThreshold")}
                />
                <div className="admin-field-row__unit">
                  <Select
                    value={thresholdUnit}
                    onChange={(v) => setThresholdUnit(String(v))}
                    options={THRESHOLD_UNITS.map((u) => ({ value: u.unit, label: u.unit }))}
                  />
                </div>
              </div>
              <span className="admin-metric-card__sub">
                {(row.traffic_threshold ?? 0) > 0
                  ? `${t("admin.servers.trafficCurrentThreshold")} ${formatBytes(row.traffic_threshold)}`
                  : t("admin.servers.trafficThresholdOff")}
              </span>
            </label>
            <label className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.servers.trafficResetMode")}
                <CellTooltip
                  tip={t("admin.servers.fieldHelp.trafficReset")}
                  className="admin-field-info"
                >
                  <Info size={14} aria-hidden />
                </CellTooltip>
              </span>
              <Select
                value={resetMode}
                onChange={(v) => setResetMode(String(v))}
                options={RESET_MODES.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.servers.statMode")}
              <Select
                value={statMode}
                onChange={(v) => setStatMode(String(v))}
                options={STAT_MODES.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
              />
            </label>
            <Button type="button" size="sm" variant="ghost" onClick={() => void resetTraffic()}>
              <RotateCcw size={14} aria-hidden />
              {t("admin.servers.resetTraffic")}
            </Button>

            <Button type="button" size="sm" disabled={saving} onClick={() => void saveBilling()}>
              {t("common.save")}
            </Button>
          </div>
        ) : null}
      </GenericSidebar>

      <InstallSidebar
        open={installOpen}
        onClose={() => setInstallOpen(false)}
        token={row.token ?? ""}
        name={row.name}
      />
    </>
  );
}
