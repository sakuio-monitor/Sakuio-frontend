import { Button, Input, Select, Spinner, Textarea, toast } from "@sakuio/ui";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { fetchAllPingTasks } from "../api/pingTasks";
import {
  fetchThemeConfig,
  fetchThemes,
  saveThemeConfig,
  type ThemeConfigItem,
  type ThemeConfigView,
} from "../api/themes";
import { LoadingBlock } from "../components/LoadingBlock";
import { Tabs } from "../components/Tabs/Tabs";
import { Switch } from "../components/ui/Switch";
import { PageListHeader } from "../components/PageListHeader";
import { usePageTitle } from "../contexts/PageTitleContext";
import "../styles/site-settings.css";
import "../styles/theme-settings.css";

type ClientOption = { uuid: string; name: string };
type PingOption = { id: number; name: string };
type ConfigGroup = { title?: unknown; items: ThemeConfigItem[] };

function localized(value: unknown, language: string): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const map = value as Record<string, unknown>;
  for (const key of [language, "zh-CN", "en", "ja"]) {
    const text = map[key];
    if (typeof text === "string" && text.trim()) return text;
  }
  return Object.values(map).find((text): text is string => typeof text === "string" && !!text.trim()) ?? "";
}

function parseIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function ThemeSettingsPage() {
  const { short = "" } = useParams<{ short: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "en";

  const [config, setConfig] = useState<ThemeConfigView | null>(null);
  const [themeName, setThemeName] = useState(short);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [pingTasks, setPingTasks] = useState<PingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchThemeConfig(short),
      fetchThemes().catch(() => ({ themes: [], active: "" })),
    ])
      .then(([view, list]) => {
        if (!alive) return;
        setConfig(view);
        setValues({ ...view.values });
        const theme = list.themes.find((row) => row.short === short);
        if (theme?.name) setThemeName(theme.name);
        const needsNodes = view.items.some((item) => item.type === "nodes");
        const needsPing = view.items.some((item) => item.type === "pingtasks");
        if (needsNodes) {
          void fetch("/api/admin/clients?limit=500", { credentials: "include" })
            .then((response) => response.json())
            .then((data: { items?: Array<{ uuid: string; name?: string }> }) => {
              if (!alive) return;
              setClients(
                (data.items ?? []).map((client) => ({
                  uuid: client.uuid,
                  name: client.name || client.uuid,
                })),
              );
            })
            .catch(() => undefined);
        }
        if (needsPing) {
          void fetchAllPingTasks()
            .then((tasks) => {
              if (!alive) return;
              setPingTasks(tasks.map((task) => ({ id: task.id, name: task.name || String(task.id) })));
            })
            .catch(() => undefined);
        }
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : t("common.error")))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [short, t]);

  const pageTitle = useMemo(() => {
    const configured = localized(config?.name, language);
    return configured || t("admin.themes.manageWithName", { name: themeName || short });
  }, [config?.name, language, short, t, themeName]);
  usePageTitle(pageTitle);

  const items = useMemo(() => config?.items ?? [], [config]);
  const groups = useMemo<ConfigGroup[]>(() => {
    const result: ConfigGroup[] = [];
    let current: ConfigGroup = { items: [] };
    for (const item of items) {
      if (item.type === "title") {
        if (current.title !== undefined || current.items.length > 0) result.push(current);
        current = { title: item.name, items: [] };
      } else {
        current.items.push(item);
      }
    }
    if (current.title !== undefined || current.items.length > 0) result.push(current);
    return result;
  }, [items]);

  useEffect(() => {
    if (activeTab >= groups.length) setActiveTab(0);
  }, [activeTab, groups.length]);

  const visibleGroup = groups[activeTab] ?? groups[0];
  const managed = config?.type === "managed";

  function setValue(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSelection(item: ThemeConfigItem, id: string) {
    const key = item.key;
    if (!key) return;
    const current = parseIds(values[key]);
    const next = current.includes(id)
      ? current.filter((value) => value !== id)
      : [...current, id];
    setValue(key, item.type === "pingtasks" ? next.map(Number) : next);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveThemeConfig(short, values);
      setConfig(saved);
      setValues({ ...saved.values });
      toast.success(t("admin.themes.configSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  function renderControl(item: ThemeConfigItem) {
    const key = item.key ?? "";
    const value = values[key];
    if (item.type === "switch") {
      return (
        <Switch
          checked={Boolean(value)}
          label={localized(item.name, language) || key}
          onChange={(checked) => setValue(key, checked)}
        />
      );
    }
    if (item.type === "select") {
      return (
        <Select
          value={String(value ?? "")}
          options={(item.options ?? "")
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean)
            .map((option) => ({ label: option, value: option }))}
          onChange={(next) => setValue(key, String(next))}
        />
      );
    }
    if (item.type === "number") {
      return (
        <Input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setValue(key, event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      );
    }
    if (item.type === "richtext") {
      return (
        <Textarea
          rows={6}
          value={String(value ?? "")}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
            setValue(key, event.target.value)
          }
        />
      );
    }
    if (item.type === "string" || item.type === "") {
      return (
        <Input
          value={String(value ?? "")}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setValue(key, event.target.value)
          }
        />
      );
    }
    if (item.type === "nodes" || item.type === "pingtasks") {
      const options =
        item.type === "nodes"
          ? clients.map((client) => ({ id: client.uuid, name: client.name }))
          : pingTasks.map((task) => ({ id: String(task.id), name: task.name }));
      return (
        <div className="theme-config-selection">
          {options.length === 0 ? (
            <p className="theme-config-selection__empty">{t("admin.themes.noOptions")}</p>
          ) : null}
          {options.map((option) => (
            <label className="theme-config-selection__option" key={option.id}>
              <input
                type="checkbox"
                checked={parseIds(value).includes(option.id)}
                onChange={() => toggleSelection(item, option.id)}
              />
              <span>{option.name}</span>
            </label>
          ))}
        </div>
      );
    }
    return null;
  }

  if (loading && !config) {
    return (
      <section className="page-container">
        <PageListHeader title={pageTitle} />
        <LoadingBlock label={t("common.loading")} />
      </section>
    );
  }

  return (
    <section className="page-container">
      <PageListHeader
        title={pageTitle}
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={14} aria-hidden />
              {t("common.back")}
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={!managed}
              onClick={() => void save()}
            >
              {t("admin.themes.saveConfig")}
            </Button>
          </>
        }
      />

      {error ? <p className="theme-settings__error">{error}</p> : null}

      {managed && groups.length > 1 ? (
        <Tabs
          items={groups.map((group, index) => ({
            id: String(index),
            label:
              localized(group.title, language) || t("admin.themes.general"),
          }))}
          value={String(activeTab)}
          onChange={(id) => setActiveTab(Number(id))}
          ariaLabel={pageTitle}
        />
      ) : null}

      {!managed && config ? (
        <section className="page-card site-settings-card">
          <p className="theme-settings__notice">
            {t("admin.themes.unsupportedConfig", { type: config.type })}
          </p>
        </section>
      ) : null}

      {managed && groups.length === 0 ? (
        <section className="page-card site-settings-card">
          <p className="theme-settings__notice">{t("admin.themes.noConfig")}</p>
        </section>
      ) : null}

      {managed && visibleGroup ? (
        <section className="page-card site-settings-card" key={`group-${activeTab}`}>
          {visibleGroup.title !== undefined && groups.length <= 1 ? (
            <h3 className="site-settings-card__title">
              {localized(visibleGroup.title, language) || t("admin.themes.general")}
            </h3>
          ) : null}
          {visibleGroup.items.map((item, index) => {
            if (item.type === "textbox") {
              return (
                <div
                  className="theme-settings__textbox"
                  key={`textbox-${index}`}
                  dangerouslySetInnerHTML={{ __html: localized(item.name, language) }}
                />
              );
            }
            const key = item.key ?? "";
            const label = localized(item.name, language) || key;
            const help = localized(item.help, language);
            const wide =
              item.type === "richtext" ||
              item.type === "nodes" ||
              item.type === "pingtasks";
            return (
              <div
                className={`site-settings-row${wide ? " theme-settings-row--wide" : ""}`}
                key={key || `item-${index}`}
              >
                <div className="site-settings-row__text">
                  <span>
                    {label}
                    {item.required ? (
                      <em className="theme-settings__required">*</em>
                    ) : null}
                  </span>
                  {help ? <span className="admin-sidebar-form__hint">{help}</span> : null}
                </div>
                <div
                  className={`site-settings-row__actions theme-settings__control${
                    item.type === "switch" ? " theme-settings__control--switch" : ""
                  }`}
                >
                  {renderControl(item)}
                </div>
              </div>
            );
          })}
        </section>
      )        : null}

    </section>
  );
}
