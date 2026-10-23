import { useTranslation } from "react-i18next";
import { LoadingBlock } from "../components/LoadingBlock";
import { Navigate, Outlet } from "react-router-dom";
import { useInstall } from "./InstallProvider";

export function InstallBootScreen() {
  const { t } = useTranslation();
  const { loading } = useInstall();
  if (!loading) return null;
  return (
    <main className="setup-page">
      <div className="setup-shell setup-header">
        <LoadingBlock label={t("common.loading")} />
      </div>
    </main>
  );
}

function useGateTarget(): "loading" | "backend" | "install" | "app" {
  const { loading, backendUnreachable, installRequired } = useInstall();
  if (loading) return "loading";
  if (backendUnreachable) return "backend";
  if (installRequired) return "install";
  return "app";
}

/** Redirects `/` once backend and install state are known. */
export function RootRedirect() {
  const gate = useGateTarget();
  if (gate === "loading") return <InstallBootScreen />;
  if (gate === "backend") return <Navigate to="/backend-unavailable" replace />;
  if (gate === "install") return <Navigate to="/install" replace />;
  return <Navigate to="/dashboard" replace />;
}

/** Blocks admin shell until installation has completed and backend is reachable. */
export function RequireInstalled() {
  const gate = useGateTarget();
  if (gate === "loading") return <InstallBootScreen />;
  if (gate === "backend") return <Navigate to="/backend-unavailable" replace />;
  if (gate === "install") return <Navigate to="/install" replace />;
  return <Outlet />;
}

/** Install wizard only while installation is required and backend is up. */
export function RequireInstallWizard() {
  const gate = useGateTarget();
  if (gate === "loading") return <InstallBootScreen />;
  if (gate === "backend") return <Navigate to="/backend-unavailable" replace />;
  if (gate === "app") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/** Shown when the API cannot be reached; must not be confused with install. */
export function RequireBackend() {
  const gate = useGateTarget();
  if (gate === "loading") return <InstallBootScreen />;
  if (gate === "install") return <Navigate to="/install" replace />;
  if (gate === "app") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
