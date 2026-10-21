import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { InstallStatus } from "./types";

export type BackendConnection = "unknown" | "ok" | "failed";

type InstallContextValue = {
  loading: boolean;
  status: InstallStatus | null;
  connection: BackendConnection;
  /** Backend responded and install wizard is still required. */
  installRequired: boolean;
  /** Could not reach `/api/install/status` (network, proxy, server down). */
  backendUnreachable: boolean;
  refresh: () => Promise<void>;
};

const InstallContext = createContext<InstallContextValue | null>(null);

async function fetchInstallStatus(): Promise<InstallStatus> {
  const res = await fetch("/api/install/status");
  if (!res.ok) {
    throw new Error("install status request failed");
  }
  return (await res.json()) as InstallStatus;
}

export function InstallProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [connection, setConnection] = useState<BackendConnection>("unknown");

  async function refresh() {
    setLoading(true);
    try {
      const next = await fetchInstallStatus();
      setStatus(next);
      setConnection("ok");
    } catch {
      setStatus(null);
      setConnection("failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo((): InstallContextValue => {
    const backendUnreachable = !loading && connection === "failed";
    const installRequired =
      !loading && connection === "ok" && status?.required === true;
    return {
      loading,
      status,
      connection,
      installRequired,
      backendUnreachable,
      refresh,
    };
  }, [loading, status, connection]);

  return <InstallContext.Provider value={value}>{children}</InstallContext.Provider>;
}

export function useInstall() {
  const ctx = useContext(InstallContext);
  if (!ctx) {
    throw new Error("useInstall must be used within InstallProvider");
  }
  return ctx;
}
