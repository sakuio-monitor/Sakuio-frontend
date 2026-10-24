import {
  Activity,
  Boxes,
  Cpu,
  Database,
  HardDrive,
  HeartPulse,
  Info,
  Layers,
  MemoryStick,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { fetchPprofSummary, watchPprof, type PprofRuntime, type PprofSummary } from "../api/pprof";
import { LoadingBlock } from "../components/LoadingBlock";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { PageListHeader } from "../components/PageListHeader";
import { formatBytes } from "../utils/unitHelper";
import "../styles/site-settings.css";
import "../styles/pprof.css";

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${rest}s`;
  return `${rest}s`;
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="pprof-metric-card" title={`${label}: ${value}`}>
      <span className="pprof-metric-card__icon">{icon}</span>
      <span className="pprof-metric-card__label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pprof-detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Donut({
  segments,
  center,
  subtitle,
  formatValue = formatBytes,
}: {
  segments: Array<{ label: string; value: number; color: string; detail?: string }>;
  center: string;
  subtitle: string;
  formatValue?: (value: number) => string;
}) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const radius = 42;
  let offset = 0;
  return (
    <div className="pprof-donut-wrap">
      <svg viewBox="0 0 120 120" className="pprof-donut" role="img" aria-label={subtitle}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--glass-border)" strokeWidth="14" />
        {segments.map((segment) => {
          const value = total > 0 ? Math.max(0, segment.value) : 0;
          const percent = total > 0 ? (value / total) * 100 : 0;
          if (percent <= 0) return null;
          const element = (
            <circle
              key={segment.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="14"
              strokeLinecap="butt"
              pathLength={100}
              transform="rotate(-90 60 60)"
              style={{
                strokeDasharray: `${percent} ${100 - percent}`,
                strokeDashoffset: -offset,
                transition: "none",
              }}
            />
          );
          offset += percent;
          return element;
        })}
        <text x="60" y="57" textAnchor="middle" className="pprof-donut__value">
          {center}
        </text>
        <text x="60" y="72" textAnchor="middle" className="pprof-donut__label">
          {subtitle}
        </text>
      </svg>
      <div className="pprof-legend">
        {segments.map((segment) => (
          <div className="pprof-legend__row" key={segment.label}>
            <span className="pprof-legend__dot" style={{ background: segment.color }} />
            <span>
              {segment.label}
              {segment.detail ? <small>{segment.detail}</small> : null}
            </span>
            <strong>{formatValue(segment.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PprofPage() {
  const { t } = useTranslation();
  const [runtime, setRuntime] = useState<PprofRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoPanel, setInfoPanel] = useState<"memory" | "database" | null>(null);
  const runtimeRef = useRef<PprofRuntime | null>(null);

  const applySummary = useCallback((summary: PprofSummary) => {
    runtimeRef.current = summary.runtime;
    setRuntime(summary.runtime);
    setLoading(false);
    setError(null);
  }, []);

  const fallback = useCallback(async () => {
    try {
      applySummary(await fetchPprofSummary());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("common.error"));
      setLoading(false);
    }
  }, [applySummary, t]);

  useEffect(() => {
    let stopped = false;
    const close = watchPprof(
      (summary) => {
        if (!stopped) applySummary(summary);
      },
      () => {
        if (!stopped && !runtimeRef.current) void fallback();
      },
    );
    return () => {
      stopped = true;
      close();
    };
  }, [applySummary, fallback]);

  const rss = runtime?.heap_inuse ?? 0;
  const cpu = Math.min(100, Math.max(0, runtime?.cpu_percent ?? 0));
  const systemOtherCpu = Math.min(100, Math.max(0, runtime?.system_other_cpu_percent ?? 0));
  const cpuIdle = Math.min(100, Math.max(0, runtime?.cpu_idle_percent ?? 0));
  const status = runtime?.status ?? "healthy";
  const pressure = Math.min(100, Math.max(0, runtime?.pressure_percent ?? 0));
  const db = runtime?.database;
  const dbSize = db?.size_bytes ?? 0;
  const memoryItems = runtime
    ? [...runtime.memory.items].sort((left, right) => right.bytes - left.bytes)
    : [];
  const topMemoryItems = memoryItems.slice(0, 4);
  const restMemoryBytes = memoryItems
    .slice(4)
    .reduce((sum, item) => sum + item.bytes, 0);
  const memoryLabels: Record<string, string> = {
    agent_cache: t("admin.pprof.agentCache"),
    websocket: t("admin.pprof.websocket"),
    database: t("admin.pprof.database"),
    thread_stacks: t("admin.pprof.threadStacks"),
    stacks: t("admin.pprof.stacks"),
    heap_other: t("admin.pprof.heapOther"),
    code: t("admin.pprof.code"),
    anonymous: t("admin.pprof.anonymous"),
    file_mappings: t("admin.pprof.fileMappings"),
    other: t("admin.pprof.otherRuntime"),
  };
  const memoryDetail = (key: string, detail: string): string => {
    if (key === "agent_cache") return t("admin.pprof.nodeCount", { count: runtime?.memory.agent_nodes ?? 0 });
    if (key === "websocket") return t("admin.pprof.connectionCount", { count: runtime?.memory.websocket_sessions ?? 0 });
    if (key === "database") return t("admin.pprof.connectionCount", { count: runtime?.memory.database_connections ?? 0 });
    if (key === "thread_stacks" || key === "stacks") {
      return t("admin.pprof.threadStackDetail", { count: runtime?.threads ?? 0 });
    }
    if (key === "heap_other") return t("admin.pprof.heapOtherDetail");
    if (key === "code") return t("admin.pprof.codeDetail");
    if (key === "anonymous") return t("admin.pprof.anonymousDetail");
    if (key === "file_mappings") return t("admin.pprof.fileMappingsDetail");
    return detail === "unclassified" ? "" : detail;
  };

  return (
    <section className="page-container">
      <PageListHeader titleKey="admin.nav.pprof" />

      {error ? <p className="pprof-error">{error}</p> : null}
      {loading && !runtime ? <LoadingBlock label={t("common.loading")} /> : null}

      {runtime ? (
        <>
          <div className={`pprof-health pprof-health--${status}`}>
            <HeartPulse size={20} aria-hidden />
            <div className="pprof-health__text">
              <strong>{t(`admin.pprof.status.${status}`)}</strong>
              <span>{t("admin.pprof.statusHint")}</span>
            </div>
            <div className="pprof-health__pressure">
              <span>{t("admin.pprof.pressure")}</span>
              <strong>{pressure.toFixed(1)}%</strong>
            </div>
            <div className="pprof-health__bar">
              <i style={{ width: `${pressure}%` }} />
            </div>
          </div>

          <div className="pprof-metric-strip">
            <MetricCard
              icon={<Cpu size={18} />}
              label={t("admin.pprof.tasks")}
              value={runtime.tasks.toLocaleString()}
            />
            <MetricCard
              icon={<HardDrive size={18} />}
              label={t("admin.pprof.heapInuse")}
              value={formatBytes(rss)}
            />
            <MetricCard
              icon={<Activity size={18} />}
              label={t("admin.pprof.cpu")}
              value={`${runtime.cpu_percent.toFixed(2)}%`}
            />
            <MetricCard
              icon={<Database size={18} />}
              label={t("admin.pprof.dbSize")}
              value={formatBytes(dbSize)}
            />
          </div>

          <div className="pprof-charts">
            <section className="page-card pprof-chart-card">
              <h3 className="site-settings-card__title">
                <MemoryStick size={16} aria-hidden />
                {t("admin.pprof.memoryTitle")}
                <button
                  type="button"
                  className="pprof-info-btn"
                  aria-label={t("admin.pprof.allItems")}
                  onClick={() => setInfoPanel("memory")}
                >
                  <Info size={15} />
                </button>
              </h3>
              <p className="pprof-description">{t("admin.pprof.memoryDescription")}</p>
              <Donut
                segments={[
                  ...topMemoryItems.map((item, index) => ({
                    label: memoryLabels[item.key] ?? item.key,
                    value: item.bytes,
                    color: ["#1d1d1f", "#4b6b8a", "#8a6a4b", "#b6c0cd"][index] ?? "#d6dde6",
                    detail: memoryDetail(item.key, item.detail),
                  })),
                  ...(restMemoryBytes > 0
                    ? [{
                        label: t("admin.pprof.otherItems"),
                        value: restMemoryBytes,
                        color: "#d6dde6",
                      }]
                    : []),
                ]}
                center={formatBytes(rss)}
                subtitle={t("admin.pprof.rss")}
              />
            </section>

            <section className="page-card pprof-chart-card">
              <h3 className="site-settings-card__title">
                <Activity size={16} aria-hidden />
                {t("admin.pprof.cpuTitle")}
              </h3>
              <p className="pprof-description">{t("admin.pprof.cpuDescription")}</p>
              <Donut
                segments={[
                  { label: t("admin.pprof.cpuProcess"), value: cpu, color: "#1d1d1f" },
                  { label: t("admin.pprof.cpuSystemOther"), value: systemOtherCpu, color: "#8a6a4b" },
                  { label: t("admin.pprof.cpuIdle"), value: cpuIdle, color: "#b6c0cd" },
                ]}
                center={`${(cpu + systemOtherCpu).toFixed(1)}%`}
                subtitle={t("admin.pprof.cpu")}
                formatValue={(value) => `${value.toFixed(1)}%`}
              />
            </section>

            <section className="page-card pprof-chart-card pprof-chart-card--wide">
              <h3 className="site-settings-card__title">
                <Database size={16} aria-hidden />
                {t("admin.pprof.dbTitle")}
                <button
                  type="button"
                  className="pprof-info-btn"
                  aria-label={t("admin.pprof.allItems")}
                  onClick={() => setInfoPanel("database")}
                >
                  <Info size={15} />
                </button>
              </h3>
              <p className="pprof-description">{t("admin.pprof.dbDescription")}</p>
              <Donut
                segments={[
                  {
                    label: t("admin.pprof.dbAudit"),
                    value: db?.audit_logs_bytes ?? 0,
                    color: "#1d1d1f",
                  },
                  {
                    label: t("admin.pprof.dbClients"),
                    value: db?.clients_bytes ?? 0,
                    color: "#4b6b8a",
                  },
                  {
                    label: t("admin.pprof.dbMetrics"),
                    value: db?.metrics_bytes ?? 0,
                    color: "#8a6a4b",
                  },
                  {
                    label: t("admin.pprof.dbOtherTables"),
                    value: db?.other_tables_bytes ?? 0,
                    color: "#b6c0cd",
                  },
                ]}
                center={formatBytes(dbSize)}
                subtitle={t("admin.pprof.dbSize")}
              />
            </section>
          </div>

          <div className="pprof-detail-grid">
            <section className="page-card pprof-detail-card">
              <h3 className="site-settings-card__title">
                <Layers size={16} aria-hidden />
                {t("admin.pprof.runtimeDetails")}
              </h3>
              <div className="pprof-detail-list">
                <DetailRow label="PID" value={String(runtime.pid)} />
                <DetailRow label={t("admin.pprof.heapAlloc")} value={formatBytes(runtime.heap_alloc)} />
                <DetailRow label={t("admin.pprof.heapObjects")} value={runtime.heap_objects.toLocaleString()} />
                <DetailRow label={t("admin.pprof.runtimeSys")} value={formatBytes(runtime.runtime_sys)} />
                <DetailRow label={t("admin.pprof.allocRate")} value={`${formatBytes(runtime.alloc_bytes_per_sec)}/s`} />
                <DetailRow label={t("admin.pprof.workers")} value={runtime.workers.toLocaleString()} />
                <DetailRow label={t("admin.pprof.queueDepth")} value={runtime.queue_depth.toLocaleString()} />
                <DetailRow label={t("admin.pprof.threads")} value={runtime.threads.toLocaleString()} />
                <DetailRow label={t("admin.pprof.uptime")} value={formatDuration(runtime.uptime_secs)} />
              </div>
            </section>

            <section className="page-card pprof-detail-card">
              <h3 className="site-settings-card__title">
                <Boxes size={16} aria-hidden />
                {t("admin.pprof.databaseDetails")}
              </h3>
              <div className="pprof-detail-list">
                <DetailRow label={t("admin.pprof.dbEngine")} value={db?.kind ?? "-"} />
                <DetailRow label={t("admin.pprof.dbWritesPerSec")} value={(db?.writes_per_sec ?? 0).toFixed(1)} />
                <DetailRow label={t("admin.pprof.dbPoolPressure")} value={`${(db?.write_pressure_percent ?? 0).toFixed(1)}%`} />
                <DetailRow
                  label={t("admin.pprof.dbConnections")}
                  value={`${db?.active_connections ?? 0} / ${db?.idle_connections ?? 0} / ${db?.max_connections ?? 0}`}
                />
                <DetailRow
                  label={t("admin.pprof.dbPeakConnections")}
                  value={`${db?.peak_connections ?? 0} / ${db?.max_connections ?? 0}`}
                />
                <DetailRow label={t("admin.pprof.dbQueriesPerSec")} value={(db?.queries_per_sec ?? 0).toFixed(1)} />
                <DetailRow label={t("admin.pprof.dbAudit")} value={formatBytes(db?.audit_logs_bytes ?? 0)} />
                <DetailRow label={t("admin.pprof.dbClients")} value={formatBytes(db?.clients_bytes ?? 0)} />
                <DetailRow label={t("admin.pprof.dbMetrics")} value={formatBytes(db?.metrics_bytes ?? 0)} />
              </div>
            </section>
          </div>
        </>
      ) : null}

      <GenericSidebar
        open={infoPanel !== null}
        title={infoPanel === "memory" ? t("admin.pprof.memoryTitle") : t("admin.pprof.dbTitle")}
        onClose={() => setInfoPanel(null)}
        initialWidth={520}
      >
        <div className="pprof-info-list">
          {infoPanel === "memory"
            ? memoryItems.map((item) => (
                <div className="pprof-info-row" key={item.key}>
                  <span>
                    {memoryLabels[item.key] ?? item.key}
                    <small>{memoryDetail(item.key, item.detail)}</small>
                  </span>
                  <strong>{formatBytes(item.bytes)}</strong>
                </div>
              ))
            : db?.tables.map((table) => (
                <div className="pprof-info-row" key={table.name}>
                  <span>{table.name}</span>
                  <strong>{formatBytes(table.bytes)}</strong>
                </div>
              ))}
        </div>
      </GenericSidebar>
    </section>
  );
}
