import { Button, Spinner, toast } from "@sakuio/ui";
import { Check, Download, Palette, RefreshCw, Settings2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import {
  applyTheme,
  deleteTheme,
  fetchMarket,
  fetchThemes,
  installMarketTheme,
  updateTheme,
  uploadTheme,
  watchThemeJob,
  type MarketRow,
  type ThemeJobEvent,
  type ThemeRow,
} from "../api/themes";
import { PageListHeader } from "../components/PageListHeader";
import "../styles/themes.css";

type Props = { mode: "installed" | "market" };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function ThemePreview({ src, alt }: { src: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) {
    return (
      <div className="theme-card__placeholder">
        <Palette size={32} aria-hidden />
      </div>
    );
  }
  return (
    <img
      className="theme-card__preview"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  );
}

function ThemeCardStatus({ event }: { event: ThemeJobEvent | undefined }) {
  const { t } = useTranslation();
  if (!event) return null;
  const failed = event.status === "error";
  const done = event.status === "done";
  const percent = event.percent ?? (done ? 100 : null);
  const detail = failed
    ? event.message ?? t("admin.themes.jobFailed")
    : done
      ? t("admin.themes.jobDone")
      : `${formatBytes(event.downloaded)}${
          event.total ? ` / ${formatBytes(event.total)}` : ""
        }${event.speed_bps ? ` / ${formatBytes(event.speed_bps)}/s` : ""}`;
  return (
    <div
      className={`theme-card__status${failed ? " theme-card__status--error" : ""}${
        done ? " theme-card__status--done" : ""
      }`}
      title={failed ? event.message ?? undefined : undefined}
      role={failed ? "alert" : "status"}
    >
      <div className="theme-card__status-head">
        <span className="theme-card__status-phase">
          {event.status === "running" ? <Spinner size={12} /> : null}
          {t(`admin.themes.phase.${event.phase}`)}
        </span>
        <span>{percent !== null ? `${Math.round(percent)}%` : ""}</span>
      </div>
      <div className="theme-card__status-track">
        <div
          className="theme-card__status-bar"
          style={{ width: `${failed ? 100 : Math.max(2, percent ?? 0)}%` }}
        />
      </div>
      <div className="theme-card__status-detail">{detail}</div>
    </div>
  );
}

export default function ThemesPage({ mode }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [market, setMarket] = useState<MarketRow[]>([]);
  const [active, setActive] = useState("default");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, ThemeJobEvent>>({});
  const [starting, setStarting] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const jobClosers = useRef(new Map<string, () => void>());

  useEffect(
    () => () => {
      for (const close of jobClosers.current.values()) close();
      jobClosers.current.clear();
    },
    [],
  );

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      if (mode === "market") {
        const data = await fetchMarket();
        setMarket(data.themes);
        const installed = await fetchThemes();
        setThemes(installed.themes);
        setActive(installed.active);
      } else {
        const data = await fetchThemes();
        setThemes(data.themes);
        setActive(data.active);
      }
      window.dispatchEvent(new Event("sakuio:themes-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [mode, t]);

  useEffect(() => {
    void reload(true);
  }, [reload]);

  const isRunning = (short: string) =>
    starting[short] === true || jobs[short]?.status === "running";

  async function startJob(
    short: string,
    kind: "install" | "update",
    starter: () => Promise<{ job_id: string }>,
  ) {
    if (isRunning(short)) return;
    setStarting((prev) => ({ ...prev, [short]: true }));
    setError(null);
    try {
      const { job_id } = await starter();
      setJobs((prev) => ({
        ...prev,
        [short]: {
          job_id,
          short,
          kind,
          phase: "queued",
          status: "running",
          downloaded: 0,
          total: null,
          speed_bps: 0,
          percent: null,
          message: null,
          updated: null,
        },
      }));
      setStarting((prev) => ({ ...prev, [short]: false }));
      jobClosers.current.get(short)?.();
      let close: () => void = () => {};
      close = watchThemeJob(job_id, (event) => {
        setJobs((prev) => ({ ...prev, [short]: event }));
        setStarting((prev) => ({ ...prev, [short]: false }));
        if (event.status === "done") {
          close();
          jobClosers.current.delete(short);
          toast.success(
            event.updated === false
              ? t("admin.themes.alreadyLatest")
              : t("admin.themes.jobDone"),
          );
          void reload(true);
          window.setTimeout(() => {
            setJobs((prev) => {
              if (prev[short]?.job_id !== job_id) return prev;
              const next = { ...prev };
              delete next[short];
              return next;
            });
          }, 5000);
        } else if (event.status === "error") {
          close();
          jobClosers.current.delete(short);
        }
      });
      jobClosers.current.set(short, close);
    } catch (err) {
      setStarting((prev) => ({ ...prev, [short]: false }));
      setError(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    setError(null);
    try {
      await action();
      toast.success(success);
      await reload(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  function onUpload(file: File | undefined) {
    if (!file) return;
    void run(
      "upload",
      () => uploadTheme(file),
      t("admin.themes.uploadSuccess"),
    );
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirmDelete(theme: ThemeRow) {
    if (!window.confirm(t("admin.themes.deleteConfirm", { name: theme.name }))) return;
    void run(theme.short, () => deleteTheme(theme.short), t("admin.themes.deleteSuccess"));
  }

  const installedByShort = new Map(themes.map((theme) => [theme.short, theme]));

  return (
    <section className="page-container">
      <PageListHeader
        titleKey={mode === "market" ? "admin.nav.marketThemes" : "admin.nav.themes"}
        actions={
          <>
            {mode === "installed" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip,application/zip"
                  hidden
                  onChange={(event) => onUpload(event.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={16} aria-hidden />
                  {busy === "upload" ? t("common.saving") : t("admin.themes.upload")}
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => void reload(true)}
            >
              <RefreshCw size={16} aria-hidden />
              {t("common.refresh")}
            </Button>
          </>
        }
      />

      {error ? <p className="theme-card__error">{error}</p> : null}
      {loading ? <LoadingBlock label={t("common.loading")} /> : null}

      {!loading && mode === "installed" ? (
        <div className="themes-grid">
          {themes.map((theme) => (
            <article className="page-card theme-card" key={theme.short}>
              <div className="theme-card__media">
                <ThemePreview src={theme.preview_url} alt={theme.name} />
                <ThemeCardStatus event={jobs[theme.short]} />
              </div>
              <div className="theme-card__body">
                <div className="theme-card__title">
                  <span className="theme-card__name">{theme.name}</span>
                  {theme.active ? (
                    <span className="theme-card__badge">{t("admin.themes.active")}</span>
                  ) : null}
                  {theme.config_items > 0 ? (
                    <button
                      type="button"
                      className="theme-card__config"
                      title={t("admin.themes.configure")}
                      aria-label={t("admin.themes.configure")}
                      onClick={() => navigate(`/themes/${encodeURIComponent(theme.short)}/settings`)}
                    >
                      <Settings2 size={14} />
                    </button>
                  ) : null}
                </div>
                <p className="theme-card__meta">
                  {theme.short} / v{theme.version}
                  {theme.author ? ` / ${theme.author}` : ""}
                </p>
                <p className="theme-card__description">{theme.description}</p>
                <div className="theme-card__actions">
                  <Button
                    type="button"
                    size="sm"
                    variant={theme.active ? "secondary" : undefined}
                    disabled={theme.active || busy !== null || isRunning(theme.short)}
                    onClick={() =>
                      void run(theme.short, () => applyTheme(theme.short), t("admin.themes.applied"))
                    }
                  >
                    {theme.active ? <Check size={14} aria-hidden /> : null}
                    {theme.active ? t("admin.themes.current") : t("admin.themes.apply")}
                  </Button>
                  {theme.short !== "default" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null || isRunning(theme.short)}
                        onClick={() =>
                          void startJob(theme.short, "update", () =>
                            updateTheme(theme.short),
                          )
                        }
                      >
                        <RefreshCw size={14} aria-hidden />
                        {t("admin.themes.update")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={theme.active || busy !== null || isRunning(theme.short)}
                        onClick={() => confirmDelete(theme)}
                      >
                        <Trash2 size={14} aria-hidden />
                        {t("common.delete")}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!loading && mode === "market" ? (
        <div className="themes-grid">
          {market.map((entry) => {
            const installed = installedByShort.get(entry.short);
            const isActive = installed?.active ?? false;
            const upToDate = installed?.version === entry.version || entry.installed_version === entry.version;
            return (
              <article className="page-card theme-card" key={entry.short}>
                <div className="theme-card__media">
                  <ThemePreview src={entry.preview || null} alt={entry.name} />
                  <ThemeCardStatus event={jobs[entry.short]} />
                </div>
                <div className="theme-card__body">
                  <div className="theme-card__title">
                    <span className="theme-card__name">{entry.name}</span>
                    {isActive ? (
                      <span className="theme-card__badge">{t("admin.themes.active")}</span>
                    ) : null}
                    {installed && installed.config_items > 0 ? (
                      <button
                        type="button"
                        className="theme-card__config"
                        title={t("admin.themes.configure")}
                        aria-label={t("admin.themes.configure")}
                        onClick={() => navigate(`/themes/${encodeURIComponent(installed.short)}/settings`)}
                      >
                        <Settings2 size={14} />
                      </button>
                    ) : null}
                  </div>
                  <p className="theme-card__meta">
                    {entry.short} / v{entry.version}
                    {entry.author ? ` / ${entry.author}` : ""}
                  </p>
                  <p className="theme-card__description">{entry.description}</p>
                  <div className="theme-card__actions">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null || isRunning(entry.short)}
                      onClick={() =>
                        void startJob(entry.short, "install", () =>
                          installMarketTheme(entry.short),
                        )
                      }
                    >
                      <Download size={14} aria-hidden />
                      {installed ? t("admin.themes.reinstall") : t("admin.themes.install")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={!installed || isActive || busy !== null || isRunning(entry.short)}
                      onClick={() =>
                        void run(
                          `${entry.short}:apply`,
                          () => applyTheme(entry.short),
                          t("admin.themes.applied"),
                        )
                      }
                    >
                      {isActive ? t("admin.themes.current") : t("admin.themes.apply")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        !installed || upToDate || busy !== null || isRunning(entry.short)
                      }
                      onClick={() =>
                        void startJob(entry.short, "update", () =>
                          updateTheme(entry.short),
                        )
                      }
                    >
                      <RefreshCw size={14} aria-hidden />
                      {t("admin.themes.update")}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

    </section>
  );
}
