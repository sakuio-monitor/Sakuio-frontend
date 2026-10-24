import { Navigate, Route } from "react-router-dom";
import { PLACEHOLDER_PATHS } from "../admin/menu";
import AuthApiPage from "../pages/AuthApiPage";
import DashboardPage from "../pages/DashboardPage";
import DdnsPage from "../pages/DdnsPage";
import PlaceholderPage from "../pages/PlaceholderPage";
import ExecPage from "../pages/ExecPage";
import NotificationChannelsPage from "../pages/NotificationChannelsPage";
import NotificationRulesPage from "../pages/NotificationRulesPage";
import PingPage from "../pages/PingPage";
import ServersPage from "../pages/ServersPage";
import SettingsSitePage from "../pages/SettingsSitePage";
import AccountPage from "../pages/AccountPage";
import SettingsGeneralPage from "../pages/SettingsGeneralPage";
import DatabasePage from "../pages/DatabasePage";
import ThemesPage from "../pages/ThemesPage";
import ThemeSettingsPage from "../pages/ThemeSettingsPage";
import LogsPage from "../pages/LogsPage";
import PprofPage from "../pages/PprofPage";
import AboutPage from "../pages/AboutPage";
const PLACEHOLDER_ROUTE_PATHS = PLACEHOLDER_PATHS.map((p) => p.replace(/^\//, ""));

export function adminAppRoutes() {
  return (
    <>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/servers" element={<ServersPage />} />
      <Route path="/assets/auth" element={<AuthApiPage />} />
      <Route path="/ddns" element={<DdnsPage />} />
      <Route path="/ping" element={<PingPage />} />
      <Route path="/exec" element={<ExecPage />} />
      <Route path="/notification" element={<Navigate to="/notification/channels" replace />} />
      <Route path="/notification/channels" element={<NotificationChannelsPage />} />
      <Route path="/notification/rules" element={<NotificationRulesPage />} />
      <Route path="/settings/account" element={<AccountPage />} />
      <Route path="/settings/site" element={<SettingsSitePage />} />
      <Route path="/settings/general" element={<SettingsGeneralPage />} />
      <Route path="/settings/database" element={<DatabasePage />} />
      <Route path="/logs" element={<LogsPage />} />
      <Route path="/pprof" element={<PprofPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/themes" element={<ThemesPage mode="installed" />} />
      <Route path="/themes/:short/settings" element={<ThemeSettingsPage />} />
      <Route path="/market/themes" element={<ThemesPage mode="market" />} />
      <Route path="/settings/metrics" element={<Navigate to="/settings/database" replace />} />
      {PLACEHOLDER_ROUTE_PATHS.map((path) => (
        <Route key={path} path={path} element={<PlaceholderPage />} />
      ))}
    </>
  );
}
