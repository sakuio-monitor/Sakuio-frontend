import { Button, Input, Select, toast } from "@sakuio/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createNotificationInstance,
  deleteNotificationInstance,
  fetchNotificationInstance,
  fetchNotificationInstances,
  fetchNotificationTypes,
  testNotificationInstance,
  updateNotificationInstance,
  type ChannelType,
  type ConfigField,
  type NotificationInstanceSummary,
} from "../api/notification";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { PageListHeader } from "../components/PageListHeader";
import { Switch } from "../components/ui/Switch";

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
            {field.label}
            {field.required ? " *" : ""}
            <Input
              type={
                field.type === "password"
                  ? "password"
                  : field.type === "number"
                    ? "number"
                    : "text"
              }
              value={fieldValue(values, field)}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
            />
            {field.help ? (
              <span className="admin-sidebar-form__hint">{field.help}</span>
            ) : null}
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

      {loading ? <p className="admin-muted">{t("common.loading")}</p> : null}

      {!loading && instances.length === 0 ? (
        <p className="admin-muted">{t("admin.notification.channelsEmpty")}</p>
      ) : null}

      {!loading && instances.length > 0 ? (
        <ul className="notify-instance-list">
          {instances.map((item) => (
            <li key={item.id} className="page-card notify-instance-row">
              <div className="notify-instance-main">
                <span className="notify-instance-name">{item.name}</span>
                <span className="notify-instance-type">{item.type_name}</span>
              </div>
              <div className="notify-instance-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void openEdit(item.id)}
                >
                  <Pencil size={16} aria-hidden />
                  {t("common.edit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void onDelete(item.id, item.name)}
                >
                  <Trash2 size={16} aria-hidden />
                  {t("common.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

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
            {t("common.type")}
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
            {t("common.name")}
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
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
            {t("common.name")}
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </label>
          <InstanceFormFields fields={editFields} values={editValues} onChange={setEditValues} />
          {editChannelType === "smtp" ? (
            <label className="admin-sidebar-form__label">
              {t("admin.notification.testToEmail")}
              <Input
                value={testToEmail}
                onChange={(e) => setTestToEmail(e.target.value)}
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
