import { adminFetch } from "./adminFetch";

export type DashboardRange = "24h" | "7d" | "30d" | "90d" | "365d";

export type DashboardRankItem = {
  uuid: string;
  name: string;
  value: number;
  peak: number;
  peak_time?: number;
  peak_rate?: number;
};

export type DashboardTrafficPoint = {
  time: number;
  up_rate: number;
  down_rate: number;
  up_cum: number;
  down_cum: number;
  cpu: number;
  memory: number;
};

export type DashboardQualityItem = {
  task_id: number;
  task_name: string;
  uuid: string;
  name?: string;
  p50: number;
  p95: number;
  p99: number;
  loss: number;
  volatility: number;
  samples?: number;
  valid?: number;
};

export type DashboardData = {
  range: string;
  revision: number;
  generated_at: number;
  status: "ready" | "warming" | "stale";
  overview: { online: number; offline: number; total: number; online_percent: number };
  database: { main_bytes: number; metrics_bytes: number; total_bytes: number };
  expiry: Array<{ uuid: string; name: string; expired_at: string; days_left: number }>;
  traffic: {
    points: DashboardTrafficPoint[];
    total_up: number;
    total_down: number;
    top: Array<{ uuid: string; name: string; up: number; down: number; total: number; peak_rate: number; peak_time?: number }>;
  };
  rankings: { cpu: DashboardRankItem[]; memory: DashboardRankItem[] };
  capacity: { nodes: number; cpu_cores: number; memory_total: number; disk_total: number };
  disk_pressure: Array<{ uuid: string; name: string; percent: number; used: number; total: number }>;
  ping_quality: {
    stable: DashboardQualityItem[];
    unstable: DashboardQualityItem[];
    loss: DashboardQualityItem[];
  };
};

export type DashboardWidgetId =
  | "overview" | "database" | "expiry" | "traffic" | "traffic_top"
  | "cpu" | "memory" | "ping" | "resources" | "disk" | "shortcuts";

export type DashboardWidgetLayout = {
  id: DashboardWidgetId;
  width: "compact" | "wide" | "full";
  height: "short" | "normal" | "tall";
  limit: number;
};

export const DASHBOARD_WIDGETS: DashboardWidgetId[] = [
  "overview", "database", "expiry", "traffic",
  "cpu", "memory", "ping", "resources", "disk", "shortcuts",
];

const DEFAULT_LAYOUT: Record<DashboardWidgetId, Omit<DashboardWidgetLayout, "id">> = {
  overview: { width: "compact", height: "short", limit: 5 },
  database: { width: "compact", height: "short", limit: 5 },
  expiry: { width: "compact", height: "short", limit: 5 },
  traffic: { width: "wide", height: "normal", limit: 5 },
  traffic_top: { width: "compact", height: "normal", limit: 5 },
  cpu: { width: "compact", height: "normal", limit: 4 },
  memory: { width: "compact", height: "normal", limit: 4 },
  ping: { width: "wide", height: "normal", limit: 3 },
  resources: { width: "compact", height: "short", limit: 5 },
  disk: { width: "compact", height: "normal", limit: 5 },
  shortcuts: { width: "compact", height: "short", limit: 5 },
};

const DEFAULT_ORDER: DashboardWidgetId[] = [
  "overview", "database", "expiry",
  "traffic", "cpu",
  "memory", "resources", "disk",
  "shortcuts", "ping",
];

export function defaultDashboardLayout(): DashboardWidgetLayout[] {
  return DEFAULT_ORDER.map((id) => ({
    id,
    ...DEFAULT_LAYOUT[id],
  }));
}

export async function fetchDashboard(
  range: string,
  start?: string,
  end?: string,
): Promise<DashboardData> {
  const params = new URLSearchParams({ range });
  if (start && end) {
    params.set("start", start);
    params.set("end", end);
  }
  const response = await adminFetch(`/api/admin/dashboard?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as { data?: DashboardData };
  if (!body.data) throw new Error("invalid dashboard payload");
  return body.data;
}

export async function fetchDashboardLayout(): Promise<DashboardWidgetLayout[]> {
  const response = await adminFetch("/api/admin/dashboard/layout", { cache: "no-store" });
  if (!response.ok) return defaultDashboardLayout();
  const body = (await response.json()) as { layout?: DashboardWidgetLayout[] };
  return Array.isArray(body.layout) && body.layout.length > 0 ? body.layout : defaultDashboardLayout();
}

export async function saveDashboardLayout(layout: DashboardWidgetLayout[]): Promise<void> {
  const response = await adminFetch("/api/admin/dashboard/layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

export function watchDashboardLive(
  onLive: (live: { online: number; total: number; revision: number }) => void,
): () => void {
  const source = new EventSource("/api/admin/dashboard/stream", { withCredentials: true });
  source.addEventListener("live", (event) => {
    try {
      onLive(JSON.parse((event as MessageEvent).data));
    } catch {
      // Ignore a malformed frame.
    }
  });
  return () => source.close();
}
