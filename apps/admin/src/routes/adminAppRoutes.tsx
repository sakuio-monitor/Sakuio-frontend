import { Navigate, Route } from "react-router-dom";
import { PLACEHOLDER_PATHS } from "../admin/menu";
import DashboardPage from "../pages/DashboardPage";
import PlaceholderPage from "../pages/PlaceholderPage";
import ExecPage from "../pages/ExecPage";
import NotificationChannelsPage from "../pages/NotificationChannelsPage";
import NotificationRulesPage from "../pages/NotificationRulesPage";
import PingPage from "../pages/PingPage";
import ServersPage from "../pages/ServersPage";
import SettingsSitePage from "../pages/SettingsSitePage";
import SettingsGeneralPage from "../pages/SettingsGeneralPage";
const PLACEHOLDER_ROUTE_PATHS = PLACEHOLDER_PATHS.map((p) => p.replace(/^\//, ""));

export function adminAppRoutes() {
  return (
    <>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/servers" element={<ServersPage />} />
      <Route path="/ping" element={<PingPage />} />
      <Route path="/exec" element={<ExecPage />} />
      <Route path="/notification" element={<Navigate to="/notification/channels" replace />} />
      <Route path="/notification/channels" element={<NotificationChannelsPage />} />
      <Route path="/notification/rules" element={<NotificationRulesPage />} />
      <Route path="/settings/site" element={<SettingsSitePage />} />
      <Route path="/settings/general" element={<SettingsGeneralPage />} />
      {PLACEHOLDER_ROUTE_PATHS.map((path) => (
        <Route key={path} path={path} element={<PlaceholderPage />} />
      ))}
    </>
  );
}
