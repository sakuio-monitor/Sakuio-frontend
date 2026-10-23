export type SiteSettings = {
  site_name: string;
  site_description: string;
  cors_origin_check_enabled: boolean;
  cors_allowed_origins: string[];
  ws_origin_check_enabled: boolean;
  ws_allowed_origins: string[];
  ssrf_protection: boolean;
  show_partial_ip: boolean;
  agent_connect_address: string;
  auto_discovery_key: string;
  private_site: boolean;
  share_token: string;
  custom_head: string;
  custom_body: string;
  favicon: string;
  audit_retention_days: number;
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const res = await fetch("/api/admin/settings/site");
  if (!res.ok) {
    throw new Error("fetch site settings failed");
  }
  const body = (await res.json()) as { settings?: SiteSettings };
  if (!body.settings) {
    throw new Error("site settings missing");
  }
  return body.settings;
}

export async function updateSiteSettings(
  payload: Partial<SiteSettings>,
): Promise<SiteSettings> {
  const res = await fetch("/api/admin/settings/site", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("update site settings failed");
  }
  const body = (await res.json()) as { settings?: SiteSettings };
  if (!body.settings) {
    throw new Error("site settings missing");
  }
  return body.settings;
}

export async function regenerateShareToken(): Promise<string> {
  const res = await fetch("/api/admin/settings/site/share-token", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("regenerate share token failed");
  }
  const body = (await res.json()) as { share_token?: string };
  return body.share_token ?? "";
}

export async function downloadBackup(): Promise<void> {
  const res = await fetch("/api/admin/settings/backup");
  if (!res.ok) {
    throw new Error("backup download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sakuio-backup.db";
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file: File): Promise<void> {
  const res = await fetch("/api/admin/settings/restore", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error("restore backup failed");
  }
}
