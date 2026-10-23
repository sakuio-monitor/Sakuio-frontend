import { Button, Input, Select, toast } from "@sakuio/ui";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createNotificationInstance,
  deleteNotificationInstance,
  fetchNotificationInstance,
  fetchNotificationInstances,
  fetchNotificationTypes,
  setNotificationInstanceEnabled,
  testNotificationInstance,
  updateNotificationInstance,
  type ChannelType,
  type ConfigField,
  type NotificationInstanceSummary,
} from "../api/notification";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { DataTable, type Column } from "../components/DataTable/DataTable";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { PageListHeader } from "../components/PageListHeader";
import { Switch } from "../components/ui/Switch";
import { FieldLabel } from "../components/ui/FieldLabel";

function fieldValue(data: Record<string, unknown>, field: ConfigField): string {
  const raw = data[field.key];
  if (raw === undefined || raw === null) {
    if (field.default !== undefined && field.default !== null) {
      return String(field.default);
    }
    return "";
  }
  if (typeof raw === "boolean") {
    return raw ? "true" : "false";
  }
  return String(raw);
}

function normalizeData(
  values: Record<string, unknown>,
  fields: ConfigField[],
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...values };
  for (const f of fields) {
    if (f.type === "switch") {
      data[f.key] = fieldValue(data, f) === "true";
    } else if (f.type === "number") {
      const n = Number(fieldValue(data, f));
      data[f.key] = Number.isFinite(n) ? n : 0;
    }
  }
  return data;
}

function InstanceFormFields({
  fields,
  values,
  onChange,
}: {
  fields: ConfigField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="admin-sidebar-form">
      {fields.map((field) =>
        field.type === "switch" ? (
          <div key={field.key} className="admin-sidebar-form__row">
            <span className="admin-sidebar-form__label-text">{field.label}</span>
            <Switch
              checked={fieldValue(values, field) === "true"}
              label={field.label}
              onChange={(checked) => onChange({ ...values, [field.key]: checked })}
            />
          </div>
        ) : (
          <label key={field.key} className="admin-sidebar-form__label">
            <FieldLabel tip={field.help || undefined}>
              {field.label}{field.required ? " *" : ""}
            </FieldLabel>
            <Input
              type={
                field.type === "password"
                  ? "password"
                  : field.type === "number"
                    ? "number"
                    : "text"
              }
              value={fieldValue(values, field)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ ...values, [field.key]: e.target.value })}
            />
          </label>
        ),
      )}
    </div>
  );
}

