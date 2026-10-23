import { Button, Input, Spinner, toast } from "@sakuio/ui";
import { Check, Download, Palette, Plus, RefreshCw, Settings2, Trash2, Upload } from "lucide-react";
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
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import "../styles/themes.css";

type Props = { mode: "installed" | "market" };

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

const DEFAULT_SOURCE = {
  name: "Komari Official",
  url: "https://ghfast.top/raw.githubusercontent.com/komari-monitor/theme-market/main/v1.json",
};

type ThemeSource = { name: string; url: string };

function loadSources(): ThemeSource[] {
  try {
    const raw = localStorage.getItem("sakuio.theme.sources");
    const parsed = raw ? (JSON.parse(raw) as ThemeSource[]) : [];
    const valid = parsed.filter((item) => item?.name && item?.url);
    return valid.length ? valid : [DEFAULT_SOURCE];
  } catch {
    return [DEFAULT_SOURCE];
  }
}

function loadProxy(): string {
  try { return localStorage.getItem("sakuio.github.proxy") ?? ""; } catch { return ""; }
}

function accelerated(url: string, proxy: string): string {
  const value = proxy.trim().replace(/\/+$/, "");
  if (!value) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (url.startsWith(value)) return url;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "github.com" || host === "raw.githubusercontent.com" || host.endsWith(".githubusercontent.com")) {
      return `${value}/${url}`;
    }
  } catch {
    // Leave malformed URLs untouched; the image/error handler will surface it.
  }
  return url;
}

function ThemePreview({ src, alt, proxy }: { src: string | null; alt: string; proxy: string }) {
  const [broken, setBroken] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const actualSrc = src ? accelerated(src, proxy) : null;

  useEffect(() => {
    setBroken(false);
  }, [actualSrc]);

  useEffect(() => {
    // Cached images can finish before React's onLoad handler is attached.
    if (imageRef.current?.complete && imageRef.current.naturalWidth > 0) {
      setLoadedUrl(actualSrc);
    }
  }, [actualSrc]);

  if (!actualSrc || broken) {
    return (
      <div className="theme-card__placeholder">
        <Palette size={32} aria-hidden />
      </div>
    );
  }
  const loading = loadedUrl !== actualSrc;
  return (
    <>
      <img
        ref={imageRef}
        className="theme-card__preview"
        src={actualSrc}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoadedUrl(actualSrc)}
        onError={() => { setLoadedUrl(actualSrc); setBroken(true); }}
      />
      {loading ? (
        <div className="theme-card__preview-loading" role="status" aria-label="加载预览图">
          <Spinner size={22} />
        </div>
      ) : null}
    </>
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
  const [sources, setSources] = useState<ThemeSource[]>(loadSources);
  const [activeSource, setActiveSource] = useState<ThemeSource>(() => loadSources()[0]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [githubProxy, setGithubProxy] = useState(loadProxy);
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
        const data = await fetchMarket(false, accelerated(activeSource.url, githubProxy));
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
  }, [mode, t, activeSource.url, githubProxy]);

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

  const persistSources = (next: ThemeSource[]) => {
    setSources(next);
    try { localStorage.setItem("sakuio.theme.sources", JSON.stringify(next)); } catch { /* ignore */ }
  };

  const saveGithubProxy = (value: string) => {
    setGithubProxy(value);
    try { localStorage.setItem("sakuio.github.proxy", value.trim()); } catch { /* ignore */ }
  };

  const addSource = () => {
    const name = newSourceName.trim();
    const url = newSourceUrl.trim();
    if (!name || !/^https?:\/\//i.test(url)) {
      toast.error(t("admin.themes.sourceInvalid"));
      return;
    }
    if (sources.some((source) => source.url === url)) {
      toast.error(t("admin.themes.sourceDuplicate"));
      return;
    }
    const next = [...sources, { name, url }];
    persistSources(next);
    setActiveSource({ name, url });
    setNewSourceName("");
    setNewSourceUrl("");
  };

  const removeSource = (url: string) => {
    if (url === DEFAULT_SOURCE.url) return;
    const next = sources.filter((source) => source.url !== url);
    persistSources(next.length ? next : [DEFAULT_SOURCE]);
    if (activeSource.url === url) setActiveSource(next[0] ?? DEFAULT_SOURCE);
  };

  const installedByShort = new Map(themes.map((theme) => [theme.short, theme]));

  return (
    <section className="page-container">
      <div className="theme-market-banner">
        <Palette size={18} aria-hidden />
        <span>{t("admin.themes.ecosystemBanner")}</span>
      </div>
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
            <Button type="button" variant="secondary" size="sm" onClick={() => setSourceOpen(true)}>
              <Settings2 size={16} aria-hidden />
              {t("admin.themes.manageSources")}
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
                <ThemePreview src={theme.preview_url} alt={theme.name} proxy={githubProxy} />
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
                  <ThemePreview src={entry.preview || null} alt={entry.name} proxy={githubProxy} />
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

      <GenericSidebar
        open={sourceOpen}
        title={t("admin.themes.manageSources")}
        onClose={() => setSourceOpen(false)}
        initialWidth={520}
      >
        <div className="theme-source-panel">
          <p className="theme-source-hint">{t("admin.themes.sourcesHint")}</p>
          <div className="theme-source-list">
            {sources.map((source) => (
              <div className={`theme-source-row${source.url === activeSource.url ? " is-active" : ""}`} key={source.url}>
                <button
                  type="button"
                  className="theme-source-select"
                  onClick={() => setActiveSource(source)}
                >
                  <span>{source.name}</span>
                  <small>{source.url}</small>
                  {source.url === activeSource.url ? <Check size={15} /> : null}
                </button>
                {source.url !== DEFAULT_SOURCE.url ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeSource(source.url)}>
                    <Trash2 size={14} aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="theme-source-add">
            <strong>{t("admin.themes.addSource")}</strong>
            <Input value={newSourceName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSourceName(e.target.value)} placeholder={t("admin.themes.sourceName")} />
            <Input value={newSourceUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSourceUrl(e.target.value)} placeholder="https://example.com/v1.json" />
            <Button type="button" size="sm" onClick={addSource}><Plus size={14} />{t("common.add")}</Button>
          </div>

          <label className="admin-sidebar-form__label">
            <span className="admin-sidebar-form__label-text">{t("admin.themes.githubProxy")}</span>
            <Input
              value={githubProxy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => saveGithubProxy(e.target.value)}
              placeholder="https://ghfast.top"
            />
            <span className="admin-sidebar-form__hint">{t("admin.themes.githubProxyHint")}</span>
          </label>
        </div>
      </GenericSidebar>

    </section>
  );
}
