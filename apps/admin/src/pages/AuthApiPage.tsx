import { Button, Input, Select, toast } from "@sakuio/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { DriverIcon } from "../components/ui/DriverIcon";
import { FieldLabel } from "../components/ui/FieldLabel";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  createAuthProvider,
  deleteAuthProvider,
  fetchAuthDrivers,
  fetchAuthProviders,
  updateAuthProvider,
  type AuthDriver,
  type AuthProvider,
} from "../api/ddns";
import { DataTable, type Column } from "../components/DataTable/DataTable";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { PageListHeader } from "../components/PageListHeader";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { useTranslation } from "react-i18next";
import "../styles/ddns.css";

type Form = { id?: number; name: string; driver: string; config: Record<string, string>; originalAuthType?: string };

const EMPTY: Form = { name: "", driver: "", config: {} };

function defaultConfig(driver?: AuthDriver): Record<string, string> {
  if (!driver) return {};
  const config: Record<string, string> = {};
  for (const field of driver.fields) {
    if (field.kind === "select" && field.options?.length) config[field.key] = field.options[0].value;
  }
  return config;
}

export default function AuthApiPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [drivers, setDrivers] = useState<AuthDriver[]>([]);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDrivers, nextProviders] = await Promise.all([fetchAuthDrivers(), fetchAuthProviders()]);
      setDrivers(nextDrivers);
      setProviders(nextProviders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.authApi.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const driver = useMemo(() => drivers.find((item) => item.id === form.driver), [drivers, form.driver]);
  const driverMap = useMemo(() => new Map(drivers.map((item) => [item.id, item])), [drivers]);
  const columns: Column<AuthProvider>[] = useMemo(() => [
    {
      key: "name",
      title: t("admin.authApi.name"),
      render: (provider) => <span className="data-table-cell">{provider.name}</span>,
    },
    {
      key: "driver",
      title: t("admin.authApi.driver"),
      render: (provider) => (
        <span className="data-table-tag data-table-tag--blue driver-tag">
          <DriverIcon driver={provider.driver} size={14} />
          {driverMap.get(provider.driver)?.name ?? provider.driver}
        </span>
      ),
    },
    {
      key: "auth_type",
      title: t("admin.authApi.authType"),
      render: (provider) => (
        <span className="data-table-cell">
          {provider.auth_type === "global" ? "Global API Key" : "API Token"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: t("admin.authApi.createdAt"),
      render: (provider) => (
        <span className="data-table-cell admin-font-number">
          {provider.created_at ? new Date(provider.created_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "last_used_at",
      title: t("admin.authApi.lastUsed"),
      render: (provider) => (
        <span className="data-table-cell admin-font-number">
          {provider.last_used_at ? new Date(provider.last_used_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("common.action"),
      render: (provider) => (
        <div className="data-table-actions data-table-actions--icons">
          <CellTooltip tip={t("common.edit")}>
            <button
              type="button"
              className="data-table-icon-btn"
              aria-label={t("common.edit")}
              onClick={() => openEdit(provider)}
            >
              <Pencil size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.delete")}>
            <button
              type="button"
              className="data-table-icon-btn data-table-icon-btn--danger"
              aria-label={t("common.delete")}
              onClick={() => remove(provider)}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </CellTooltip>
        </div>
      ),
    },
  ], [driverMap, t]);

  function openCreate() {
    const first = drivers[0];
    setForm({ name: "", driver: first?.id ?? "", config: defaultConfig(first) });
    setOpen(true);
  }

  function openEdit(provider: AuthProvider) {
    setForm({
      id: provider.id,
      name: provider.name,
      driver: provider.driver,
      config: { auth_type: provider.auth_type || "token" },
      originalAuthType: provider.auth_type || "token",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { toast.error(t("admin.authApi.nameRequired")); return; }
    if (!form.driver) { toast.error(t("admin.authApi.driverRequired")); return; }
    const missing = (driver?.fields ?? []).find((field) => field.required && !form.config[field.key]?.trim());
    if (missing) { toast.error(t("admin.authApi.fieldRequired", { field: missing.label })); return; }
    if (form.driver === "cloudflare") {
      const mode = form.config.auth_type || "token";
      const hasSecret = ["token", "email", "api_key"].some((key) => form.config[key]?.trim());
      const modeChanged = Boolean(form.originalAuthType && mode !== form.originalAuthType);
      if (!form.id || hasSecret || modeChanged) {
        if (mode === "token" && !form.config.token?.trim()) { toast.error(t("admin.authApi.tokenRequired")); return; }
        if (mode === "global" && (!form.config.email?.trim() || !form.config.api_key?.trim())) {
          toast.error(t("admin.authApi.globalRequired"));
          return;
        }
      }
    }
    setSaving(true);
    try {
      if (form.id) {
        const hasSecret = ["token", "email", "api_key"].some((key) => form.config[key]?.trim());
        const modeChanged = Boolean(form.originalAuthType && form.config.auth_type !== form.originalAuthType);
        const config = hasSecret || modeChanged ? form.config : undefined;
        await updateAuthProvider(form.id, { name: form.name.trim(), config });
      } else {
        await createAuthProvider({ name: form.name.trim(), driver: form.driver, config: form.config });
      }
      toast.success(t("admin.authApi.saved"));
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.authApi.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function remove(provider: AuthProvider) {
    confirm({
      title: t("admin.authApi.deleteTitle"),
      description: t("admin.authApi.deleteDesc", { name: provider.name }),
      confirmLabel: t("common.delete"),
      danger: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteAuthProvider(provider.id);
            toast.success(t("admin.authApi.deleted"));
            await load();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("admin.authApi.deleteFailed"));
          }
        })();
      },
    });
  }

  return (
    <section className="page-container page-container--entity-list">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.nav.authApi"
        actions={<Button type="button" size="sm" onClick={openCreate} disabled={drivers.length === 0}><Plus size={15} />{t("admin.authApi.add")}</Button>}
      />
      <DataTable
        tableClassName="data-table--entity-list"
        listLayoutId="auth_providers"
        columns={columns}
        data={providers}
        rowKey={(provider) => String(provider.id)}
        loading={loading}
        emptyText={t("admin.authApi.empty")}
      />

      <GenericSidebar
        open={open}
        title={form.id ? t("admin.authApi.editTitle") : t("admin.authApi.addTitle")}
        onClose={() => setOpen(false)}
        initialWidth={520}
      >
        <div className="ddns-form">
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.authApi.nameHelp")}>{t("admin.authApi.nameLabel")}</FieldLabel>
            <Input value={form.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: event.target.value })} placeholder={t("admin.authApi.namePlaceholder")} />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={driver?.description ?? t("admin.authApi.driverHelp")}> {t("admin.authApi.driver")}</FieldLabel>
            <Select
              value={form.driver}
              disabled={Boolean(form.id)}
              options={drivers.map((item) => ({
                value: item.id,
                label: (
                  <span className="driver-option">
                    <DriverIcon driver={item.id} size={15} />
                    {item.name}
                  </span>
                ),
              }))}
              onChange={(value) => {
                const next = drivers.find((item) => item.id === value);
                setForm({ ...form, driver: String(value), config: defaultConfig(next) });
              }}
            />
          </label>
          {driver?.fields.filter((field) => {
            const mode = form.config.auth_type || "token";
            if (form.driver !== "cloudflare") return true;
            if (field.key === "token") return mode === "token";
            if (field.key === "email" || field.key === "api_key") return mode === "global";
            return true;
          }).map((field) => (
            <label className="admin-sidebar-form__label" key={field.key}>
              <FieldLabel tip={field.placeholder || undefined}>
                {field.label}{field.required ? " *" : ""}
              </FieldLabel>
              {field.kind === "select" && field.options ? (
                <Select
                  value={form.config[field.key] ?? field.options[0]?.value ?? ""}
                  options={field.options.map((option) => ({ value: option.value, label: option.label }))}
                  onChange={(value) => setForm({ ...form, config: { ...form.config, [field.key]: String(value) } })}
                />
              ) : (
                <Input
                  type={field.kind === "password" ? "password" : field.kind === "email" ? "email" : "text"}
                  value={form.config[field.key] ?? ""}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, config: { ...form.config, [field.key]: event.target.value } })}
                  placeholder={form.id ? t("admin.authApi.keepOriginal") : field.placeholder}
                  autoComplete="new-password"
                />
              )}
            </label>
          ))}
          <div className="ddns-form__actions">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>{saving ? t("common.saving") : t("common.save")}</Button>
          </div>
        </div>
      </GenericSidebar>
    </section>
  );
}
