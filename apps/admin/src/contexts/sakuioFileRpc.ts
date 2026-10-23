import type {
  RemoteFileInfo,
  RemoteSearchResult,
} from "../pages/terminal/fileManagerApi";

function nodeBase(uuid: string) {
  return `/api/admin/nodes/${encodeURIComponent(uuid)}/fs`;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || res.statusText);
  }
  return (await res.json()) as T;
}

async function readVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || res.statusText);
  }
}

function mapEntry(raw: Record<string, unknown>): RemoteFileInfo {
  const name = String(raw.name ?? "");
  const path = String(raw.path ?? "");
  const is_dir = Boolean(raw.is_dir);
  return {
    name,
    path,
    is_dir,
    is_symlink: Boolean(raw.is_symlink),
    size: Number(raw.size ?? 0),
    mode: String(raw.mode ?? ""),
    mode_octal: String(raw.mode_octal ?? raw.mode ?? ""),
    uid: Number(raw.uid ?? 0),
    gid: Number(raw.gid ?? 0),
    owner: String(raw.owner ?? ""),
    group: String(raw.group ?? ""),
    modified_at: String(raw.modified_at ?? ""),
    target: raw.target != null ? String(raw.target) : undefined,
  };
}

export async function sakuioFileList(uuid: string, path: string): Promise<RemoteFileInfo[]> {
  const qs = new URLSearchParams({ path, offset: "0", limit: "10000" });
  const res = await fetch(`${nodeBase(uuid)}/list?${qs}`, { credentials: "include" });
  const data = await readJson<{ items?: unknown[] } | unknown[]>(res);
  const items = Array.isArray(data) ? data : (data.items ?? []);
  return items.map((row) => mapEntry(row as Record<string, unknown>));
}

export async function sakuioFileRoots(uuid: string): Promise<RemoteFileInfo[]> {
  const res = await fetch(`${nodeBase(uuid)}/roots`, { credentials: "include" });
  const data = await readJson<unknown[]>(res);
  return (Array.isArray(data) ? data : []).map((row) => mapEntry(row as Record<string, unknown>));
}

export async function sakuioFileStat(uuid: string, path: string): Promise<RemoteFileInfo> {
  const qs = new URLSearchParams({ path });
  const res = await fetch(`${nodeBase(uuid)}/stat?${qs}`, { credentials: "include" });
  return mapEntry((await readJson(res)) as Record<string, unknown>);
}

export async function sakuioFileMkdir(uuid: string, path: string, _mode?: string): Promise<void> {
  const res = await fetch(`${nodeBase(uuid)}/mkdir`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  await readVoid(res);
}

export async function sakuioFileDelete(uuid: string, path: string): Promise<void> {
  const qs = new URLSearchParams({ path, permanent: "false" });
  const res = await fetch(`${nodeBase(uuid)}/delete?${qs}`, {
    method: "DELETE",
    credentials: "include",
  });
  await readVoid(res);
}

export async function sakuioFileMove(uuid: string, source: string, destination: string): Promise<void> {
  const res = await fetch(`${nodeBase(uuid)}/move`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: source, to: destination }),
  });
  await readVoid(res);
}

export async function sakuioFileCopy(uuid: string, source: string, destination: string): Promise<void> {
  const res = await fetch(`${nodeBase(uuid)}/copy`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: source, to: destination }),
  });
  await readVoid(res);
}

export async function sakuioFileChmod(uuid: string, path: string, mode: string): Promise<void> {
  const res = await fetch(`${nodeBase(uuid)}/chmod`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, mode }),
  });
  await readVoid(res);
}

export async function sakuioFileChown(uuid: string, path: string, owner: string, group: string): Promise<void> {
  const res = await fetch(`${nodeBase(uuid)}/chown`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, owner, group }),
  });
  await readVoid(res);
}

export async function sakuioFileSearch(
  uuid: string,
  path: string,
  query: string,
  _content: boolean,
): Promise<RemoteSearchResult> {
  const qs = new URLSearchParams({ path, query });
  const res = await fetch(`${nodeBase(uuid)}/search?${qs}`, { credentials: "include" });
  const hits = await readJson<Record<string, unknown>[]>(res);
  return {
    matches: (Array.isArray(hits) ? hits : []).map((hit) => ({
      path: String(hit.path ?? ""),
      line: Number(hit.line ?? 0),
      text: hit.text != null ? String(hit.text) : undefined,
      is_dir: Boolean(hit.is_dir),
    })),
    limited: false,
  };
}
