import { adminFetch } from "./adminFetch";

export type PprofRuntime = {
  pid: number;
  tasks: number;
  workers: number;
  queue_depth: number;
  threads: number;
  cpu_percent: number;
  system_cpu_percent: number;
  system_other_cpu_percent: number;
  cpu_idle_percent: number;
  heap_alloc: number;
  heap_inuse: number;
  heap_objects: number;
  runtime_sys: number;
  alloc_bytes_per_sec: number;
  uptime_secs: number;
  status: "healthy" | "busy" | "critical";
  pressure_percent: number;
  database: {
    kind: string;
    size_bytes: number;
    disk_total: number;
    disk_available: number;
    connections: number;
    active_connections: number;
    idle_connections: number;
    max_connections: number;
    queries_per_sec: number;
    writes_per_sec: number;
    write_pressure_percent: number;
    tables: Array<{ name: string; bytes: number }>;
    audit_logs_bytes: number;
    clients_bytes: number;
    metrics_bytes: number;
    other_tables_bytes: number;
  };
  memory: {
    agent_cache: number;
    agent_nodes: number;
    websocket: number;
    websocket_sessions: number;
    database: number;
    database_connections: number;
    other: number;
    thread_stacks: number;
    items: Array<{ key: string; bytes: number; detail: string }>;
  };
  heap_preview: string;
};

export type PprofSummary = {
  runtime: PprofRuntime;
};

async function responseError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return new Error(body.message ?? `HTTP ${response.status}`);
}

export async function fetchPprofSummary(): Promise<PprofSummary> {
  const response = await adminFetch("/api/admin/pprof/summary", { cache: "no-store" });
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { data?: PprofSummary };
  if (!body.data) throw new Error("invalid pprof summary");
  return body.data;
}

/** SSE summary while the page is visible; returns an unsubscribe function. */
export function watchPprof(
  onSummary: (summary: PprofSummary) => void,
  onError: () => void,
): () => void {
  const source = new EventSource("/api/admin/pprof/stream", { withCredentials: true });
  source.addEventListener("summary", (event) => {
    try {
      onSummary(JSON.parse((event as MessageEvent).data) as PprofSummary);
    } catch {
      // Ignore malformed frames; the next second refreshes.
    }
  });
  source.onerror = () => onError();
  return () => source.close();
}
