import { Button, Input, Select, Textarea, toast } from "@sakuio/ui";
import { Download, RotateCcw, Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBlock } from "../components/LoadingBlock";
import {
  downloadBackup,
  fetchSiteSettings,
  regenerateShareToken,
  restoreBackup,
  updateSiteSettings,
  type SiteSettings,
} from "../api/siteSettings";
import { PageListHeader } from "../components/PageListHeader";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { Switch } from "../components/ui/Switch";
import "../styles/site-settings.css";

function parseOrigins(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function SettingsSitePage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [corsOrigins, setCorsOrigins] = useState("");
  const [wsOrigins, setWsOrigins] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const faviconRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSiteSettings();
      setSettings(data);
      setCorsOrigins(data.cors_allowed_origins.join("\n"));
      setWsOrigins(data.ws_allowed_origins.join("\n"));
    } catch {
      toast.error(t("admin.siteSettings.loadFailed"));
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
        <PageListHeader titleKey="admin.nav.settingsSite" />
        <LoadingBlock label={t("common.loading")} />
      </section>
    );
  }

  const patch = (next: Partial<SiteSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const submit = async () => {
    setSaving(true);
    try {
      const saved = await updateSiteSettings({
        site_name: settings.site_name,
        site_description: settings.site_description,
        cors_origin_check_enabled: settings.cors_origin_check_enabled,
        cors_allowed_origins: parseOrigins(corsOrigins),
        ws_origin_check_enabled: settings.ws_origin_check_enabled,
        ws_allowed_origins: parseOrigins(wsOrigins),
        ssrf_protection: settings.ssrf_protection,
        show_partial_ip: settings.show_partial_ip,
        agent_connect_address: settings.agent_connect_address,
        private_site: settings.private_site,
        custom_head: settings.custom_head,
        custom_body: settings.custom_body,
        favicon: settings.favicon,
        audit_retention_days: settings.audit_retention_days,
      });
      setSettings(saved);
      window.dispatchEvent(new Event("sakuio:favicon-changed"));
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const onRegenerateToken = async () => {
    try {
      const token = await regenerateShareToken();
      patch({ share_token: token });
      toast.success(t("common.success"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const onPickFavicon = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ favicon: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  };

  const onPickRestore = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    confirm({
      title: t("admin.siteSettings.restoreConfirm"),
      danger: true,
      onConfirm: async () => {
        try {
          await restoreBackup(file);
          toast.success(t("admin.siteSettings.restoreStaged"));
          // 服务正在重启，轮询恢复后刷新页面。
          const deadline = Date.now() + 60_000;
          while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            try {
              const res = await fetch("/api/version");
              if (res.ok) {
                window.location.reload();
                return;
              }
            } catch {
              // 服务尚未恢复，继续等待
            }
          }
          toast.error(t("admin.siteSettings.restoreRestartTimeout"));
        } catch {
          toast.error(t("admin.siteSettings.restoreFailed"));
        }
      },
    });
  };

  const onDownloadBackup = async () => {
    try {
      await downloadBackup();
      toast.success(t("common.success"));
    } catch {
      toast.error(t("admin.siteSettings.backupFailed"));
    }
  };

  const shareLink = settings.share_token
    ? `${window.location.origin}/api/share/${settings.share_token}`
    : "";

  return (
    <section className="page-container">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.nav.settingsSite"
        actions={
          <Button type="button" size="sm" disabled={saving} onClick={() => void submit()}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        }
      />

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionBasic")}</h3>
        <label className="admin-sidebar-form__label">
          {t("admin.siteSettings.siteName")}
          <Input
            value={settings.site_name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => patch({ site_name: e.target.value })}
            placeholder={t("admin.siteSettings.siteNamePlaceholder")}
          />
        </label>
        <label className="admin-sidebar-form__label">
          {t("admin.siteSettings.siteDescription")}
          <Input
            value={settings.site_description}
            onChange={(e: ChangeEvent<HTMLInputElement>) => patch({ site_description: e.target.value })}
            placeholder={t("admin.siteSettings.siteDescriptionPlaceholder")}
          />
          <span className="admin-sidebar-form__hint">
            {t("admin.siteSettings.siteDescriptionHint")}
          </span>
        </label>
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionSecurity")}</h3>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.corsCheck")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.corsCheckHint")}
            </span>
          </div>
          <Switch
            checked={settings.cors_origin_check_enabled}
            label={t("admin.siteSettings.corsCheck")}
            onChange={(checked) => patch({ cors_origin_check_enabled: checked })}
          />
        </div>
        {settings.cors_origin_check_enabled ? (
          <label className="admin-sidebar-form__label">
            {t("admin.siteSettings.corsList")}
            <Textarea
              value={corsOrigins}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCorsOrigins(e.target.value)}
              placeholder={t("admin.siteSettings.originsPlaceholder")}
              rows={3}
            />
          </label>
        ) : null}

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.wsOriginCheck")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.wsOriginCheckHint")}
            </span>
          </div>
          <Switch
            checked={settings.ws_origin_check_enabled}
            label={t("admin.siteSettings.wsOriginCheck")}
            onChange={(checked) => patch({ ws_origin_check_enabled: checked })}
          />
        </div>
        {settings.ws_origin_check_enabled ? (
          <label className="admin-sidebar-form__label">
            {t("admin.siteSettings.wsOriginList")}
            <Textarea
              value={wsOrigins}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setWsOrigins(e.target.value)}
              placeholder={t("admin.siteSettings.originsPlaceholder")}
              rows={3}
            />
          </label>
        ) : null}

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.ssrf")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.ssrfHint")}
            </span>
          </div>
          <Switch
            checked={settings.ssrf_protection}
            label={t("admin.siteSettings.ssrf")}
            onChange={(checked) => patch({ ssrf_protection: checked })}
          />
        </div>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.partialIp")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.partialIpHint")}
            </span>
          </div>
          <Switch
            checked={settings.show_partial_ip}
            label={t("admin.siteSettings.partialIp")}
            onChange={(checked) => patch({ show_partial_ip: checked })}
          />
        </div>

        <label className="admin-sidebar-form__label">
          {t("admin.siteSettings.agentAddress")}
          <Input
            value={settings.agent_connect_address}
            onChange={(e: ChangeEvent<HTMLInputElement>) => patch({ agent_connect_address: e.target.value })}
            placeholder={t("admin.siteSettings.agentAddressPlaceholder")}
          />
          <span className="admin-sidebar-form__hint">
            {t("admin.siteSettings.agentAddressHint")}
          </span>
        </label>
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionAccess")}</h3>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.privateSite")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.privateSiteHint")}
            </span>
          </div>
          <Switch
            checked={settings.private_site}
            label={t("admin.siteSettings.privateSite")}
            onChange={(checked) => patch({ private_site: checked })}
          />
        </div>

        {settings.private_site ? (
          <div className="site-settings-row">
            <div className="site-settings-row__text">
              <span>{t("admin.siteSettings.tempShare")}</span>
              {shareLink ? (
                <span className="admin-sidebar-form__hint site-settings-share-link">
                  {shareLink}
                </span>
              ) : null}
            </div>
            <div className="site-settings-row__actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void onRegenerateToken()}
              >
                <RotateCcw size={16} aria-hidden />
                {t("admin.siteSettings.regenerateToken")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionAudit")}</h3>
        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.auditRetention")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.auditRetentionHint")}
            </span>
          </div>
          <div className="site-settings-row__actions">
            <Select
              value={String(settings.audit_retention_days)}
              options={[
                { value: "7", label: t("admin.siteSettings.retention7") },
                { value: "14", label: t("admin.siteSettings.retention14") },
                { value: "30", label: t("admin.siteSettings.retention30") },
                { value: "180", label: t("admin.siteSettings.retention180") },
                { value: "365", label: t("admin.siteSettings.retention365") },
                { value: "0", label: t("admin.siteSettings.retentionForever") },
              ]}
              onChange={(value) => patch({ audit_retention_days: Number(value) })}
            />
          </div>
        </div>
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionCustom")}</h3>
        <p className="admin-sidebar-form__hint">
          {t("admin.siteSettings.customWarning")}
        </p>

        <label className="admin-sidebar-form__label">
          {t("admin.siteSettings.customHead")}
          <Textarea
            value={settings.custom_head}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => patch({ custom_head: e.target.value })}
            placeholder={t("admin.siteSettings.customHeadPlaceholder")}
            rows={4}
          />
        </label>

        <label className="admin-sidebar-form__label">
          {t("admin.siteSettings.customBody")}
          <Textarea
            value={settings.custom_body}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => patch({ custom_body: e.target.value })}
            placeholder={t("admin.siteSettings.customBodyPlaceholder")}
            rows={4}
          />
        </label>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.favicon")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.faviconHint")}
            </span>
          </div>
          <div className="site-settings-row__actions">
            <img
              src={settings.favicon || "/admin/favicon.ico"}
              alt={t("admin.siteSettings.favicon")}
              className="site-settings-favicon-preview"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => faviconRef.current?.click()}
            >
              <Upload size={16} aria-hidden />
              {t("common.upload")}
            </Button>
            {settings.favicon ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => patch({ favicon: "" })}
              >
                {t("common.delete")}
              </Button>
            ) : null}
            <input
              ref={faviconRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFavicon}
            />
          </div>
        </div>
      </section>

      <section className="page-card site-settings-card">
        <h3 className="site-settings-card__title">{t("admin.siteSettings.sectionBackup")}</h3>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.downloadBackup")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.downloadBackupHint")}
            </span>
          </div>
          <div className="site-settings-row__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onDownloadBackup()}
            >
              <Download size={16} aria-hidden />
              {t("admin.siteSettings.downloadBackup")}
            </Button>
          </div>
        </div>

        <div className="site-settings-row">
          <div className="site-settings-row__text">
            <span>{t("admin.siteSettings.restoreBackup")}</span>
            <span className="admin-sidebar-form__hint">
              {t("admin.siteSettings.restoreBackupHint")}
            </span>
          </div>
          <div className="site-settings-row__actions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => restoreRef.current?.click()}
            >
              <Upload size={16} aria-hidden />
              {t("admin.siteSettings.restoreBackup")}
            </Button>
            <input
              ref={restoreRef}
              type="file"
              accept=".db,application/octet-stream"
              hidden
              onChange={(e) => void onPickRestore(e)}
            />
          </div>
        </div>
      </section>
    </section>
  );
}
