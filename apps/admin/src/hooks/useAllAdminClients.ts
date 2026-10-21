import { useCallback, useEffect, useState } from "react";
import type { AdminClientSummary } from "../types/ping";

type ClientRow = { uuid: string; name: string };

async function fetchAllClients(): Promise<AdminClientSummary[]> {
  const out: AdminClientSummary[] = [];
  let cursor: string | undefined;
  for (;;) {
    const qs = new URLSearchParams({ limit: "200" });
    if (cursor) {
      qs.set("cursor", cursor);
    }
    const res = await fetch(`/api/admin/clients?${qs.toString()}`);
    if (!res.ok) {
      throw new Error("fetch clients failed");
    }
    const data = (await res.json()) as {
      items?: ClientRow[];
      next_cursor?: string | null;
    };
    for (const row of data.items ?? []) {
      out.push({ uuid: row.uuid, name: row.name });
    }
    const next = data.next_cursor?.trim();
    if (!next) {
      break;
    }
    cursor = next;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export function useAllAdminClients() {
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setClients(await fetchAllClients());
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { clients, loading, error, refresh };
}
