import { adminFetch } from "./adminFetch";

async function readFsJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || res.statusText);
  }
  return (await res.json()) as T;
}

async function readFsVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || res.statusText);
  }
}

export type FileEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink?: boolean;
  size?: number;
  modified_at?: string;
  mode?: string;
};

export type ListPage = {
  total: number;
  items: FileEntry[];
};

export type TrashEntry = {
  trash_id: string;
  name: string;
  original_path: string;
  trashed_at: string;
  is_dir: boolean;
};

function nodeBase(uuid: string) {
  return `/api/admin/nodes/${encodeURIComponent(uuid)}/fs`;
}

export async function fsList(uuid: string, path: string, offset: number, limit: number): Promise<ListPage> {
  const qs = new URLSearchParams({
    path,
    offset: String(offset),
    limit: String(limit),
  });
  const res = await adminFetch(`${nodeBase(uuid)}/list?${qs}`);
  const data = await readFsJson<ListPage | FileEntry[]>(res);
  if (Array.isArray(data)) {
    return { total: data.length, items: data };
  }
  return data;
}

export async function fsSearch(uuid: string, path: string, query: string): Promise<FileEntry[]> {
  const qs = new URLSearchParams({ path, query });
  const res = await adminFetch(`${nodeBase(uuid)}/search?${qs}`);
  return readFsJson<FileEntry[]>(res);
}

export async function fsMkdir(uuid: string, path: string): Promise<void> {
  const res = await adminFetch(`${nodeBase(uuid)}/mkdir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  await readFsVoid(res);
}

export async function fsDelete(uuid: string, path: string, permanent: boolean): Promise<void> {
  const qs = new URLSearchParams({ path, permanent: String(permanent) });
  const res = await adminFetch(`${nodeBase(uuid)}/delete?${qs}`, { method: "DELETE" });
  await readFsVoid(res);
}

export async function fsRename(uuid: string, from: string, to: string): Promise<void> {
  const res = await adminFetch(`${nodeBase(uuid)}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  await readFsVoid(res);
}

export async function fsChmod(uuid: string, path: string, mode: string): Promise<void> {
  const res = await adminFetch(`${nodeBase(uuid)}/chmod`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, mode }),
  });
  await readFsVoid(res);
}

export async function fsReadText(uuid: string, path: string): Promise<string> {
  const qs = new URLSearchParams({ path });
  const res = await adminFetch(`${nodeBase(uuid)}/text?${qs}`);
  const data = await readFsJson<{ content?: string }>(res);
  return data.content ?? "";
}

export async function fsWriteText(uuid: string, path: string, content: string): Promise<void> {
  const qs = new URLSearchParams({ path });
  const res = await adminFetch(`${nodeBase(uuid)}/text?${qs}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  await readFsVoid(res);
}

export async function fsUploadRaw(uuid: string, path: string, file: File): Promise<void> {
  const qs = new URLSearchParams({ path });
  const res = await adminFetch(`${nodeBase(uuid)}/raw?${qs}`, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": "application/octet-stream" },
  });
  await readFsVoid(res);
}

export async function fsTrashList(uuid: string): Promise<TrashEntry[]> {
  const res = await adminFetch(`${nodeBase(uuid)}/trash`);
  return readFsJson<TrashEntry[]>(res);
}

export async function fsTrashRestore(uuid: string, trashId: string): Promise<void> {
  const res = await adminFetch(`${nodeBase(uuid)}/trash/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trash_id: trashId }),
  });
  await readFsVoid(res);
}

export async function fsTrashEmpty(uuid: string): Promise<void> {
  const res = await adminFetch(`${nodeBase(uuid)}/trash/empty`, { method: "POST" });
  await readFsVoid(res);
}
