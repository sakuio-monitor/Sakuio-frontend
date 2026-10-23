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
      toast.error(error instanceof Error ? error.message : "加载授权失败");
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
      title: "名称",
      render: (provider) => <span className="data-table-cell">{provider.name}</span>,
    },
    {
      key: "driver",
      title: "驱动",
      render: (provider) => (
        <span className="data-table-tag data-table-tag--blue driver-tag">
          <DriverIcon driver={provider.driver} size={14} />
          {driverMap.get(provider.driver)?.name ?? provider.driver}
        </span>
      ),
    },
    {
      key: "auth_type",
      title: "授权方式",
      render: (provider) => (
        <span className="data-table-cell">
          {provider.auth_type === "global" ? "Global API Key" : "API Token"}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "创建时间",
      render: (provider) => (
        <span className="data-table-cell admin-font-number">
          {provider.created_at ? new Date(provider.created_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "last_used_at",
      title: "最后使用",
      render: (provider) => (
        <span className="data-table-cell admin-font-number">
          {provider.last_used_at ? new Date(provider.last_used_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      render: (provider) => (
        <div className="data-table-actions data-table-actions--icons">
          <CellTooltip tip="编辑">
            <button
              type="button"
              className="data-table-icon-btn"
              aria-label="编辑"
              onClick={() => openEdit(provider)}
            >
              <Pencil size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip="删除">
            <button
              type="button"
              className="data-table-icon-btn data-table-icon-btn--danger"
              aria-label="删除"
              onClick={() => remove(provider)}
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </CellTooltip>
        </div>
      ),
    },
  ], [driverMap]);

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
    if (!form.name.trim()) { toast.error("请输入授权名称"); return; }
    if (!form.driver) { toast.error("请选择驱动"); return; }
    const missing = (driver?.fields ?? []).find((field) => field.required && !form.config[field.key]?.trim());
    if (missing) { toast.error(`${missing.label} 不能为空`); return; }
    if (form.driver === "cloudflare") {
      const mode = form.config.auth_type || "token";
      const hasSecret = ["token", "email", "api_key"].some((key) => form.config[key]?.trim());
      const modeChanged = Boolean(form.originalAuthType && mode !== form.originalAuthType);
      if (!form.id || hasSecret || modeChanged) {
        if (mode === "token" && !form.config.token?.trim()) { toast.error("API Token 不能为空"); return; }
        if (mode === "global" && (!form.config.email?.trim() || !form.config.api_key?.trim())) {
          toast.error("Global API Key 方式需要填写账户邮箱和 API Key");
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
      toast.success("授权已保存");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存授权失败");
    } finally {
      setSaving(false);
    }
  }

  function remove(provider: AuthProvider) {
    confirm({
      title: "删除授权",
      description: `确定删除「${provider.name}」？`,
      confirmLabel: "删除",
      danger: true,
      onConfirm: () => {
        void (async () => {
          try {
            await deleteAuthProvider(provider.id);
            toast.success("授权已删除");
            await load();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "删除授权失败");
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
        actions={<Button type="button" size="sm" onClick={openCreate} disabled={drivers.length === 0}><Plus size={15} />添加授权</Button>}
      />
      <DataTable
        tableClassName="data-table--entity-list"
        listLayoutId="auth_providers"
        columns={columns}
        data={providers}
        rowKey={(provider) => String(provider.id)}
        loading={loading}
        emptyText="还没有授权 API，点击右上角添加"
      />

      <GenericSidebar
        open={open}
        title={form.id ? "编辑授权 API" : "添加授权 API"}
        onClose={() => setOpen(false)}
        initialWidth={520}
      >
        <div className="ddns-form">
          <label className="admin-sidebar-form__label">
            <FieldLabel tip="仅用于识别该授权，不参与 DNS 解析。">授权名称</FieldLabel>
            <Input value={form.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: event.target.value })} placeholder="例如 Cloudflare 主账号" />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={driver?.description ?? "选择要接入的外部系统驱动。"}>驱动</FieldLabel>
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
                  placeholder={form.id ? "留空则保持原值" : field.placeholder}
                  autoComplete="new-password"
                />
              )}
            </label>
          ))}
          <div className="ddns-form__actions">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>{saving ? "保存中..." : "保存"}</Button>
          </div>
        </div>
      </GenericSidebar>
    </section>
  );
}
