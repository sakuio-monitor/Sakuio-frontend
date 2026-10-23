import { adminFetch } from "./adminFetch";

export type AuthDriverField = {
  key: string;
  label: string;
  kind: "password" | "text" | string;
  required: boolean;
  placeholder: string;
  options?: Array<{ value: string; label: string }>;
};

export type AuthDriver = {
  id: string;
  name: string;
  description: string;
  fields: AuthDriverField[];
};

export type AuthProvider = {
  id: number;
  name: string;
  driver: string;
  driver_name: string;
  description: string;
  auth_type: string;
  configured_fields: string[];
  last_validated_at: string;
  last_used_at: string;
  created_at: string;
  updated_at: string;
};

export type DdnsRecord = {
  id: number;
  name: string;
  provider_id: number;
  provider_name: string;
  driver: string;
  client_uuid: string;
  client_name: string;
  zone_name: string;
  record_name: string;
  record_type: "A" | "AAAA";
  proxied: boolean;
  ttl: number;
  enabled: boolean;
  last_ip: string;
  last_error: string;
  last_synced_at: string | null;
};

export type DdnsInput = {
  name: string;
  provider_id: number;
  client_uuid: string;
  fqdn: string;
  record_type: "A" | "AAAA" | "BOTH";
  proxied: boolean;
  ttl: number;
};

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAuthDrivers(): Promise<AuthDriver[]> {
  const body = await json<{ drivers?: AuthDriver[] }>(
    await adminFetch("/api/admin/auth/drivers", { cache: "no-store" }),
  );
  return body.drivers ?? [];
}

export async function fetchAuthProviders(): Promise<AuthProvider[]> {
  const body = await json<{ items?: AuthProvider[] }>(
    await adminFetch("/api/admin/auth/providers", { cache: "no-store" }),
  );
  return body.items ?? [];
}

export async function createAuthProvider(body: {
  name: string;
  driver: string;
  config: Record<string, string>;
}): Promise<void> {
  await json(await adminFetch("/api/admin/auth/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function updateAuthProvider(
  id: number,
  body: { name?: string; config?: Record<string, string> },
): Promise<void> {
  await json(await adminFetch(`/api/admin/auth/providers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function deleteAuthProvider(id: number): Promise<void> {
  await json(await adminFetch(`/api/admin/auth/providers/${id}`, { method: "DELETE" }));
}

export async function fetchDdnsRecords(): Promise<DdnsRecord[]> {
  const body = await json<{ items?: DdnsRecord[] }>(
    await adminFetch("/api/admin/ddns", { cache: "no-store" }),
  );
  return body.items ?? [];
}

export async function createDdnsRecord(body: DdnsInput): Promise<void> {
  await json(await adminFetch("/api/admin/ddns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function updateDdnsRecord(id: number, body: DdnsInput): Promise<void> {
  await json(await adminFetch(`/api/admin/ddns/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function deleteDdnsRecord(id: number): Promise<void> {
  await json(await adminFetch(`/api/admin/ddns/${id}`, { method: "DELETE" }));
}

export async function syncDdnsRecord(id: number): Promise<void> {
  await json(await adminFetch(`/api/admin/ddns/${id}/sync`, { method: "POST" }));
}

export type ClientOption = { uuid: string; name: string; ipv4?: string; ipv6?: string };

export async function fetchClientOptions(params: {
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ items: ClientOption[]; total: number; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 10));
  const body = await json<{ items?: ClientOption[]; total?: number; page?: number; limit?: number }>(
    await adminFetch(`/api/admin/ddns/clients?${query.toString()}`, { cache: "no-store" }),
  );
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    page: body.page ?? 1,
    limit: body.limit ?? 10,
  };
}
