import { Button, Input, Select, toast } from "@sakuio/ui";
import { AlertTriangle, Database, HardDrive, RefreshCw, Save, Settings2 } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBlock } from "../components/LoadingBlock";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { PageListHeader } from "../components/PageListHeader";
import {
  fetchDatabaseInfo,
  startMigration,
  updateDatabase,
  updateMainDatabase,
  type DatabaseInfo,
} from "../api/database";

type ConnDriver = "sqlite" | "mysql" | "postgres";

type ConnForm = {
  driver: ConnDriver;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  filePath: string;
};

const DEFAULT_FORM: ConnForm = {
  driver: "sqlite",
  host: "127.0.0.1",
  port: "",
  database: "",
  username: "",
  password: "",
  filePath: "./data/sakuio.db",
};

function parseDsn(dsn: string): ConnForm {
  const s = dsn.trim();
  if (!s) return { ...DEFAULT_FORM };
  if (!s.includes("://")) {
    return { ...DEFAULT_FORM, filePath: s };
  }
  try {
    const u = new URL(s);
    const common = {
      host: u.hostname || "127.0.0.1",
      port: u.port,
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    };
    if (u.protocol.startsWith("mysql")) {
      return { ...DEFAULT_FORM, driver: "mysql", ...common, port: common.port || "3306" };
    }
    if (u.protocol.startsWith("postgres")) {
      return { ...DEFAULT_FORM, driver: "postgres", ...common, port: common.port || "5432" };
    }
    if (u.protocol === "sqlite:") {
      return { ...DEFAULT_FORM, filePath: (u.host === "." ? "." : u.host) + u.pathname };
    }
  } catch {
    // 解析失败按 SQLite 路径处理。
  }
  return { ...DEFAULT_FORM, filePath: s };
}

