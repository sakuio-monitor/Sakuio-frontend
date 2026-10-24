import { adminFetch } from "./adminFetch";

export type DatabaseInfo = {
  maintenance: boolean;
  main: { kind: string; dsn: string; size_bytes: number; max_connections: number };
  metrics: {
    kind: string;
    dsn: string;
    size_bytes: number;
    shared?: boolean;
    table_prefix: string;
    max_connections: number;
    min_idle_connections: number;
    bucket_1m_minutes: number;
    bucket_5m_minutes: number;
    bucket_1h_hours: number;
  };
  retention: {
    items: { key: string; kind: string; unit: string; days: number }[];
  };
  migration: {
    kind: string | null;
    running: boolean;
    phase: string;
    processed: number;
    error: string | null;
    finished_at: string | null;
  };
};

export async function fetchDatabaseInfo(): Promise<DatabaseInfo> {
  const res = await adminFetch("/api/admin/settings/database");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type DatabaseUpdate = {
  dsn?: string;
  table_prefix?: string;
  max_connections?: number;
  min_idle_connections?: number;
  bucket_1m_minutes?: number;
  bucket_5m_minutes?: number;
  bucket_1h_hours?: number;
  retention?: Record<string, number>;
};

export async function updateDatabase(body: DatabaseUpdate): Promise<void> {
  const res = await adminFetch("/api/admin/settings/database", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// 保存主库配置；重启后生效。
export async function updateMainDatabase(body: {
  driver: string;
  dsn: string;
  max_connections?: number;
}): Promise<{ restart_required?: boolean; unchanged?: boolean }> {
  const res = await adminFetch("/api/admin/settings/database/main", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json().catch(() => ({}))) as { restart_required?: boolean; unchanged?: boolean };
}

export async function startMigration(sourceDsn: string): Promise<void> {
  const res = await adminFetch("/api/admin/settings/database/migrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_dsn: sourceDsn }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
