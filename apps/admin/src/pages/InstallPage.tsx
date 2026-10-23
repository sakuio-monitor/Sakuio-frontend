import {
  Button,
  ChoiceGroup,
  Input,
  Select,
  Textarea,
  toast,
} from "@sakuio/ui";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Shield,
  Sparkles,
  Globe2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useInstall } from "../install/InstallProvider";
import "../styles/setup.css";

type StepId = "welcome" | "database" | "metric" | "site" | "admin";

type DbDriver = "sqlite" | "postgresql" | "mysql" | "mariadb";

type InstallForm = {
  appDbDriver: DbDriver;
  dbPath: string;
  dbHost: string;
  dbPort: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSslMode: string;
  metricColocation: "same" | "separate";
  metricDriver: DbDriver;
  metricPath: string;
  metricHost: string;
  metricPort: string;
  metricName: string;
  metricUser: string;
  metricPassword: string;
  metricSslMode: string;
  sitename: string;
  description: string;
  username: string;
  password: string;
  passwordConfirm: string;
};

const STEP_ORDER: StepId[] = ["welcome", "database", "metric", "site", "admin"];

const initialForm: InstallForm = {
  appDbDriver: "sqlite",
  dbPath: "./data/sakuio.db",
  dbHost: "127.0.0.1",
  dbPort: "3306",
  dbName: "sakuio",
  dbUser: "sakuio",
  dbPassword: "",
  dbSslMode: "prefer",
  metricColocation: "same",
  metricDriver: "postgresql",
  metricPath: "./data/sakuio-metrics.db",
  metricHost: "127.0.0.1",
  metricPort: "3306",
  metricName: "sakuio_metrics",
  metricUser: "sakuio",
  metricPassword: "",
  metricSslMode: "prefer",
  sitename: "Sakuio",
  description: "",
  username: "",
  password: "",
  passwordConfirm: "",
};

function databaseDsn(driver: DbDriver, path: string, host: string, port: string, name: string, user: string, password: string, sslMode: string): string {
  if (driver === "sqlite")
    return `sqlite://${path.trim() || "./data/sakuio.db"}?mode=rwc`
  const scheme = driver === "postgresql" ? "postgres" : "mysql"
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
  const url = `${scheme}://${auth}@${host}:${port}/${name}`
  if (!sslMode.trim())
    return url
  return `${url}?${scheme === "postgres" ? "sslmode" : "ssl-mode"}=${encodeURIComponent(sslMode)}`
}

function databasePayload(driver: DbDriver, path: string, host: string, port: string, name: string, user: string, password: string, sslMode: string) {
  return {
    driver,
    path: driver === "sqlite" ? path.trim() : "",
    host: driver === "sqlite" ? "" : host.trim(),
    port: driver === "sqlite" ? 0 : Number(port) || 0,
    database: driver === "sqlite" ? "" : name.trim(),
    user: driver === "sqlite" ? "" : user.trim(),
    password: driver === "sqlite" ? "" : password,
    ssl_mode: driver === "sqlite" ? "" : sslMode.trim(),
    max_connections: driver === "sqlite" ? 16 : 25,
    min_idle_connections: 0,
  }
}

