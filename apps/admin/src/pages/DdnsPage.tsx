import { Button, Input, Select, toast } from "@sakuio/ui";
import { Globe2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { DataTable, type Column } from "../components/DataTable/DataTable";
import {
  createDdnsRecord,
  deleteDdnsRecord,
  fetchAuthProviders,
  fetchDdnsRecords,
  syncDdnsRecord,
  updateDdnsRecord,
  type AuthProvider,
  type DdnsInput,
  type DdnsRecord,
} from "../api/ddns";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { PageListHeader } from "../components/PageListHeader";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { SearchableServerSelect } from "../components/ui/SearchableServerSelect";
import { FieldLabel } from "../components/ui/FieldLabel";
import { Switch } from "../components/ui/Switch";
import "../styles/ddns.css";

type DdnsGroup = { key: string; records: DdnsRecord[] };

function groupKey(record: DdnsRecord): string {
  return [record.provider_id, record.client_uuid, record.zone_name, record.record_name, record.name].join("|");
}

function groupRecords(records: DdnsRecord[]): DdnsGroup[] {
  const groups = new Map<string, DdnsGroup>();
  for (const record of records) {
    const key = groupKey(record);
    const group = groups.get(key) ?? { key, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function groupFqdn(group: DdnsGroup): string {
  const record = group.records[0];
  return record.record_name && record.record_name !== "@" ? `${record.record_name}.${record.zone_name}` : record.zone_name;
}

function groupTypes(group: DdnsGroup): Set<string> {
  return new Set(group.records.map((record) => record.record_type));
}

const EMPTY: DdnsInput & { ids?: number[] } = {
  name: "",
  provider_id: 0,
  client_uuid: "",
  fqdn: "",
  record_type: "A",
  proxied: false,
  ttl: 1,
};

export default function DdnsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [records, setRecords] = useState<DdnsRecord[]>([]);
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [form, setForm] = useState<DdnsInput & { ids?: number[]; clientLabel?: string }>(EMPTY);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextRecords, nextProviders] = await Promise.all([
        fetchDdnsRecords(),
        fetchAuthProviders(),
      ]);
      setRecords(nextRecords);
      setProviders(nextProviders);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.ddns.loadFailed"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!records.some((record) => !record.last_synced_at && !record.last_error)) return;
    const timer = window.setInterval(() => void load(true), 2500);
    return () => window.clearInterval(timer);
  }, [load, records]);

  function openCreate() {
    setForm({
      ...EMPTY,
      provider_id: providers[0]?.id ?? 0,
      client_uuid: "",
      clientLabel: "",
    });
    setOpen(true);
  }

  function openEdit(group: DdnsGroup) {
    const record = group.records[0];
    const types = groupTypes(group);
    setForm({
      ids: group.records.map((item) => item.id),
      name: record.name,
      provider_id: record.provider_id,
      client_uuid: record.client_uuid,
      clientLabel: record.client_name,
      fqdn: groupFqdn(group),
      record_type: types.has("A") && types.has("AAAA") ? "BOTH" : record.record_type,
      proxied: record.proxied,
      ttl: record.ttl,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.provider_id) { toast.error(t("admin.ddns.selectProvider")); return; }
    if (!form.client_uuid) { toast.error(t("admin.ddns.selectServer")); return; }
    if (!form.fqdn.trim()) { toast.error(t("admin.ddns.enterDomain")); return; }
    setSaving(true);
    try {
      const base = {
        name: form.name.trim() || form.fqdn.trim(),
        provider_id: form.provider_id,
        client_uuid: form.client_uuid,
        fqdn: form.fqdn.trim(),
        proxied: form.proxied,
        ttl: form.ttl,
      };
      if (!form.ids?.length) {
        await createDdnsRecord({ ...base, record_type: form.record_type });
      } else {
        const desired: Array<"A" | "AAAA"> = form.record_type === "BOTH" ? ["A", "AAAA"] : [form.record_type];
        const existing = new Map<"A" | "AAAA", DdnsRecord>(
          records
            .filter((record) => form.ids?.includes(record.id))
            .map((record) => [record.record_type, record]),
        );
        for (const type of desired) {
          const current = existing.get(type);
          if (current) {
            await updateDdnsRecord(current.id, { ...base, record_type: type });
          } else {
            await createDdnsRecord({ ...base, record_type: type });
          }
        }
        for (const current of existing.values()) {
          if (!desired.includes(current.record_type)) await deleteDdnsRecord(current.id);
        }
      }
      toast.success(t("admin.ddns.saved"));
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.ddns.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  function remove(group: DdnsGroup) {
    const record = group.records[0];
    confirm({
      title: t("admin.ddns.deleteTitle"),
      description: `t("admin.ddns.deleteDesc", { name: record.name || groupFqdn(group) })`,
      confirmLabel: t("common.delete"),
      danger: true,
      onConfirm: () => {
        void (async () => {
          try {
            await Promise.all(group.records.map((item) => deleteDdnsRecord(item.id)));
            toast.success(t("admin.ddns.deleted"));
            await load();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : t("admin.ddns.deleteFailed"));
          }
        })();
      },
    });
  }

  const groups = useMemo(() => groupRecords(records), [records]);
  const columns: Column<DdnsGroup>[] = useMemo(() => [
    {
      key: "domain",
      title: t("admin.ddns.domain"),
      render: (group) => <span className="data-table-cell">{groupFqdn(group)}</span>,
    },
    {
      key: "name",
      title: t("admin.ddns.remark"),
      render: (group) => <span className="data-table-cell">{group.records[0].name || "—"}</span>,
    },
    {
      key: "provider",
      title: t("admin.ddns.provider"),
      render: (group) => <span className="data-table-cell">{group.records[0].provider_name}</span>,
    },
    {
      key: "server",
      title: t("admin.ddns.server"),
      render: (group) => <span className="data-table-cell">{group.records[0].client_name}</span>,
    },
    {
      key: "type",
      title: t("admin.ddns.type"),
      render: (group) => {
        const types = groupTypes(group);
        const both = types.has("A") && types.has("AAAA");
        const type = both ? "A + AAAA" : group.records[0].record_type;
        return (
          <span className="ddns-row__title">
            <span className={`ddns-type ${both ? "ddns-type--both" : type === "AAAA" ? "ddns-type--aaaa" : "ddns-type--a"}`}>{type}</span>
            {group.records[0].proxied ? <span className="ddns-proxy">Proxied</span> : null}
          </span>
        );
      },
    },
    {
      key: "ip",
      title: t("admin.ddns.currentIp"),
      render: (group) => {
        const v4 = group.records.find((record) => record.record_type === "A")?.last_ip;
        const v6 = group.records.find((record) => record.record_type === "AAAA")?.last_ip;
        const value = [v4, v6].filter(Boolean).join(" / ");
        return <span className="data-table-cell admin-font-number">{value || "—"}</span>;
      },
    },
    {
      key: "last_sync",
      title: t("admin.ddns.lastSync"),
      render: (group) => {
        const times = group.records.map((record) => record.last_synced_at).filter((value): value is string => Boolean(value));
        const error = group.records.find((record) => record.last_error)?.last_error;
        const latest = times.sort().at(-1);
        return (
          <span className="data-table-cell admin-font-number" title={error || undefined}>
            {latest ? new Date(latest).toLocaleString() : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      title: t("common.action"),
      render: (group) => (
        <div className="data-table-actions data-table-actions--icons">
          <CellTooltip tip={t("admin.ddns.syncNow")}>
            <button type="button" className="data-table-icon-btn" aria-label={t("admin.ddns.syncNow")} disabled={syncing === group.key} onClick={() => void sync(group)}>
              <RefreshCw size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.edit")}>
            <button type="button" className="data-table-icon-btn" aria-label={t("common.edit")} onClick={() => openEdit(group)}>
              <Pencil size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.delete")}>
            <button type="button" className="data-table-icon-btn data-table-icon-btn--danger" aria-label={t("common.delete")} onClick={() => remove(group)}>
              <Trash2 size={18} aria-hidden />
            </button>
          </CellTooltip>
        </div>
      ),
    },
  ], [syncing, t]);

  async function sync(group: DdnsGroup) {
    setSyncing(group.key);
    try {
      for (const record of group.records) await syncDdnsRecord(record.id);
      toast.success(t("admin.ddns.synced"));
      await load(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("admin.ddns.syncFailed"));
    } finally {
      setSyncing(null);
    }
  }

  return (
    <section className="page-container page-container--entity-list">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.nav.ddns"
        actions={<Button type="button" size="sm" onClick={openCreate} disabled={providers.length === 0}><Plus size={15} />{t("admin.ddns.addRecord")}</Button>}
      />
      {!loading && providers.length === 0 ? (
        <section className="page-card ddns-empty">
          <Globe2 size={28} />
          <strong>{t("admin.ddns.noProvider")}</strong>
          <span>{t("admin.ddns.noProviderHint")}</span>
        </section>
      ) : (
        <DataTable
          tableClassName="data-table--entity-list"
          listLayoutId="ddns_records"
          columns={columns}
          data={groups}
          rowKey={(group) => group.key}
          loading={loading}
          emptyText={t("admin.ddns.empty")}
        />
      )}

      <GenericSidebar
        open={open}
        title={form.ids?.length ? t("admin.ddns.editTitle") : t("admin.ddns.addTitle")}
        onClose={() => setOpen(false)}
        initialWidth={560}
      >
        <div className="ddns-form">
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.nameHelp")}>{t("admin.ddns.nameLabel")}</FieldLabel>
            <Input value={form.name} onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: event.target.value })} placeholder={t("admin.ddns.namePlaceholder")} />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.providerHelp")}>{t("admin.ddns.provider")}</FieldLabel>
            <Select
              value={form.provider_id || ""}
              options={providers.map((provider) => ({ value: provider.id, label: `${provider.name}（${provider.driver_name}）` }))}
              onChange={(value) => setForm({ ...form, provider_id: Number(value) })}
            />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.serverHelp")}>{t("admin.ddns.server")}</FieldLabel>
            <SearchableServerSelect
              value={form.client_uuid}
              selectedLabel={form.clientLabel}
              onChange={(uuid, client) => setForm({ ...form, client_uuid: uuid, clientLabel: client.name })}
            />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.domainHelp")}>{t("admin.ddns.domain")}</FieldLabel>
            <Input
              value={form.fqdn}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, fqdn: event.target.value })}
              placeholder={t("admin.ddns.domainPlaceholder")}
            />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.typeHelp")}>{t("admin.ddns.type")}</FieldLabel>
            <Select
              value={form.record_type}
              options={[
                { value: "A", label: "A（IPv4）" },
                { value: "AAAA", label: "AAAA（IPv6）" },
                { value: "BOTH", label: t("admin.ddns.both") },
              ]}
              onChange={(value) => setForm({ ...form, record_type: value === "AAAA" ? "AAAA" : value === "BOTH" ? "BOTH" : "A" })}
            />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.ddns.ttlHelp")}>TTL</FieldLabel>
            <Input type="number" min={1} max={86400} value={form.ttl} onChange={(event: ChangeEvent<HTMLInputElement>) => setForm({ ...form, ttl: Number(event.target.value) || 1 })} />
          </label>
          <div className="ddns-form__switch">
            <span><strong>{t("admin.ddns.cfProxy")}</strong><small>{t("admin.ddns.cfProxyHint")}</small></span>
            <Switch checked={form.proxied} label={t("admin.ddns.cfProxy")} onChange={(checked: boolean) => setForm({ ...form, proxied: checked })} />
          </div>
          <div className="ddns-form__actions">
            <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>{saving ? t("common.saving") : t("admin.ddns.save")}</Button>
          </div>
        </div>
      </GenericSidebar>
    </section>
  );
}
