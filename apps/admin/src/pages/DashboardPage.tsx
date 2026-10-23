import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Select } from "@sakuio/ui";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Cpu,
  Database,
  GripVertical,
  HardDrive,
  Info,
  LayoutDashboard,
  List,
  MemoryStick,
  Plus,
  RotateCcw,
  Server,
  Settings2,
  Terminal,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  DASHBOARD_WIDGETS,
  defaultDashboardLayout,
  fetchDashboard,
  fetchDashboardLayout,
  saveDashboardLayout,
  watchDashboardLive,
  type DashboardData,
  type DashboardQualityItem,
  type DashboardRange,
  type DashboardWidgetId,
  type DashboardWidgetLayout,
} from "../api/dashboard";
import { LoadingBlock } from "../components/LoadingBlock";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { PageListHeader } from "../components/PageListHeader";
import { formatBytes } from "../utils/unitHelper";
import "../styles/dashboard.css";

const RANGES: DashboardRange[] = ["24h", "7d", "30d", "90d", "365d"];
const WIDTHS = ["compact", "wide", "full"] as const;
const HEIGHTS = ["short", "normal", "tall"] as const;
const LIMITS = [2, 3, 4, 5, 8, 10];
const DAY_MS = 24 * 3600 * 1000;

type RankDetail = {
  title: string;
  kind: "cpu" | "memory" | "traffic";
  items: Array<{ name: string; value: number; peak?: number; peakTime?: number; sub?: string }>;
};

const WIDGET_ICONS: Record<DashboardWidgetId, ReactNode> = {
  overview: <LayoutDashboard size={15} />,
  database: <Database size={15} />,
  expiry: <CalendarClock size={15} />,
  traffic: <ChartNoAxesCombined size={15} />,
  traffic_top: <List size={15} />,
  cpu: <Cpu size={15} />,
  memory: <MemoryStick size={15} />,
  ping: <Wifi size={15} />,
  resources: <Server size={15} />,
  disk: <HardDrive size={15} />,
  shortcuts: <Terminal size={15} />,
};

function formatSpeed(bytes: number): string {
  if (!bytes) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index >= 2 && value < 100 ? 2 : 0)} ${units[index]}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatPeakTime(ms: number): string {
  if (!ms) return "-";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (ms >= today) return `今天 ${time}`;
  if (ms >= today - DAY_MS) return `昨天 ${time}`;
  return `${formatDate(date.toISOString())} ${time}`;
}

function OverviewRing({ percent }: { percent: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <svg viewBox="0 0 112 112" className="dash-ring" aria-hidden>
      <circle cx="56" cy="56" r={radius} fill="none" stroke="var(--glass-border)" strokeWidth="10" />
      <circle
        cx="56"
        cy="56"
        r={radius}
        fill="none"
        stroke={value >= 100 ? "#22c55e" : value >= 75 ? "#f59e0b" : "#ef4444"}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * circumference} ${circumference}`}
        transform="rotate(-90 56 56)"
      />
      <text x="56" y="57" textAnchor="middle" className="dash-ring__value">{value.toFixed(0)}%</text>
      <text x="56" y="73" textAnchor="middle" className="dash-ring__label">在线</text>
    </svg>
  );
}

function chartTime(ms: number, range: string, spanMs: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  if (range === "24h" || (range === "custom" && spanMs <= 2 * 86400000)) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (range === "7d" || range === "30d" || (range === "custom" && spanMs <= 90 * 86400000)) {
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  }
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}`;
}

