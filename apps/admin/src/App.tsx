import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import {
  RequireBackend,
  RequireInstalled,
  RequireInstallWizard,
  RootRedirect,
} from "./install/InstallRoutes";
import { InstallProvider } from "./install/InstallProvider";
import AppLayout from "./layouts/AppLayout";
import BackendUnavailablePage from "./pages/BackendUnavailablePage";
import InstallPage from "./pages/InstallPage";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import LoginPage from "./pages/LoginPage";
import TerminalPage from "./pages/terminal";
import { RPC2Provider } from "./contexts/RPC2Context";
import { NodeListProvider } from "./contexts/NodeListContext";
import { SiteFaviconSync } from "./components/SiteFaviconSync";

function TerminalRoute() {
  return (
    <RPC2Provider>
      <NodeListProvider>
        <TerminalPage />
      </NodeListProvider>
    </RPC2Provider>
  );
}
import { adminAppRoutes } from "./routes/adminAppRoutes";
import { InstallBootScreen } from "./install/InstallRoutes";
import "./styles/setup.css";
import "./styles/admin-pages.css";
import "./styles/notification.css";
import "./styles/terminal-xterm.css";

function RequireAuth() {
  const { loading, loggedIn } = useAuth();
  if (loading) return <InstallBootScreen />;
  if (!loggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <InstallProvider>
      <AuthProvider>
      <SiteFaviconSync />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route element={<RequireBackend />}>
          <Route path="/backend-unavailable" element={<BackendUnavailablePage />} />
        </Route>
        <Route element={<RequireInstallWizard />}>
          <Route path="/install" element={<InstallPage />} />
        </Route>
        <Route element={<RequireInstalled />}>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/workbench" element={<TerminalRoute />} />
            <Route path="/terminal" element={<TerminalRoute />} />
            <Route element={<AppLayout />}>{adminAppRoutes()}</Route>
          </Route>
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
      </AuthProvider>
    </InstallProvider>
  );
}
