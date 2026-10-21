import { Button, Input, Select, toast } from "@sakuio/ui";
import { Download, FlaskConical, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchSiteSettings,
  updateSiteSettings,
  type SiteSettings,
} from "../api/siteSettings";
import { PageListHeader } from "../components/PageListHeader";
import { Switch } from "../components/ui/Switch";

const GEOIP_PROVIDERS = [
  { value: "ip9", labelKey: "admin.generalSettings.providerIp9" },
  { value: "geojs", labelKey: "admin.generalSettings.providerGeojs" },
  { value: "ip-api", labelKey: "admin.generalSettings.providerIpApi" },
  { value: "mmdb", labelKey: "admin.generalSettings.providerMmdb" },
];

async function updateGeoIpDb(): Promise<number> {
  const res = await fetch("/api/admin/settings/geoip/update", { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    bytes?: number;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? "update failed");
  }
  return body.bytes ?? 0;
}

async function testGeoIp(ip: string): Promise<{ ip: string; location: string }> {
  const res = await fetch("/api/admin/settings/geoip/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ip: ip || null }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ip?: string;
    location?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.message ?? "test failed");
  }
  return { ip: body.ip ?? "", location: body.location ?? "" };
}

export default function SettingsGeneralPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingDb, setUpdatingDb] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testIp, setTestIp] = useState("");
  const [testResult, setTestResult] = useState<string>("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSettings(await fetchSiteSettings());
    } catch {
      toast.error(t("admin.generalSettings.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading || !settings) {
    return (
      <section className="page-container">
        <PageListHeader titleKey="admin.nav.settingsGeneral" />
        <p className="admin-muted">{t("common.loading")}</p>
      </section>
    );
  }

  const patch = (next: Partial<SiteSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await updateSiteSettings({
        auto_discovery_key: settings.auto_discovery_key,
        geoip_enabled: settings.geoip_enabled,
        geoip_provider: settings.geoip_provider,
        geoip_mmdb_url: settings.geoip_mmdb_url,
      });
      setSettings((prev) => (prev ? { ...prev, ...saved } : prev));
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const onUpdateDb = async () => {
    setUpdatingDb(true);
    try {
      const bytes = await updateGeoIpDb();
      toast.success(t("admin.generalSettings.dbUpdated", { bytes }));
    } catch {
      toast.error(t("admin.generalSettings.dbUpdateFailed"));
    } finally {
      setUpdatingDb(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setTestResult("");
    try {
      const result = await testGeoIp(testIp.trim());
      setTestResult(
        result.location
          ? `${result.ip} → ${result.location}`
          : t("admin.generalSettings.testNoLocation", { ip: result.ip }),
      );
    } catch {
      toast.error(t("admin.generalSettings.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="page-container">
      <PageListHeader
        titleKey="admin.nav.settingsGeneral"
        actions={
          <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      />

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">
          {t("admin.generalSettings.sectionDiscovery")}
        </h3>
        <label className="admin-sidebar-form__label">
          {t("admin.generalSettings.discoveryKey")}
          <Input
            value={settings.auto_discovery_key}
            onChange={(e) => patch({ auto_discovery_key: e.target.value })}
            placeholder={t("admin.generalSettings.discoveryKeyPlaceholder")}
          />
          <span className="admin-sidebar-form__hint">
            {t("admin.generalSettings.discoveryKeyHint")}
          </span>
        </label>
        {settings.auto_discovery_key ? (
          <p className="admin-sidebar-form__hint">
            {t("admin.generalSettings.discoveryUsage")}
            <code className="site-settings-code">
              sakuio-agent -e &lt;endpoint&gt; -t {settings.auto_discovery_key} --state
              ./sakuio-agent-token
            </code>
          </p>
        ) : null}
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.generalSettings.sectionGeoip")}</h3>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.generalSettings.geoipEnable")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.generalSettings.geoipEnableHint")}
            </span>
          </div>
          <Switch
            checked={settings.geoip_enabled}
            label={t("admin.generalSettings.geoipEnable")}
            onChange={(checked) => patch({ geoip_enabled: checked })}
          />
        </div>

        <div className="admin-sidebar-form__label">
          <span className="admin-sidebar-form__label-text">
            {t("admin.generalSettings.geoipProvider")}
          </span>
          <Select
            value={settings.geoip_provider}
            onChange={(v) => patch({ geoip_provider: String(v) })}
            options={GEOIP_PROVIDERS.map((p) => ({
              value: p.value,
              label: t(p.labelKey),
            }))}
          />
        </div>

        {settings.geoip_provider === "mmdb" ? (
          <>
            <label className="admin-sidebar-form__label">
              {t("admin.generalSettings.mmdbUrl")}
              <Input
                value={settings.geoip_mmdb_url}
                onChange={(e) => patch({ geoip_mmdb_url: e.target.value })}
                placeholder={t("admin.generalSettings.mmdbUrlPlaceholder")}
              />
              <span className="admin-sidebar-form__hint">
                {t("admin.generalSettings.mmdbUrlHint")}
              </span>
            </label>
            <div className="site-settings-row">
              <div className="site-settings-row__text">
                <span>{t("admin.generalSettings.updateDb")}</span>
                <span className="admin-sidebar-form__hint">
                  {t("admin.generalSettings.updateDbHint")}
                </span>
              </div>
              <div className="site-settings-row__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={updatingDb}
                  onClick={() => void onUpdateDb()}
                >
                  {updatingDb ? (
                    <RefreshCw size={16} aria-hidden />
                  ) : (
                    <Download size={16} aria-hidden />
                  )}
                  {updatingDb
                    ? t("admin.generalSettings.updating")
                    : t("admin.generalSettings.updateDb")}
                </Button>
              </div>
            </div>
          </>
        ) : null}

        <div className="admin-sidebar-form__label">
          <span className="admin-sidebar-form__label-text">
            {t("admin.generalSettings.testGeoip")}
          </span>
          <div className="site-settings-row__actions">
            <Input
              value={testIp}
              onChange={(e) => setTestIp(e.target.value)}
              placeholder={t("admin.generalSettings.testIpPlaceholder")}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={testing}
              onClick={() => void onTest()}
            >
              <FlaskConical size={16} aria-hidden />
              {testing ? t("admin.generalSettings.testing") : t("admin.generalSettings.testGeoip")}
            </Button>
          </div>
          {testResult ? (
            <span className="admin-sidebar-form__hint">{testResult}</span>
          ) : null}
        </div>
      </section>
    </section>
  );
}