export default function InstallPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<InstallForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestOk, setDbTestOk] = useState(false);
  const [testingMetricDb, setTestingMetricDb] = useState(false);
  const [metricDbTestOk, setMetricDbTestOk] = useState(false);
  const [finished, setFinished] = useState(false);
  const { refresh, status } = useInstall();

  const step = STEP_ORDER[stepIndex] ?? "welcome";

  useEffect(() => {
    if (status?.database_configured) {
      setStepIndex((current) => Math.max(current, 3));
    }
  }, [status?.database_configured]);

  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => navigate("/dashboard", { replace: true }), 1400);
    return () => window.clearTimeout(timer);
  }, [finished, navigate]);

  const stepLabels = useMemo(
    () =>
      STEP_ORDER.map((id) => ({
        id,
        label: t(`install.steps.${id}`),
      })),
    [t],
  );

  function patchForm<K extends keyof InstallForm>(key: K, value: InstallForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "appDbDriver" || key.startsWith("db")) {
      setDbTestOk(false);
    }
    if (key.startsWith("metric")) {
      setMetricDbTestOk(false);
    }
  }

  async function testDbConnection() {
    const dsn = databaseDsn(form.appDbDriver, form.dbPath, form.dbHost, form.dbPort, form.dbName, form.dbUser, form.dbPassword, form.dbSslMode);
    if (!dsn) {
      toast.error(t("install.errors.dsnRequired"));
      return;
    }
    setTestingDb(true);
    setDbTestOk(false);
    try {
      const res = await fetch("/api/install/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_db_driver: form.appDbDriver,
          app_db_dsn: dsn,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? t("common.error"));
      }
      setDbTestOk(true);
      toast.success(t("install.database.testOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setTestingDb(false);
    }
  }

  async function testMetricDbConnection() {
    if (form.metricColocation === "same") {
      setMetricDbTestOk(true);
      return;
    }
    const dsn = databaseDsn(form.metricDriver, form.metricPath, form.metricHost, form.metricPort, form.metricName, form.metricUser, form.metricPassword, form.metricSslMode);
    if (!dsn) {
      toast.error(t("install.errors.dsnRequired"));
      return;
    }
    setTestingMetricDb(true);
    setMetricDbTestOk(false);
    try {
      const res = await fetch("/api/install/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_db_driver: form.metricDriver, app_db_dsn: dsn }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? t("common.error"));
      }
      setMetricDbTestOk(true);
      toast.success(t("install.database.testOk"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setTestingMetricDb(false);
    }
  }

  function validateCurrentStep(): string | null {
    if (step === "database") {
      if (form.appDbDriver === "sqlite" && !form.dbPath.trim())
        return t("install.errors.dsnRequired");
      if (form.appDbDriver !== "sqlite" && (!form.dbHost.trim() || !form.dbName.trim() || !form.dbUser.trim()))
        return t("install.errors.dsnRequired");
      if (!dbTestOk)
        return t("install.database.testRequired");
    }
    if (step === "metric") {
      if (form.metricColocation === "separate") {
        if (form.metricDriver === "sqlite" && !form.metricPath.trim())
          return t("install.errors.dsnRequired");
        if (form.metricDriver !== "sqlite" && (!form.metricHost.trim() || !form.metricName.trim() || !form.metricUser.trim()))
          return t("install.errors.dsnRequired");
        if (!metricDbTestOk)
          return t("install.database.testRequired");
      }
    }
    if (step === "site") {
      if (!form.sitename.trim()) return t("install.errors.sitenameRequired");
    }
    if (step === "admin") {
      if (!form.username.trim()) return t("install.errors.usernameRequired");
      if (form.password.length < 8) return t("install.errors.passwordShort");
      if (form.password !== form.passwordConfirm) return t("install.errors.passwordMismatch");
    }
    return null;
  }

  function fail(msg: string) {
    toast.error(msg);
  }

  async function configureDatabase() {
    const msg = validateCurrentStep();
    if (msg) {
      fail(msg);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/install/database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_db: databasePayload(form.appDbDriver, form.dbPath, form.dbHost, form.dbPort, form.dbName, form.dbUser, form.dbPassword, form.dbSslMode),
          metric_mode: form.metricColocation,
          metric_db: form.metricColocation === "separate"
            ? databasePayload(form.metricDriver, form.metricPath, form.metricHost, form.metricPort, form.metricName, form.metricUser, form.metricPassword, form.metricSslMode)
            : null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? t("common.error"));
      }
      // The server restarts to open the selected database. Do not continue to
      // the account step until the live process is connected to it.
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        try {
          const status = await fetch("/api/install/status", { cache: "no-store" });
          if (status.ok) {
            const data = (await status.json()) as { database_configured?: boolean };
            if (data.database_configured) {
              await refresh();
              setStepIndex(3);
              return;
            }
          }
        } catch {
          // still restarting
        }
      }
      throw new Error(t("install.errors.databaseRestartTimeout"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  function goNext() {
    const msg = validateCurrentStep();
    if (msg) {
      fail(msg);
      return;
    }
    if (step === "metric") {
      void configureDatabase();
      return;
    }
    if (stepIndex < STEP_ORDER.length - 1) setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function submitInstall() {
    const msg = validateCurrentStep();
    if (msg) {
      fail(msg);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/install/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          sitename: form.sitename,
          description: form.description,
          metric_colocation: form.metricColocation,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? t("common.error"));
      }
      const body = (await res.json().catch(() => ({}))) as { restart?: boolean };
      if (body.restart) {
        // The server re-execs to open the selected database; wait until it answers.
        // 服务会重启以打开所选数据库，等待其恢复响应。
        for (let attempt = 0; attempt < 40; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          try {
            const status = await fetch("/api/install/status", { cache: "no-store" });
            if (status.ok) {
              const data = (await status.json()) as { required?: boolean };
              if (!data.required) break;
            }
          } catch {
            // still restarting
          }
        }
      }
      await refresh();
      toast.success(t("install.successTitle"));
      setFinished(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-shell">
        <header className="setup-header">
          <h1 className="setup-title">{t("install.title")}</h1>
          <p className="setup-subtitle">{t("install.subtitle")}</p>
        </header>

        {!finished ? (
          <>
            <nav className="setup-steps" aria-label={t("install.stepNav")}>
              {stepLabels.map(({ id, label }, index) => {
                const active = index === stepIndex;
                const done = index < stepIndex;
                return (
                  <div
                    key={id}
                    className={`setup-step${active ? " setup-step--active" : ""}${done ? " setup-step--done" : ""}`}
                  >
                    <div className="setup-step__dot">
                      {done ? <Check size={14} strokeWidth={2.5} /> : index + 1}
                    </div>
                    <span className="setup-step__label">{label}</span>
                  </div>
                );
              })}
            </nav>

            <section className="setup-card">
              {step === "welcome" && <WelcomeStep t={t} />}
              {step === "database" && (
                <DatabaseStep
                  form={form}
                  update={patchForm}
                  t={t}
                  dbTestOk={dbTestOk}
                  testingDb={testingDb}
                  onTestDb={() => void testDbConnection()}
                />
              )}
              {step === "metric" && (
                <MetricDatabaseStep
                  form={form}
                  update={patchForm}
                  t={t}
                  testOk={metricDbTestOk}
                  testing={testingMetricDb}
                  onTest={() => void testMetricDbConnection()}
                />
              )}
              {step === "site" && <SiteStep form={form} update={patchForm} t={t} />}
              {step === "admin" && <AdminStep form={form} update={patchForm} t={t} />}

              <div className="setup-actions">
                {stepIndex > 0 ? (
                  <Button variant="ghost" onClick={goBack} icon={<ChevronLeft size={16} aria-hidden />}>
                    {t("install.back")}
                  </Button>
                ) : (
                  <span />
                )}
                {step === "admin" ? (
                  <Button loading={loading} onClick={() => void submitInstall()}>
                    {t("install.complete")}
                  </Button>
                ) : (
                  <Button loading={loading} onClick={goNext} icon={<ChevronRight size={16} aria-hidden />}>
                    {t("install.next")}
                  </Button>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="setup-card setup-done">
            <Check size={36} strokeWidth={2} aria-hidden />
            <h2>{t("install.successTitle")}</h2>
            <p>{t("install.success")}</p>
          </section>
        )}
      </div>
    </main>
  );
}

type StepProps = {
  t: (key: string) => string;
};

function WelcomeStep({ t }: StepProps) {
  return (
    <>
      <h2 className="setup-section-title">
        <Sparkles size={18} aria-hidden />
        {t("install.welcome.heading")}
      </h2>
      <p className="setup-hint">{t("install.welcome.body")}</p>
      <aside className="setup-warning" role="note">
        <p className="setup-warning__title">{t("install.welcome.warningTitle")}</p>
        <p className="setup-warning__body">{t("install.welcome.warningBody")}</p>
      </aside>
    </>
  );
}

const DB_DRIVER_OPTIONS: { value: DbDriver; label: string }[] = [
  { value: "sqlite", label: "SQLite" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
];

function defaultPort(driver: DbDriver): string {
  if (driver === "postgresql")
    return "5432"
  if (driver === "mysql" || driver === "mariadb")
    return "3306"
  return ""
}

function sslModeOptions(driver: DbDriver) {
  if (driver === "postgresql") {
    return ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"].map(value => ({ label: value, value }));
  }
  return ["disable", "prefer", "require", "verify-ca", "verify-identity"].map(value => ({ label: value, value }));
}

function DatabaseStep({
  form,
  update,
  t,
  dbTestOk,
  testingDb,
  onTestDb,
}: StepProps & {
  form: InstallForm;
  update: <K extends keyof InstallForm>(key: K, value: InstallForm[K]) => void;
  dbTestOk: boolean;
  testingDb: boolean;
  onTestDb: () => void;
}) {
  return (
    <>
      <h2 className="setup-section-title">
        <Database size={18} aria-hidden />
        {t("install.database.heading")}
      </h2>
      <p className="setup-hint">{t("install.database.hint")}</p>
      <div className="setup-grid setup-grid--2 mt-4">
        <div className="setup-field">
          <span>{t("install.database.driver")}</span>
          <Select
            value={form.appDbDriver}
            placeholder={t("common.selectPlaceholder")}
            options={DB_DRIVER_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
            onChange={(v) => {
              const driver = String(v) as DbDriver
              update("appDbDriver", driver)
              update("dbPort", defaultPort(driver))
            }}
          />
        </div>
        {form.appDbDriver === "sqlite" ? (
          <Input
            label={t("admin.database.filePath")}
            value={form.dbPath}
            onChange={(e) => update("dbPath", e.target.value)}
            autoComplete="off"
            required
          />
        ) : (
          <>
            <Input label={t("admin.database.host")} value={form.dbHost} onChange={(e) => update("dbHost", e.target.value)} required />
            <Input label={t("admin.database.port")} value={form.dbPort} onChange={(e) => update("dbPort", e.target.value)} inputMode="numeric" required />
            <Input label={t("admin.database.dbName")} value={form.dbName} onChange={(e) => update("dbName", e.target.value)} required />
            <Input label={t("admin.database.dbUser")} value={form.dbUser} onChange={(e) => update("dbUser", e.target.value)} autoComplete="username" required />
            <Input label={t("admin.database.dbPassword")} type="password" value={form.dbPassword} onChange={(e) => update("dbPassword", e.target.value)} autoComplete="current-password" />
            <div className="setup-field">
              <span>{t("install.database.sslMode")}</span>
              <Select value={form.dbSslMode} options={sslModeOptions(form.appDbDriver)} onChange={(v) => update("dbSslMode", String(v))} />
            </div>
          </>
        )}
        <div className="setup-db-test">
          <Button variant="secondary" loading={testingDb} onClick={onTestDb}>
            {testingDb ? t("install.database.testing") : t("install.database.test")}
          </Button>
          {dbTestOk ? <span className="setup-db-test__ok">{t("install.database.testOk")}</span> : null}
        </div>
      </div>
    </>
  );
}

function MetricDatabaseStep({
  form,
  update,
  t,
  testOk,
  testing,
  onTest,
}: StepProps & {
  form: InstallForm;
  update: <K extends keyof InstallForm>(key: K, value: InstallForm[K]) => void;
  testOk: boolean;
  testing: boolean;
  onTest: () => void;
}) {
  return (
    <>
      <h2 className="setup-section-title">
        <Database size={18} aria-hidden />
        {t("install.database.metric")}
      </h2>
      <p className="setup-hint">{t("install.database.metricHint")}</p>
      <ChoiceGroup
        ariaLabel={t("install.database.metric")}
        value={form.metricColocation}
        onChange={(v) => update("metricColocation", v)}
        options={[
          {
            value: "same",
            title: t("install.database.metricSame"),
            hint: t("install.database.metricSameHint"),
          },
          {
            value: "separate",
            title: t("install.database.metricSeparate"),
            hint: t("install.database.metricSeparateHint"),
          },
        ]}
      />
      {form.metricColocation === "separate" ? (
        <div className="setup-grid setup-grid--2 mt-4">
          <div className="setup-field">
            <span>{t("install.database.driver")}</span>
            <Select
              value={form.metricDriver}
              options={DB_DRIVER_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
              onChange={(v) => {
                const driver = String(v) as DbDriver
                update("metricDriver", driver)
                update("metricPort", defaultPort(driver))
              }}
            />
          </div>
          {form.metricDriver === "sqlite" ? (
            <Input
              label={t("admin.database.filePath")}
              value={form.metricPath}
              onChange={(e) => update("metricPath", e.target.value)}
              autoComplete="off"
              required
            />
          ) : (
            <>
              <Input label={t("admin.database.host")} value={form.metricHost} onChange={(e) => update("metricHost", e.target.value)} required />
              <Input label={t("admin.database.port")} value={form.metricPort} onChange={(e) => update("metricPort", e.target.value)} inputMode="numeric" required />
              <Input label={t("admin.database.dbName")} value={form.metricName} onChange={(e) => update("metricName", e.target.value)} required />
              <Input label={t("admin.database.dbUser")} value={form.metricUser} onChange={(e) => update("metricUser", e.target.value)} required />
              <Input label={t("admin.database.dbPassword")} type="password" value={form.metricPassword} onChange={(e) => update("metricPassword", e.target.value)} />
              <div className="setup-field">
                <span>{t("install.database.sslMode")}</span>
                <Select value={form.metricSslMode} options={sslModeOptions(form.metricDriver)} onChange={(v) => update("metricSslMode", String(v))} />
              </div>
            </>
          )}
        </div>
      ) : null}
      <div className="setup-db-test mt-4">
        <Button variant="secondary" loading={testing} onClick={onTest}>
          {testing ? t("install.database.testing") : t("install.database.test")}
        </Button>
        {testOk ? <span className="setup-db-test__ok">{t("install.database.testOk")}</span> : null}
      </div>
    </>
  );
}

function SiteStep({
  form,
  update,
  t,
}: StepProps & {
  form: InstallForm;
  update: <K extends keyof InstallForm>(key: K, value: InstallForm[K]) => void;
}) {
  return (
    <>
      <h2 className="setup-section-title">
        <Globe2 size={18} aria-hidden />
        {t("install.site.heading")}
      </h2>
      <div className="setup-grid mt-2">
        <Input
          label={t("install.sitename")}
          value={form.sitename}
          onChange={(e) => update("sitename", e.target.value)}
          required
        />
        <Textarea
          label={t("install.description")}
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows={3}
        />
      </div>
    </>
  );
}

function AdminStep({
  form,
  update,
  t,
}: StepProps & {
  form: InstallForm;
  update: <K extends keyof InstallForm>(key: K, value: InstallForm[K]) => void;
}) {
  return (
    <>
      <h2 className="setup-section-title">
        <Shield size={18} aria-hidden />
        {t("install.admin.heading")}
      </h2>
      <p className="setup-hint">{t("install.admin.hint")}</p>
      <div className="setup-grid mt-4">
        <Input
          label={t("install.username")}
          value={form.username}
          onChange={(e) => update("username", e.target.value)}
          autoComplete="username"
          required
        />
        <Input
          label={t("install.password")}
            type="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          autoComplete="new-password"
            required
        />
        <Input
          label={t("install.passwordConfirm")}
          type="password"
          value={form.passwordConfirm}
          onChange={(e) => update("passwordConfirm", e.target.value)}
          autoComplete="new-password"
          required
        />
    </div>
    </>
  );
}
