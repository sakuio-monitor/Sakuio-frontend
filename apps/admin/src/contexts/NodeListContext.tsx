import React from "react";
import { useRPC2Call } from "./RPC2Context";

export type NodeBasicInfo = {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version: string;
  weight: number;
  price: number;
  tags: string;
  billing_cycle: number;
  currency: string;
  group: string;
  traffic_limit: number;
  traffic_limit_type: undefined | "sum" | "max" | "min" | "up" | "down";
  expired_at: string;
  created_at: string;
  updated_at: string;
  ipv4?: string;
  ipv6?: string;
};

interface NodeListContextType {
  nodeList: NodeBasicInfo[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const NodeListContext = React.createContext<NodeListContextType | undefined>(undefined);

export const NodeListProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodeList, setNodeList] = React.useState<NodeBasicInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { call } = useRPC2Call();

  const refresh = React.useCallback(() => {
    setError(null);
    call<Record<string, never>, Record<string, Record<string, unknown>>>("common:getNodes")
      .then((result) => {
        const list: NodeBasicInfo[] = Object.values(result ?? {}).map((n) => ({
          uuid: String(n.uuid ?? ""),
          name: String(n.name ?? ""),
          cpu_name: String(n.cpu_name ?? ""),
          virtualization: String(n.virtualization ?? ""),
          arch: String(n.arch ?? ""),
          cpu_cores: Number(n.cpu_cores ?? 0),
          os: String(n.os ?? "Linux"),
          kernel_version: String(n.kernel_version ?? ""),
          gpu_name: String(n.gpu_name ?? ""),
          region: String(n.region ?? ""),
          mem_total: Number(n.mem_total ?? 0),
          swap_total: Number(n.swap_total ?? 0),
          disk_total: Number(n.disk_total ?? 0),
          version: String(n.version ?? ""),
          weight: Number(n.weight ?? 0),
          price: Number(n.price ?? 0),
          tags: String(n.tags ?? ""),
          billing_cycle: Number(n.billing_cycle ?? 0),
          currency: String(n.currency ?? ""),
          group: String(n.group ?? ""),
          traffic_limit: Number(n.traffic_limit ?? 0),
          traffic_limit_type: undefined,
          expired_at: String(n.expired_at ?? ""),
          created_at: String(n.created_at ?? ""),
          updated_at: String(n.updated_at ?? ""),
          ipv4: n.ipv4 != null ? String(n.ipv4) : undefined,
          ipv6: n.ipv6 != null ? String(n.ipv6) : undefined,
        }));
        setNodeList(list);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load nodes");
        setNodeList([]);
      })
      .finally(() => setIsLoading(false));
  }, [call]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const contextValue = React.useMemo(
    () => ({ nodeList, isLoading, error, refresh }),
    [nodeList, isLoading, error, refresh],
  );

  return <NodeListContext.Provider value={contextValue}>{children}</NodeListContext.Provider>;
};

export function useNodeList(): NodeListContextType;
export function useNodeList(required: false): NodeListContextType | undefined;
export function useNodeList(required = true) {
  const context = React.useContext(NodeListContext);
  if (!context && required) {
    throw new Error("useNodeList must be used within a NodeListProvider");
  }
  return context;
}
