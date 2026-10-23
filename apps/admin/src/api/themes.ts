import { adminFetch } from "./adminFetch";

export type ThemeRow = {
  short: string;
  name: string;
  description: string;
  version: string;
  author: string;
  url: string;
  preview: string;
  preview_url: string | null;
  active: boolean;
  installed: boolean;
  installed_version: string | null;
  source: string | null;
  configuration_type: string;
  config_items: number;
  configuration_name: unknown;
  configuration_icon: string;
};

export type MarketRow = {
  short: string;
  name: string;
  description: string;
  version: string;
  author: string;
  url: string;
  preview: string;
  download: string;
  sha256: string;
  installed: boolean;
  installed_version: string | null;
  active: boolean;
};

async function parse<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok || (body as { success?: boolean }).success === false) {
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return body;
}

export async function fetchThemes(): Promise<{ active: string; themes: ThemeRow[] }> {
  const res = await adminFetch("/api/admin/themes");
  return parse(res);
}

export async function uploadTheme(file: File): Promise<ThemeRow> {
  const res = await adminFetch("/api/admin/themes/upload", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file,
  });
  const body = await parse<{ theme: ThemeRow }>(res);
  return body.theme;
}

export async function applyTheme(short: string): Promise<void> {
  const res = await adminFetch(`/api/admin/themes/${encodeURIComponent(short)}/apply`, {
    method: "POST",
  });
  await parse(res);
}

export async function deleteTheme(short: string): Promise<void> {
  const res = await adminFetch(`/api/admin/themes/${encodeURIComponent(short)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
}

export type ThemeJobEvent = {
  job_id: string;
  short: string;
  kind: "install" | "update";
  phase: "queued" | "resolving" | "downloading" | "retrying" | "installing" | "done" | "error";
  status: "running" | "done" | "error";
  downloaded: number;
  total: number | null;
  speed_bps: number;
  percent: number | null;
  message: string | null;
  updated: boolean | null;
};

export async function updateTheme(short: string): Promise<{ job_id: string }> {
  const res = await adminFetch(`/api/admin/themes/${encodeURIComponent(short)}/update?refresh=1`, {
    method: "POST",
  });
  return parse(res);
}

export async function installMarketTheme(short: string): Promise<{ job_id: string }> {
  const res = await adminFetch(
    `/api/admin/themes/market/${encodeURIComponent(short)}/install`,
    { method: "POST" },
  );
  return parse(res);
}

export async function fetchThemeJob(jobId: string): Promise<ThemeJobEvent | null> {
  const res = await adminFetch(`/api/admin/themes/jobs/${encodeURIComponent(jobId)}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { job?: ThemeJobEvent };
  return body.job ?? null;
}

/**
 * Subscribes to a theme job's SSE progress. If SSE cannot connect it falls back
 * to polling the snapshot endpoint; returns an unsubscribe function.
 */
export function watchThemeJob(
  jobId: string,
  onEvent: (event: ThemeJobEvent) => void,
): () => void {
  let stopped = false;
  let pollTimer: number | undefined;
  const source = new EventSource(
    `/api/admin/themes/jobs/${encodeURIComponent(jobId)}/events`,
    { withCredentials: true },
  );

  const stop = () => {
    if (stopped) return;
    stopped = true;
    source.close();
    if (pollTimer !== undefined) window.clearInterval(pollTimer);
  };

  const startPolling = () => {
    if (stopped || pollTimer !== undefined) return;
    pollTimer = window.setInterval(() => {
      void fetchThemeJob(jobId)
        .then((event) => {
          if (!event || stopped) return;
          onEvent(event);
          if (event.status !== "running") stop();
        })
        .catch(() => {
          // Keep polling through transient restart windows.
        });
    }, 1200);
  };

  source.addEventListener("progress", (message) => {
    try {
      const event = JSON.parse((message as MessageEvent).data) as ThemeJobEvent;
      onEvent(event);
      if (event.status !== "running") stop();
    } catch {
      // Ignore malformed frames; the stream will continue.
    }
  });
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) startPolling();
  };
  return stop;
}

export async function fetchMarket(refresh = false): Promise<{
  themes: MarketRow[];
  market_url: string;
}> {
  const res = await adminFetch(`/api/admin/themes/market${refresh ? "?refresh=1" : ""}`);
  return parse(res);
}


export type ThemeConfigItem = {
  key?: string;
  name?: unknown;
  help?: unknown;
  type?: string;
  options?: string;
  default?: unknown;
  required?: boolean;
};

export type ThemeConfigView = {
  type: string;
  items: ThemeConfigItem[];
  values: Record<string, unknown>;
  name?: unknown;
};

export async function fetchThemeConfig(short: string): Promise<ThemeConfigView> {
  const res = await adminFetch(`/api/admin/themes/${encodeURIComponent(short)}/config`);
  const body = await parse<{ configuration: ThemeConfigView }>(res);
  return body.configuration;
}

export async function saveThemeConfig(
  short: string,
  values: Record<string, unknown>,
): Promise<ThemeConfigView> {
  const res = await adminFetch(`/api/admin/themes/${encodeURIComponent(short)}/config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  const body = await parse<{ configuration: ThemeConfigView }>(res);
  return body.configuration;
}
