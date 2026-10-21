import { adminFetch } from "./adminFetch";
import { readApiEnvelope, readApiEnvelopeVoid } from "./adminEnvelope";
import type { PingTask, PingTaskDraft } from "../types/ping";

export async function fetchAllPingTasks(): Promise<PingTask[]> {
  const res = await adminFetch("/api/admin/ping");
  const data = await readApiEnvelope<PingTask[] | null>(res);
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((row) => ({
    ...row,
    clients: Array.isArray(row.clients) ? row.clients : [],
    default_on: Boolean(row.default_on),
  }));
}

export async function addPingTask(payload: PingTaskDraft): Promise<number> {
  const res = await adminFetch("/api/admin/ping/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await readApiEnvelope<{ task_id?: number }>(res);
  return data.task_id ?? 0;
}

export async function deletePingTasks(ids: number[]): Promise<void> {
  const res = await adminFetch("/api/admin/ping/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ids }),
  });
  await readApiEnvelopeVoid(res);
}

export async function editPingTasks(
  tasks: Array<PingTaskDraft & { id: number }>,
): Promise<void> {
  const res = await adminFetch("/api/admin/ping/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tasks }),
  });
  await readApiEnvelopeVoid(res);
}

export async function orderPingTasks(order: Record<string, number>): Promise<void> {
  const res = await adminFetch("/api/admin/ping/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order),
  });
  await readApiEnvelopeVoid(res);
}