export default function NotificationChannelsPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [types, setTypes] = useState<ChannelType[]>([]);
  const [instances, setInstances] = useState<NotificationInstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("");
  const [addName, setAddName] = useState("");
  const [addValues, setAddValues] = useState<Record<string, unknown>>({});
  const [addSaving, setAddSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editFields, setEditFields] = useState<ConfigField[]>([]);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [editTypeName, setEditTypeName] = useState("");
  const [editChannelType, setEditChannelType] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [testToEmail, setTestToEmail] = useState("");
  const [testing, setTesting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [typeList, list] = await Promise.all([
        fetchNotificationTypes(),
        fetchNotificationInstances(),
      ]);
      setTypes(typeList);
      setInstances(list);
    } catch {
      toast.error(t("admin.notification.channelsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!addType && types[0]) {
      setAddType(types[0].id);
    }
  }, [types, addType]);

  const addTypeMeta = types.find((x) => x.id === addType);

  const openEdit = async (id: string) => {
    try {
      const detail = await fetchNotificationInstance(id);
      setEditId(id);
      setEditName(detail.name);
      setEditFields(detail.fields);
      setEditValues(detail.data ?? {});
      setEditTypeName(detail.type_name);
      setEditChannelType(detail.channel_type);
      setTestToEmail("");
      setEditOpen(true);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const submitAdd = async () => {
    if (!addType) {
      return;
    }
    setAddSaving(true);
    try {
      const fields = addTypeMeta?.fields ?? [];
      await createNotificationInstance({
        channel_type: addType,
        name: addName.trim() || undefined,
        data: normalizeData(addValues, fields),
      });
      toast.success(t("common.success"));
      setAddOpen(false);
      setAddName("");
      setAddValues({});
      await reload();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setAddSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editId || !editName.trim()) {
      return;
    }
    setEditSaving(true);
    try {
      await updateNotificationInstance(editId, {
        name: editName.trim(),
        data: normalizeData(editValues, editFields),
      });
      toast.success(t("common.success"));
      setEditOpen(false);
      await reload();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setEditSaving(false);
    }
  };

  const onDelete = (id: string, name: string) => {
    confirm({
      title: t("admin.notification.confirmDelete", { name }),
      danger: true,
      onConfirm: async () => {
        try {
          await deleteNotificationInstance(id);
          toast.success(t("common.deleted_successfully"));
          await reload();
        } catch {
          toast.error(t("common.error"));
        }
      },
    });
  };

  const toggleEnabled = async (item: NotificationInstanceSummary) => {
    try {
      await setNotificationInstanceEnabled(item.id, !item.enabled);
      await reload();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const onTest = async () => {
    if (!editId) {
      return;
    }
    setTesting(true);
    try {
      await testNotificationInstance(editId, {
        to_email: testToEmail.trim() || undefined,
      });
      toast.success(t("admin.notification.testOk"));
    } catch {
      toast.error(t("admin.notification.testFailed"));
    } finally {
      setTesting(false);
    }
  };

  const columns: Column<NotificationInstanceSummary>[] = useMemo(() => [
    {
      key: "name",
      title: t("common.name"),
      render: (item) => <span className={`data-table-cell${item.enabled ? "" : " is-disabled"}`}>{item.name}</span>,
    },
    {
      key: "type_name",
      title: t("common.type"),
      render: (item) => <span className="data-table-tag data-table-tag--blue">{item.type_name}</span>,
    },
    {
      key: "last_used_at",
      title: t("admin.notification.lastUsed"),
      render: (item) => (
        <span className="data-table-cell admin-font-number">
          {item.last_used_at ? new Date(item.last_used_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "updated_at",
      title: t("admin.notification.lastUpdated"),
      render: (item) => (
        <span className="data-table-cell admin-font-number">
          {item.updated_at ? new Date(item.updated_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("common.action"),
      render: (item) => (
        <div className="data-table-actions data-table-actions--icons">
          <CellTooltip tip={item.enabled ? t("common.disable") : t("common.enable")}>
            <button type="button" className="data-table-icon-btn" aria-label={item.enabled ? t("common.disable") : t("common.enable")} onClick={() => void toggleEnabled(item)}>
              {item.enabled ? <Power size={18} aria-hidden /> : <PowerOff size={18} aria-hidden />}
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.edit")}>
            <button type="button" className="data-table-icon-btn" aria-label={t("common.edit")} onClick={() => void openEdit(item.id)}>
              <Pencil size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.delete")}>
            <button type="button" className="data-table-icon-btn data-table-icon-btn--danger" aria-label={t("common.delete")} onClick={() => void onDelete(item.id, item.name)}>
              <Trash2 size={18} aria-hidden />
            </button>
          </CellTooltip>
        </div>
      ),
    },
  ], [t]);

  return (
    <section className="page-container page-container--entity-list">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.nav.notificationChannels"
        actions={
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} disabled={!types.length}>
            <Plus size={16} aria-hidden />
            {t("common.add")}
          </Button>
        }
      />

      <DataTable
        tableClassName="data-table--entity-list"
        listLayoutId="notification_channels"
        columns={columns}
        data={instances}
        rowKey={(item) => item.id}
        loading={loading}
        emptyText={t("admin.notification.channelsEmpty")}
      />

      <GenericSidebar
        open={addOpen}
        title={t("common.add")}
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={addSaving || !addType} onClick={() => void submitAdd()}>
              {addSaving ? t("common.saving") : t("common.add")}
            </Button>
          </>
        }
      >
        <div className="admin-sidebar-form">
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.channelTypeHint")}>{t("common.type")}</FieldLabel>
            <Select
              value={addType}
              onChange={(v) => {
                setAddType(String(v));
                setAddValues({});
              }}
              options={types.map((ty) => ({ value: ty.id, label: ty.name }))}
            />
          </label>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.channelNameHint")}>{t("common.name")}</FieldLabel>
            <Input
              value={addName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setAddName(e.target.value)}
              placeholder={addTypeMeta?.name ?? ""}
            />
          </label>
          {addTypeMeta ? (
            <InstanceFormFields
              fields={addTypeMeta.fields}
              values={addValues}
              onChange={setAddValues}
            />
          ) : null}
        </div>
      </GenericSidebar>

      <GenericSidebar
        open={editOpen}
        title={t("common.edit")}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={editSaving} onClick={() => void submitEdit()}>
              {editSaving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="admin-sidebar-form">
          <span className="admin-sidebar-form__hint">{editTypeName}</span>
          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.channelNameHint")}>{t("common.name")}</FieldLabel>
            <Input value={editName} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)} />
          </label>
          <InstanceFormFields fields={editFields} values={editValues} onChange={setEditValues} />
          {editChannelType === "smtp" ? (
            <label className="admin-sidebar-form__label">
              {t("admin.notification.testToEmail")}
              <Input
                value={testToEmail}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setTestToEmail(e.target.value)}
                placeholder={t("admin.notification.testToEmailPlaceholder")}
              />
            </label>
          ) : null}
          <div className="notify-actions">
            <Button type="button" variant="ghost" disabled={testing} onClick={() => void onTest()}>
              {testing ? t("admin.notification.testing") : t("admin.notification.testSend")}
            </Button>
          </div>
        </div>
      </GenericSidebar>
    </section>
  );
}
