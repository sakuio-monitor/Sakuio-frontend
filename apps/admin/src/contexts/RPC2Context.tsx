import React, { createContext, useCallback, useContext, useMemo } from "react";
import {
  sakuioFileChmod,
  sakuioFileChown,
  sakuioFileCopy,
  sakuioFileDelete,
  sakuioFileList,
  sakuioFileMkdir,
  sakuioFileMove,
  sakuioFileRoots,
  sakuioFileSearch,
  sakuioFileStat,
} from "./sakuioFileRpc";

type RpcParams = Record<string, unknown>;

async function fetchAllAdminClients(): Promise<Record<string, unknown>> {
  const items: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const qs = new URLSearchParams({ limit: "100" });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(`/api/admin/clients?${qs}`, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to load clients (${res.status})`);
    const body = (await res.json()) as { items?: Record<string, unknown>[]; next_cursor?: string | null };
    items.push(...(body.items ?? []));
    cursor = body.next_cursor ?? null;
    if (!cursor) break;
  }
  const map: Record<string, unknown> = {};
  for (const item of items) {
    const uuid = String(item.uuid ?? "");
    if (!uuid) continue;
    map[uuid] = {
      uuid,
      name: item.name ?? uuid,
      os: item.os ?? "Linux",
      weight: item.weight ?? 0,
      online: item.online,
      mem_total: item.mem_total ?? 0,
      disk_total: item.disk_total ?? 0,
      cpu_cores: item.cpu_cores ?? 0,
      region: item.region ?? "",
      group: item.group_name ?? "",
    };
  }
  return map;
}

async function dispatchRpc<T>(method: string, params: RpcParams): Promise<T> {
  const uuid = String(params.uuid ?? "");
  switch (method) {
    case "admin:fileList":
      return (await sakuioFileList(uuid, String(params.path ?? "/"))) as T;
    case "admin:fileListRoots":
      return (await sakuioFileRoots(uuid)) as T;
    case "admin:fileStat":
      return (await sakuioFileStat(uuid, String(params.path ?? ""))) as T;
    case "admin:fileMkdir":
      await sakuioFileMkdir(uuid, String(params.path ?? ""), String(params.mode ?? "0755"));
      return undefined as T;
    case "admin:fileDelete":
      await sakuioFileDelete(uuid, String(params.path ?? ""));
      return undefined as T;
    case "admin:fileMove":
      await sakuioFileMove(uuid, String(params.source ?? ""), String(params.destination ?? ""));
      return undefined as T;
    case "admin:fileCopy":
      await sakuioFileCopy(uuid, String(params.source ?? ""), String(params.destination ?? ""));
      return undefined as T;
    case "admin:fileChmod":
      await sakuioFileChmod(uuid, String(params.path ?? ""), String(params.mode ?? "0644"));
      return undefined as T;
    case "admin:fileChown":
      await sakuioFileChown(
        uuid,
        String(params.path ?? ""),
        String(params.owner ?? ""),
        String(params.group ?? ""),
      );
      return undefined as T;
    case "admin:fileSearch":
      return (await sakuioFileSearch(
        uuid,
        String(params.path ?? "/"),
        String(params.query ?? ""),
        Boolean(params.content),
      )) as T;
    case "common:getNodes":
      return (await fetchAllAdminClients()) as T;
    case "common:getNodesLatestStatus":
      return {} as T;
    default:
      throw new Error(`Unsupported RPC method: ${method}`);
  }
}

const RPC2Context = createContext<
  | {
      call: <P extends RpcParams, R>(method: string, params?: P) => Promise<R>;
    }
  | undefined
>(undefined);

export const RPC2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const call = useCallback(<P extends RpcParams, R>(method: string, params?: P) => {
    return dispatchRpc<R>(method, (params ?? {}) as RpcParams);
  }, []);

  const value = useMemo(() => ({ call }), [call]);
  return <RPC2Context.Provider value={value}>{children}</RPC2Context.Provider>;
};

export function useRPC2Call() {
  const ctx = useContext(RPC2Context);
  if (!ctx) {
    throw new Error("useRPC2Call must be used within RPC2Provider");
  }
  return ctx;
}