function TrafficChart({ data }: { data: DashboardData }) {
  const points = data.traffic.points;
  const width = 620;
  const height = 230;
  const padLeft = 64;
  const padRight = 58;
  const padTop = 14;
  const padBottom = 30;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const maxRate = Math.max(1, ...points.flatMap((point) => [point.up_rate, point.down_rate]));
  const maxCum = Math.max(1, ...points.flatMap((point) => [point.up_cum, point.down_cum]));
  const x = (index: number) =>
    points.length <= 1 ? padLeft : padLeft + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => padTop + plotHeight - (value / maxRate) * plotHeight;
  const yCum = (value: number) => padTop + plotHeight - (value / maxCum) * plotHeight;
  const line = (key: "up_rate" | "down_rate") =>
    points.map((point, index) => `${x(index)},${y(point[key])}`).join(" ");
  const cumLine = (key: "up_cum" | "down_cum") =>
    points.map((point, index) => `${x(index)},${yCum(point[key])}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const tickCount = Math.min(7, points.length);
  const xTicks = points.length > 1
    ? [...new Set(Array.from({ length: tickCount }, (_, index) =>
        Math.round((index / (tickCount - 1)) * (points.length - 1)),
      ))]
    : points.length === 1 ? [0] : [];
  return (
    <div className="dash-traffic">
      <div className="dash-traffic__legend">
        <span><i className="dash-dot dash-dot--up" />上传 {formatSpeed(points.at(-1)?.up_rate ?? 0)}</span>
        <span><i className="dash-dot dash-dot--down" />下载 {formatSpeed(points.at(-1)?.down_rate ?? 0)}</span>
        <span className="dash-traffic__total">累计 ↑ {formatBytes(data.traffic.total_up)} ↓ {formatBytes(data.traffic.total_down)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="dash-traffic__svg" role="img">
        {yTicks.map((ratio) => {
          const yy = padTop + plotHeight - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={yy}
                y2={yy}
                stroke="var(--glass-border)"
                strokeDasharray={ratio === 0 ? undefined : "4 6"}
              />
              <text x={padLeft - 8} y={yy + 3} textAnchor="end">
                {formatSpeed(maxRate * ratio)}
              </text>
            </g>
          );
        })}
        {yTicks.map((ratio) => (
          <text
            key={`cum-${ratio}`}
            x={width - padRight + 8}
            y={padTop + plotHeight - ratio * plotHeight + 3}
            textAnchor="start"
          >
            {formatBytes(maxCum * ratio)}
          </text>
        ))}
        {points.length > 1 ? (
          <>
            <polygon
              points={`${padLeft},${padTop + plotHeight} ${line("up_rate")} ${width - padRight},${padTop + plotHeight}`}
              fill="rgba(34, 197, 94, 0.08)"
            />
            <polygon
              points={`${padLeft},${padTop + plotHeight} ${line("down_rate")} ${width - padRight},${padTop + plotHeight}`}
              fill="rgba(59, 130, 246, 0.08)"
            />
            <polyline points={line("up_rate")} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinejoin="round" />
            <polyline points={line("down_rate")} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" />
            <polyline points={cumLine("up_cum")} fill="none" stroke="#22c55e" strokeWidth="1.3" strokeDasharray="6 4" opacity=".7" />
            <polyline points={cumLine("down_cum")} fill="none" stroke="#3b82f6" strokeWidth="1.3" strokeDasharray="6 4" opacity=".7" />
          </>
        ) : null}
        {xTicks.map((index) => (
          <text
            key={`x-${index}`}
            x={x(index)}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          >
            {chartTime(
              points[index].time,
              data.range,
              points.length > 1 ? points[points.length - 1].time - points[0].time : 0,
            )}
          </text>
        ))}
      </svg>
    </div>
  );
}

function TrafficTop({ data, limit, onMore }: { data: DashboardData; limit: number; onMore?: () => void }) {
  const items = data.traffic.top.slice(0, limit);
  const max = Math.max(1, ...items.map((item) => item.total));
  if (items.length === 0) return <p className="dash-empty">暂无流量数据</p>;
  return (
    <div className="dash-traffic-top">
      <div className="dash-section-head">
        <strong>流量消耗 Top {limit}</strong>
        {data.traffic.top.length > limit && onMore ? (
          <button type="button" className="dash-more-btn" onClick={onMore}>全部</button>
        ) : null}
      </div>
      {items.map((item, index) => (
        <div className="dash-traffic-top__item" key={item.uuid}>
          <div className="dash-traffic-top__name">
            <span>{index + 1}.</span>
            <strong title={item.name}>{item.name}</strong>
          </div>
          <div className="dash-traffic-top__flow">
            <span>↑ {formatBytes(item.up)}</span>
            <span>↓ {formatBytes(item.down)}</span>
          </div>
          <div className="dash-rank-bar">
            <i style={{ width: `${(item.total / max) * 100}%` }} />
          </div>
          <small>
            峰值 {formatSpeed(item.peak_rate)}
            {item.peak_time ? ` at ${formatPeakTime(item.peak_time)}` : ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function RankList({
  items,
  limit,
  kind,
  onMore,
}: {
  items: Array<{ name: string; value: number; peak?: number; peakTime?: number; sub?: string }>;
  limit: number;
  kind: "cpu" | "memory" | "traffic" | "disk" | "ping";
  onMore?: () => void;
}) {
  if (items.length === 0) return <p className="dash-empty">暂无数据</p>;
  const visible = items.slice(0, limit);
  const maxValue = Math.max(
    1,
    ...visible.map((item) => item.value),
    kind === "cpu" || kind === "memory" || kind === "disk" ? 100 : 1,
  );
  return (
    <div className="dash-rank-list">
      {visible.map((item, index) => {
        const percent = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
        const tone = kind === "cpu" || kind === "memory"
          ? item.value >= 80 ? "red" : item.value >= 60 ? "amber" : "green"
          : kind === "disk"
            ? item.value >= 90 ? "red" : item.value >= 75 ? "amber" : "green"
            : "neutral";
        return (
          <div className="dash-rank-item" key={`${item.name}-${index}`}>
            <div className="dash-rank-row">
              <span className="dash-rank-index">{index + 1}</span>
              <span className="dash-rank-name" title={item.name}>{item.name}</span>
              <strong className={`dash-tone-${tone}`}>
                {kind === "cpu" || kind === "memory" ? `${item.value.toFixed(1)}%` : null}
                {kind === "traffic" ? formatBytes(item.value) : null}
                {kind === "disk" ? `${item.value.toFixed(1)}%` : null}
                {kind === "ping" ? item.sub : null}
              </strong>
            </div>
            {kind !== "ping" ? (
              <div className="dash-rank-bar">
                <i style={{ width: `${percent}%` }} className={`dash-rank-bar--${kind} dash-fill-${tone}`} />
              </div>
            ) : null}
            {kind !== "ping" && item.peak !== undefined ? (
              <small className="dash-rank-peak">
                峰值{" "}
                {kind === "cpu" || kind === "memory"
                  ? `${item.peak.toFixed(1)}%`
                  : kind === "traffic"
                    ? formatSpeed(item.peak)
                    : item.sub ?? formatBytes(item.peak)}
                {item.peakTime ? ` at ${formatPeakTime(item.peakTime)}` : ""}
              </small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function latencyTone(value: number): "green" | "amber" | "red" {
  return value < 100 ? "green" : value <= 280 ? "amber" : "red";
}

function volatilityTone(value: number): "green" | "amber" | "red" {
  return value < 0.3 ? "green" : value <= 1 ? "amber" : "red";
}

function PingColumn({
  title,
  items,
  limit,
  mode,
  onSelect,
}: {
  title: string;
  items: DashboardQualityItem[];
  limit: number;
  mode: "latency" | "loss";
  onSelect: (item: DashboardQualityItem) => void;
}) {
  return (
    <div className="dash-ping-column">
      <strong>{title}</strong>
      {items.length === 0 ? <p className="dash-empty">暂无数据</p> : items.slice(0, limit).map((item) => (
        <button
          type="button"
          className="dash-ping-row"
          key={`${item.task_id}-${item.uuid}`}
          onClick={() => onSelect(item)}
        >
          <span className="dash-ping-row__text">
            <strong>{item.name || item.uuid.slice(0, 8)}</strong>
            <small>{item.task_name}</small>
          </span>
          {mode === "latency" ? (
            <span className="dash-ping-row__value">
              <strong className={`dash-tone-${latencyTone(item.p95)}`}>
                {item.p95 > 0 ? `${Math.round(item.p95)} ms` : "-"}
              </strong>
              <small className={`dash-tone-${volatilityTone(item.volatility)}`}>
                波动 {item.volatility.toFixed(2)}
              </small>
            </span>
          ) : (
            <span className="dash-ping-row__value">
              <strong className={`dash-tone-${item.loss >= 100 ? "red" : item.loss > 0 ? "amber" : "green"}`}>
                {item.loss.toFixed(1)}%
              </strong>
              <small>{item.valid ?? 0} 有效样本</small>
            </span>
          )}
          <ChevronRight size={14} />
        </button>
      ))}
    </div>
  );
}

function SortableWidget({
  item,
  editing,
  title,
  onRemove,
  onPatch,
  children,
}: {
  item: DashboardWidgetLayout;
  editing: boolean;
  title: string;
  onRemove: () => void;
  onPatch: (patch: Partial<DashboardWidgetLayout>) => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editing,
  });
  return (
    <section
      ref={setNodeRef}
      className={`dash-widget dash-widget--${item.width} dash-widget--${item.height}${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {editing ? (
        <div className="dash-widget__tools">
          <button ref={setActivatorNodeRef} type="button" className="dash-icon-btn" aria-label="拖动" {...attributes} {...listeners}>
            <GripVertical size={15} />
          </button>
          <span>{title}</span>
          <select value={item.width} onChange={(event) => onPatch({ width: event.target.value as DashboardWidgetLayout["width"] })}>
            {WIDTHS.map((width) => <option key={width} value={width}>{width}</option>)}
          </select>
          <select value={item.height} onChange={(event) => onPatch({ height: event.target.value as DashboardWidgetLayout["height"] })}>
            {HEIGHTS.map((height) => <option key={height} value={height}>{height}</option>)}
          </select>
          <select value={item.limit} onChange={(event) => onPatch({ limit: Number(event.target.value) })}>
            {LIMITS.map((limit) => <option key={limit} value={limit}>{limit}</option>)}
          </select>
          <button type="button" className="dash-icon-btn" aria-label="隐藏" onClick={onRemove}><X size={15} /></button>
        </div>
      ) : (
        <div className="dash-widget__header">
          {WIDGET_ICONS[item.id]}
          <strong>{title}</strong>
        </div>
      )}
      <div className="dash-widget__body">{children}</div>
    </section>
  );
}

function DashboardBoard({
  layout,
  editing,
  setLayout,
  titles,
  data,
  onPingSelect,
  onRankMore,
}: {
  layout: DashboardWidgetLayout[];
  editing: boolean;
  setLayout: (layout: DashboardWidgetLayout[]) => void;
  titles: Record<DashboardWidgetId, string>;
  data: DashboardData;
  onPingSelect: (item: DashboardQualityItem) => void;
  onRankMore: (detail: RankDetail) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = layout.findIndex((item) => item.id === event.active.id);
    const newIndex = layout.findIndex((item) => item.id === event.over!.id);
    if (oldIndex >= 0 && newIndex >= 0) setLayout(arrayMove(layout, oldIndex, newIndex));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={layout.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="dash-grid">
          {layout.map((item) => (
            <SortableWidget
              key={item.id}
              item={item}
              editing={editing}
              title={titles[item.id]}
              onRemove={() => setLayout(layout.filter((entry) => entry.id !== item.id))}
              onPatch={(patch) => setLayout(layout.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry))}
            >
              <WidgetContent id={item.id} data={data} limit={item.limit} onPingSelect={onPingSelect} onRankMore={onRankMore} />
            </SortableWidget>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function WidgetContent({
  id,
  data,
  limit,
  onPingSelect,
  onRankMore,
}: {
  id: DashboardWidgetId;
  data: DashboardData;
  limit: number;
  onPingSelect: (item: DashboardQualityItem) => void;
  onRankMore: (detail: RankDetail) => void;
}) {
  const { t } = useTranslation();
  switch (id) {
    case "overview":
      return (
        <div className="dash-overview">
          <OverviewRing percent={data.overview.online_percent} />
          <div>
            <strong>{data.overview.online_percent >= 100 ? "全部在线" : data.overview.online_percent >= 75 ? "部分服务器离线" : "集群异常"}</strong>
            <p>在线 {data.overview.online}/{data.overview.total} 台</p>
            <p className={data.overview.offline ? "dash-danger" : "dash-muted"}>离线 {data.overview.offline} 台</p>
          </div>
        </div>
      );
    case "database":
      return (
        <div className="dash-kv-list">
          <div><span>主数据库</span><strong>{formatBytes(data.database.main_bytes)}</strong></div>
          <div><span>监控数据库</span><strong>{formatBytes(data.database.metrics_bytes)}</strong></div>
          <div className="dash-kv-total"><span>合计</span><strong>{formatBytes(data.database.total_bytes)}</strong></div>
        </div>
      );
    case "expiry":
      return data.expiry.length === 0 ? <p className="dash-empty">暂无即将到期服务器</p> : (
        <div className="dash-rank-list">
          {data.expiry.slice(0, limit).map((item) => (
            <div className="dash-rank-row" key={item.uuid}>
              <span className="dash-rank-name">{item.name}</span>
              <strong>{formatDate(item.expired_at)} <em>{item.days_left} 天</em></strong>
            </div>
          ))}
        </div>
      );
    case "traffic":
      return (
        <div className="dash-traffic-shell">
          <TrafficChart data={data} />
          <TrafficTop
            data={data}
            limit={limit}
            onMore={() => onRankMore({
              title: "流量消耗排行",
              kind: "traffic",
              items: data.traffic.top.map((item) => ({
                name: item.name,
                value: item.total,
                peak: item.peak_rate,
                peakTime: item.peak_time,
              })),
            })}
          />
        </div>
      );
    case "traffic_top":
      return <RankList kind="traffic" limit={limit} items={data.traffic.top.map((item) => ({ name: item.name, value: item.total, sub: formatSpeed(item.peak_rate) }))} />;
    case "cpu":
      return (
        <RankList
          kind="cpu"
          limit={limit}
          items={data.rankings.cpu.map((item) => ({ name: item.name, value: item.value, peak: item.peak, peakTime: item.peak_time }))}
          onMore={() => onRankMore({
            title: "CPU 使用排行",
            kind: "cpu",
            items: data.rankings.cpu.map((item) => ({ name: item.name, value: item.value, peak: item.peak, peakTime: item.peak_time })),
          })}
        />
      );
    case "memory":
      return (
        <RankList
          kind="memory"
          limit={limit}
          items={data.rankings.memory.map((item) => ({ name: item.name, value: item.value, peak: item.peak, peakTime: item.peak_time }))}
          onMore={() => onRankMore({
            title: "内存使用排行",
            kind: "memory",
            items: data.rankings.memory.map((item) => ({ name: item.name, value: item.value, peak: item.peak, peakTime: item.peak_time })),
          })}
        />
      );
    case "ping":
      return (
        <div className="dash-ping-grid">
          <PingColumn title="延迟最稳定" items={data.ping_quality.stable} limit={limit} mode="latency" onSelect={onPingSelect} />
          <PingColumn title="延迟最不稳定" items={data.ping_quality.unstable} limit={limit} mode="latency" onSelect={onPingSelect} />
          <PingColumn title="丢包最高" items={data.ping_quality.loss} limit={limit} mode="loss" onSelect={onPingSelect} />
        </div>
      );
    case "resources":
      return (
        <div className="dash-kv-list">
          <div><span>CPU 核心</span><strong>{data.capacity.cpu_cores.toLocaleString()}</strong></div>
          <div><span>总内存</span><strong>{formatBytes(data.capacity.memory_total)}</strong></div>
          <div><span>总磁盘</span><strong>{formatBytes(data.capacity.disk_total)}</strong></div>
          <p className="dash-muted">{data.capacity.nodes} 台节点的配置容量</p>
        </div>
      );
    case "disk":
      return data.disk_pressure.length === 0 ? <p className="dash-empty">暂无数据</p> : (
        <div className="dash-disk-list">
          {data.disk_pressure.slice(0, limit).map((item) => (
            <div key={item.uuid}>
              <div className="dash-rank-row"><span className="dash-rank-name">{item.name}</span><strong>{item.percent.toFixed(1)}%</strong></div>
              <div className="dash-meter"><i style={{ width: `${Math.min(100, item.percent)}%` }} /></div>
              <small>{formatBytes(item.used)} / {formatBytes(item.total)}</small>
            </div>
          ))}
        </div>
      );
    case "shortcuts":
      return (
        <div className="dash-shortcuts">
          <Link to="/servers"><Server size={16} />服务器管理<ArrowUpRight size={14} /></Link>
          <Link to="/terminal" target="_blank"><Terminal size={16} />远程工作台<ArrowUpRight size={14} /></Link>
          <Link to="/settings/notification"><Bell size={16} />通知配置<ArrowUpRight size={14} /></Link>
        </div>
      );
    default:
      return null;
  }
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<string>("24h");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [layout, setLayout] = useState<DashboardWidgetLayout[]>(defaultDashboardLayout);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState<DashboardWidgetId | "">("");
  const [pingDetail, setPingDetail] = useState<DashboardQualityItem | null>(null);
  const [rankDetail, setRankDetail] = useState<RankDetail | null>(null);
  const revisionRef = useRef(0);

  const load = useCallback(async (next: string, start?: string, end?: string) => {
    setLoading(true);
    try {
      setData(await fetchDashboard(next, start, end));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load("24h"); }, [load]);
  useEffect(() => { void fetchDashboardLayout().then(setLayout).catch(() => undefined); }, []);
  useEffect(() => {
    const close = watchDashboardLive((live) => {
      setData((previous) => {
        if (!previous) return previous;
        const total = live.total || previous.overview.total;
        const online = live.online;
        return {
          ...previous,
          overview: {
            ...previous.overview,
            online,
            total,
            offline: Math.max(0, total - online),
            online_percent: total > 0 ? (online / total) * 100 : 0,
          },
        };
      });
      if (live.revision !== revisionRef.current) {
        revisionRef.current = live.revision;
        const start = startDate ? `${startDate}T00:00:00` : undefined;
        const end = endDate ? `${endDate}T23:59:59.999` : undefined;
        const startIso = start ? new Date(start).toISOString() : undefined;
        const endIso = end ? new Date(end).toISOString() : undefined;
        void load(range, startIso, endIso);
      }
    });
    return close;
  }, [endDate, load, range, startDate]);

  const titles = useMemo(() => Object.fromEntries(DASHBOARD_WIDGETS.map((id) => [id, t(`admin.dashboard.widgets.${id}`)])) as Record<DashboardWidgetId, string>, [t]);
  const available = DASHBOARD_WIDGETS.filter((id) => !layout.some((entry) => entry.id === id));

  async function save() {
    setSaving(true);
    try {
      await saveDashboardLayout(layout);
      setEditing(false);
    } catch {
      setError("保存布局失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-container">
      <PageListHeader
        titleKey="admin.nav.dashboard"
        actions={
          <div className="dash-toolbar">
            <span className="dash-range-label">时间范围</span>
            <Select
              value={range}
              options={[
                { value: "24h", label: "最近 24 小时" },
                { value: "7d", label: "最近 7 天" },
                { value: "30d", label: "最近 30 天" },
                { value: "90d", label: "最近 90 天" },
                { value: "365d", label: "最近 365 天" },
                { value: "custom", label: "自定义" },
              ]}
              onChange={(value) => {
                const next = String(value);
                setRange(next);
                setStartDate("");
                setEndDate("");
                if (next !== "custom") void load(next);
              }}
            />
            <input
              className="dash-date-input"
              type="date"
              value={startDate}
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (value && endDate) {
                  if (value > endDate) {
                    setError("开始时间不能晚于结束时间");
                    return;
                  }
                  setError(null);
                  setRange("custom");
                  void load("custom", new Date(`${value}T00:00:00`).toISOString(), new Date(`${endDate}T23:59:59.999`).toISOString());
                }
              }}
              aria-label="开始日期"
            />
            <span className="dash-range-separator">至</span>
            <input
              className="dash-date-input"
              type="date"
              value={endDate}
              onChange={(event) => {
                const value = event.target.value;
                setEndDate(value);
                if (value && startDate) {
                  if (startDate > value) {
                    setError("结束时间不能早于开始时间");
                    return;
                  }
                  setError(null);
                  setRange("custom");
                  void load("custom", new Date(`${startDate}T00:00:00`).toISOString(), new Date(`${value}T23:59:59.999`).toISOString());
                }
              }}
              aria-label="结束日期"
            />
            {editing ? (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => { setLayout(defaultDashboardLayout()); }}>
                  <RotateCcw size={14} />重置
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setChoosing(true)}>
                  <Plus size={14} />组件
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(false)}>取消</Button>
                <Button type="button" size="sm" disabled={saving} onClick={() => void save()}><Check size={14} />保存</Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={() => setEditing(true)}><Settings2 size={14} />编辑布局</Button>
            )}
          </div>
        }
      />
      {error ? <p className="dash-error"><AlertTriangle size={15} />{error}</p> : null}
      {loading && !data ? <LoadingBlock label="加载仪表盘" /> : null}
      {data ? (
        <>
          <DashboardBoard
            layout={layout}
            editing={editing}
            setLayout={setLayout}
            titles={titles}
            data={data}
            onPingSelect={setPingDetail}
            onRankMore={setRankDetail}
          />
        </>
      ) : null}

      <GenericSidebar
        open={pingDetail !== null}
        title="网络质量详情"
        onClose={() => setPingDetail(null)}
        initialWidth={500}
      >
        {pingDetail ? (
          <div className="dash-ping-detail">
            <div className="dash-ping-detail__title">
              <strong>{pingDetail.name || pingDetail.uuid.slice(0, 8)}</strong>
              <span>{pingDetail.task_name}</span>
            </div>
            <div className="dash-ping-detail__stats">
              <div><span>P50</span><strong>{pingDetail.p50 ? `${Math.round(pingDetail.p50)} ms` : "-"}</strong></div>
              <div><span>P95</span><strong>{pingDetail.p95 ? `${Math.round(pingDetail.p95)} ms` : "-"}</strong></div>
              <div><span>P99</span><strong>{pingDetail.p99 ? `${Math.round(pingDetail.p99)} ms` : "-"}</strong></div>
              <div><span>丢包率</span><strong>{pingDetail.loss.toFixed(2)}%</strong></div>
              <div><span>波动率</span><strong>{pingDetail.volatility.toFixed(2)}</strong></div>
              <div><span>有效样本</span><strong>{pingDetail.valid ?? 0} / {pingDetail.samples ?? 0}</strong></div>
            </div>
            <div className="dash-ping-detail__bar">
              <span>丢包率</span>
              <div className="dash-meter"><i style={{ width: `${Math.min(100, pingDetail.loss)}%`, background: "#ef4444" }} /></div>
            </div>
            <Link className="dash-ping-detail__link" to={`/servers/${pingDetail.uuid}`}>
              查看服务器监控 <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : null}
      </GenericSidebar>

      <GenericSidebar
        open={rankDetail !== null}
        title={rankDetail?.title ?? "排行详情"}
        onClose={() => setRankDetail(null)}
        initialWidth={520}
      >
        {rankDetail ? (
          <RankList
            kind={rankDetail.kind}
            limit={rankDetail.items.length}
            items={rankDetail.items}
          />
        ) : null}
      </GenericSidebar>

      {choosing ? (
        <div className="dash-modal" role="dialog">
          <div className="dash-modal__card">
            <h3>添加组件</h3>
            <select value={adding} onChange={(event) => setAdding(event.target.value as DashboardWidgetId)}>
              <option value="">选择组件</option>
              {available.map((id) => <option key={id} value={id}>{titles[id]}</option>)}
            </select>
            <div className="dash-modal__actions">
              <Button type="button" size="sm" variant="secondary" onClick={() => setChoosing(false)}>取消</Button>
              <Button
                type="button"
                size="sm"
                disabled={!adding}
                onClick={() => {
                  if (!adding) return;
                  const defaults = { overview: { width: "compact", height: "short", limit: 5 }, database: { width: "compact", height: "short", limit: 5 }, expiry: { width: "compact", height: "short", limit: 5 }, traffic: { width: "wide", height: "normal", limit: 5 }, traffic_top: { width: "compact", height: "normal", limit: 5 }, cpu: { width: "compact", height: "normal", limit: 4 }, memory: { width: "compact", height: "normal", limit: 4 }, ping: { width: "full", height: "normal", limit: 3 }, resources: { width: "compact", height: "short", limit: 5 }, disk: { width: "compact", height: "normal", limit: 5 }, shortcuts: { width: "compact", height: "short", limit: 5 } } as const;
                  setLayout([...layout, { id: adding, ...defaults[adding] }]);
                  setAdding("");
                  setChoosing(false);
                }}
              >添加</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
