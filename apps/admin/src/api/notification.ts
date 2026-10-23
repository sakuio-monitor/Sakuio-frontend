export type ConfigField = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  help?: string;
  default?: unknown;
};

export type ChannelType = {
  id: string;
  name: string;
  fields: ConfigField[];
};

export type NotificationInstanceSummary = {
  id: string;
  channel_type: string;
  type_name: string;
  name: string;
  enabled: boolean;
  last_used_at: string;
  updated_at: string;
};

export type NotificationInstanceDetail = NotificationInstanceSummary & {
  fields: ConfigField[];
  data: Record<string, unknown>;
};

export type NotificationEventType =
  | "offline"
  | "online"
  | "ip_change"
  | "login"
  | "expire"
  | "traffic"
  | "traffic_exceeded"
  | "cpu_high"
  | "memory_high"
  | "disk_high"
  | "swap_high"
  | "load_high"
  | "bandwidth_high"
  | "gpu_high"
  | "process_high";

export type NotificationRule = {
  id: string;
  name: string;
  event_type: NotificationEventType;
  threshold: number;
  duration_secs: number;
  enabled: boolean;
  channels: string[];
  clients: string[];
  template_title: string;
  template_body: string;
};

export type NotificationRuleDetail = NotificationRule & {
  updated_at: string;
};

export async function fetchNotificationTypes(): Promise<ChannelType[]> {
  const res = await fetch("/api/admin/notification/types");
  if (!res.ok) {
    throw new Error("fetch types failed");
  }
  const body = (await res.json()) as { types?: ChannelType[] };
  return body.types ?? [];
}

export async function fetchNotificationInstances(): Promise<NotificationInstanceSummary[]> {
  const res = await fetch("/api/admin/notification/instances");
  if (!res.ok) {
    throw new Error("fetch instances failed");
  }
  const body = (await res.json()) as { instances?: NotificationInstanceSummary[] };
  return body.instances ?? [];
}

export async function fetchNotificationInstance(
  id: string,
): Promise<NotificationInstanceDetail> {
  const res = await fetch(`/api/admin/notification/instances/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error("fetch instance failed");
  }
  return (await res.json()) as NotificationInstanceDetail;
}

export async function createNotificationInstance(payload: {
  channel_type: string;
  name?: string;
  data?: Record<string, unknown>;
}): Promise<string> {
  const res = await fetch("/api/admin/notification/instances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("create instance failed");
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new Error("create instance failed");
  }
  return body.id;
}

export async function updateNotificationInstance(
  id: string,
  payload: { name: string; data: Record<string, unknown> },
): Promise<void> {
  const res = await fetch(`/api/admin/notification/instances/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("update instance failed");
  }
}

export async function deleteNotificationInstance(id: string): Promise<void> {
  const res = await fetch(`/api/admin/notification/instances/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("delete instance failed");
  }
}

export async function setNotificationInstanceEnabled(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`/api/admin/notification/instances/${encodeURIComponent(id)}/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("update instance enabled failed");
}

export async function setNotificationRuleEnabled(id: string, enabled: boolean): Promise<void> {
  const res = await fetch(`/api/admin/notification/rules/${encodeURIComponent(id)}/enabled`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error("update rule enabled failed");
}

export async function testNotificationInstance(
  id: string,
  payload?: { title?: string; message?: string; to_email?: string },
): Promise<void> {
  const res = await fetch(
    `/api/admin/notification/instances/${encodeURIComponent(id)}/test`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    },
  );
  if (!res.ok) {
    throw new Error("test send failed");
  }
}

// ---------------------------------------------------------------- rules

export async function fetchNotificationRules(): Promise<NotificationRule[]> {
  const res = await fetch("/api/admin/notification/rules");
  if (!res.ok) {
    throw new Error("fetch rules failed");
  }
  const body = (await res.json()) as { rules?: NotificationRule[] };
  return body.rules ?? [];
}

export async function createNotificationRule(
  payload: Omit<NotificationRule, "id">,
): Promise<string> {
  const res = await fetch("/api/admin/notification/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("create rule failed");
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new Error("create rule failed");
  }
  return body.id;
}

export async function updateNotificationRule(
  id: string,
  payload: Omit<NotificationRule, "id">,
): Promise<void> {
  const res = await fetch(`/api/admin/notification/rules/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("update rule failed");
  }
}

export async function deleteNotificationRule(id: string): Promise<void> {
  const res = await fetch(`/api/admin/notification/rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("delete rule failed");
  }
}