function composeDsn(f: ConnForm): string {
  if (f.driver === "sqlite") {
    return `sqlite://${f.filePath.trim() || "./data/sakuio.db"}?mode=rwc`;
  }
  const auth = f.username
    ? `${encodeURIComponent(f.username)}${f.password ? `:${encodeURIComponent(f.password)}` : ""}@`
    : "";
  const port = f.port.trim() ? `:${f.port.trim()}` : "";
  return `${f.driver}://${auth}${f.host.trim()}${port}/${f.database.trim()}`;
}

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(2)} ${units[i]}`;
}

export default function DatabasePage() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [sourceDsn, setSourceDsn] = useState("");
  const [prefix, setPrefix] = useState("metric_");
  const [maxConns, setMaxConns] = useState(25);
  const [minIdle, setMinIdle] = useState(5);
  const [configMax, setConfigMax] = useState(16);
  const [configMinIdle, setConfigMinIdle] = useState(0);
  const [b1m, setB1m] = useState(600);
  const [b5m, setB5m] = useState(3000);
  const [b1h, setB1h] = useState(600);
  const [days, setDays] = useState<Record<string, number>>({});
  const [configTarget, setConfigTarget] = useState<"main" | "metrics" | null>(null);
  const [form, setForm] = useState<ConnForm>({ ...DEFAULT_FORM });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDatabaseInfo();
      setInfo(data);
      setPrefix(data.metrics.table_prefix);
      setMaxConns(data.metrics.max_connections);
      setMinIdle(data.metrics.min_idle_connections);
      setB1m(data.metrics.bucket_1m_minutes);
      setB5m(data.metrics.bucket_5m_minutes);
      setB1h(data.metrics.bucket_1h_hours);
      setDays(Object.fromEntries(data.retention.items.map((i) => [i.key, i.days])));
    } catch {
      toast.error(t("admin.database.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 迁移运行中每 2 秒轮询状态。
  useEffect(() => {
    if (!info?.migration.running) return;
    const timer = setInterval(() => void reload(), 2_000);
    return () => clearInterval(timer);
  }, [info?.migration.running, reload]);

  const openConfig = (target: "main" | "metrics") => {
    if (!info) return;
    setForm(parseDsn(target === "main" ? info.main.dsn : info.metrics.dsn));
    setConfigMax(target === "main" ? info.main.max_connections : info.metrics.max_connections);
    setConfigMinIdle(target === "main" ? 0 : info.metrics.min_idle_connections);
    setConfigTarget(target);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateDatabase({
        table_prefix: prefix,
        max_connections: maxConns,
        min_idle_connections: minIdle,
        bucket_1m_minutes: b1m,
        bucket_5m_minutes: b5m,
        bucket_1h_hours: b1h,
        retention: days,
      });
      toast.success(t("common.success"));
      await reload();
    } catch {
      toast.error(t("admin.database.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!configTarget) return;
    setSaving(true);
    try {
      const dsn = composeDsn(form);
      if (configTarget === "main") {
        const driver = form.driver === "postgres" ? "postgresql" : form.driver;
        const result = await updateMainDatabase({
          driver,
          dsn,
          max_connections: configMax,
        });
        toast.success(
          result.unchanged
            ? t("common.success")
            : result.restart_required
              ? t("admin.database.restartRequired")
              : t("admin.database.mainSwitchStarted"),
        );
      } else {
        await updateDatabase({
          dsn,
          max_connections: configMax,
          min_idle_connections: configMinIdle,
        });
        toast.success(t("admin.database.metricsSwitched"));
      }
      setConfigTarget(null);
      await reload();
    } catch (e) {
      if (e instanceof Error && e.message.includes("409")) {
        toast.error(t("admin.database.taskConflict"));
      } else {
        toast.error(t("admin.database.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const migrate = async () => {
    setMigrating(true);
    try {
      await startMigration(sourceDsn);
      toast.success(t("admin.database.migrationStarted"));
      await reload();
    } catch {
      toast.error(t("admin.database.migrationFailed"));
    } finally {
      setMigrating(false);
    }
  };

  const configTitle =
    configTarget === "main"
      ? t("admin.database.mainDb")
      : t("admin.database.metricsDb");

  return (
    <section className="page-container">
      <PageListHeader
        titleKey="admin.nav.settingsDatabase"
        actions={
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            <Save size={16} aria-hidden />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      />

      {loading ? <LoadingBlock label={t("common.loading")} /> : null}

      {!loading && info ? (
        <div className="db-page">
          {info.maintenance ? (
            <div className="db-maintenance-banner">
              <AlertTriangle size={18} aria-hidden />
              <div>
                <strong>{t("admin.database.maintenance")}</strong>
                <p>{t("admin.database.maintenanceHint")}</p>
              </div>
            </div>
          ) : null}

          <div className="db-cards">
            <section className="page-card site-settings-card db-card">
              <h3 className="site-settings-card__title db-card__title">
                <HardDrive size={18} aria-hidden /> {t("admin.database.mainDb")}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="db-card__config"
                  onClick={() => openConfig("main")}
                >
                  <Settings2 size={14} aria-hidden />
                  {t("admin.database.configure")}
                </Button>
              </h3>
              <p className="db-card__meta">
                {info.main.kind === "sqlite"
                  ? t("admin.database.localSqlite")
                  : info.main.kind.toUpperCase()}
              </p>
              <p className="db-card__size">{formatBytes(info.main.size_bytes)}</p>
            </section>

            <section className="page-card site-settings-card db-card">
              <h3 className="site-settings-card__title db-card__title">
                <Database size={18} aria-hidden /> {t("admin.database.metricsDb")}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="db-card__config"
                  onClick={() => openConfig("metrics")}
                >
                  <Settings2 size={14} aria-hidden />
                  {t("admin.database.configure")}
                </Button>
              </h3>
              <p className="db-card__meta">{t(`admin.database.kind.${info.metrics.kind}`)}</p>
              <p className="db-card__size">
                {info.metrics.shared ? t("admin.database.sharedMain") : formatBytes(info.metrics.size_bytes)}
              </p>
            </section>
          </div>

          <section className="page-card site-settings-card">
            <h3 className="site-settings-card__title">{t("admin.database.advanced")}</h3>
            <div className="db-advanced">
              <label className="admin-sidebar-form__label">
                {t("admin.database.tablePrefix")}
                <Input value={prefix} onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefix(e.target.value)} />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.database.maxConnections")}
                <Input
                  type="number"
                  value={maxConns}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxConns(Number(e.target.value))}
                />
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.database.minIdleConnections")}
                <Input
                  type="number"
                  value={minIdle}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setMinIdle(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="db-subsection">
              <span className="db-subsection__title">{t("admin.database.bucketRetention")}</span>
              <span className="admin-sidebar-form__hint">{t("admin.database.bucketHint")}</span>
            </div>
            <div className="db-advanced">
              <label className="admin-sidebar-form__label">
                {t("admin.database.bucket1m")}
                <span className="db-bucket-input">
                  <Input
                    type="number"
                    value={b1m}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setB1m(Number(e.target.value))}
                  />
                  <em>{t("admin.database.minutes")}</em>
                </span>
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.database.bucket5m")}
                <span className="db-bucket-input">
                  <Input
                    type="number"
                    value={b5m}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setB5m(Number(e.target.value))}
                  />
                  <em>{t("admin.database.minutes")}</em>
                </span>
              </label>
              <label className="admin-sidebar-form__label">
                {t("admin.database.bucket1h")}
                <span className="db-bucket-input">
                  <Input
                    type="number"
                    value={b1h}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setB1h(Number(e.target.value))}
                  />
                  <em>{t("admin.database.hours")}</em>
                </span>
              </label>
            </div>
          </section>

          <section className="page-card site-settings-card">
            <div className="db-retention-heading">
              <div>
                <h3 className="site-settings-card__title">{t("admin.database.retentionDays")}</h3>
                <span className="admin-sidebar-form__hint">{t("admin.database.retentionHint")}</span>
              </div>
              <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
                <Save size={16} aria-hidden />
                {saving ? t("common.saving") : t("admin.database.saveRetention")}
              </Button>
            </div>
            <table className="db-retention-table">
              <thead>
                <tr>
                  <th>{t("admin.database.colName")}</th>
                  <th>{t("admin.database.colKey")}</th>
                  <th>{t("admin.database.colType")}</th>
                  <th>{t("admin.database.colUnit")}</th>
                  <th>{t("admin.database.colDays")}</th>
                </tr>
              </thead>
              <tbody>
                {info.retention.items.map((item) => (
                  <tr key={item.key}>
                    <td>{t(`admin.database.metricNames.${item.key}`)}</td>
                    <td>
                      <code>{item.key}</code>
                    </td>
                    <td>{item.kind}</td>
                    <td>{item.unit || "-"}</td>
                    <td>
                      <Input
                        type="number"
                        value={days[item.key] ?? 90}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setDays((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="page-card site-settings-card">
            <h3 className="site-settings-card__title">{t("admin.database.migration")}</h3>
            <span className="admin-sidebar-form__hint">{t("admin.database.migrationHint")}</span>
            <p className="admin-muted">
              {t("admin.database.migrationStatus")}:{" "}
              {info.migration.running
                ? [
                    info.migration.kind === "main_switch"
                      ? t("admin.database.taskMainSwitch")
                      : info.migration.kind === "metrics_migrate"
                        ? t("admin.database.taskMetricsMigrate")
                        : null,
                    `${t("admin.database.migrationRunning")} — ${info.migration.phase}`,
                  ]
                  .filter(Boolean)
                  .join(" / ")
                : info.migration.error
                  ? t("admin.database.migrationFailed")
                  : info.migration.finished_at
                    ? t("admin.database.migrationDone")
                    : t("admin.database.migrationIdle")}
            </p>
            {!info.migration.running && info.migration.error ? (
              <p className="admin-muted">{info.migration.error}</p>
            ) : null}
            <div className="db-migrate-row">
              <Input
                value={sourceDsn}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSourceDsn(e.target.value)}
                placeholder={t("admin.database.sourceDsnPlaceholder")}
              />
              <Button
                type="button"
                size="sm"
                disabled={migrating || info.migration.running}
                onClick={() => void migrate()}
              >
                <RefreshCw size={14} aria-hidden />
                {t("admin.database.startMigration")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <GenericSidebar
        open={configTarget !== null}
        title={`${configTitle} ${t("admin.database.configure")}`}
        onClose={() => setConfigTarget(null)}
        footer={
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void saveConfig()}
          >
            <Save size={16} aria-hidden />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      >
        <label className="admin-sidebar-form__label">
          {t("admin.database.dbType")}
          <Select
            value={form.driver}
            onChange={(v) =>
              setForm((f) => ({
                ...f,
                driver: v === "mysql" ? "mysql" : v === "postgres" ? "postgres" : "sqlite",
              }))
            }
            options={[
              { value: "sqlite", label: "SQLite" },
              { value: "mysql", label: "MySQL / MariaDB" },
              { value: "postgres", label: "PostgreSQL" },
            ]}
          />
        </label>

        {form.driver === "sqlite" ? (
          <label className="admin-sidebar-form__label">
            {t("admin.database.filePath")}
            <Input
              value={form.filePath}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, filePath: e.target.value }))}
              placeholder="./data/sakuio.db"
            />
          </label>
        ) : (
          <>
            <label className="admin-sidebar-form__label">
              {t("admin.database.host")}
              <Input
                value={form.host}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, host: e.target.value }))}
                placeholder="127.0.0.1"
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.database.port")}
              <Input
                type="number"
                value={form.port}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, port: e.target.value }))}
                placeholder={form.driver === "mysql" ? "3306" : "5432"}
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.database.dbName")}
              <Input
                value={form.database}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, database: e.target.value }))}
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.database.dbUser")}
              <Input
                value={form.username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, username: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="admin-sidebar-form__label">
              {t("admin.database.dbPassword")}
              <Input
                type="password"
                value={form.password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </label>
          </>
        )}

        <label className="admin-sidebar-form__label">
          {t("admin.database.maxConnections")}
          <Input
            type="number"
            min={1}
            max={64}
            value={configMax}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfigMax(Number(e.target.value))}
          />
        </label>
        {configTarget === "metrics" ? (
          <label className="admin-sidebar-form__label">
            {t("admin.database.minIdleConnections")}
            <Input
              type="number"
              min={0}
              value={configMinIdle}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setConfigMinIdle(Number(e.target.value))}
            />
          </label>
        ) : null}

        {configTarget === "main" ? (
          <p className="admin-sidebar-form__hint">
            {t("admin.database.mainConfigHint")}
          </p>
        ) : (
          <p className="admin-sidebar-form__hint">
            {t("admin.database.metricsConfigHint")}
          </p>
        )}
      </GenericSidebar>
    </section>
  );
}
