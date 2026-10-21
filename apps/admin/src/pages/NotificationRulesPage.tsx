import { Button, ChoiceGroup, Input, Select, Textarea, toast } from "@sakuio/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationInstances,
  fetchNotificationRules,
  updateNotificationRule,
  type NotificationInstanceSummary,
  type NotificationRule,
} from "../api/notification";
import { ClientMultiSelectSidebar } from "../components/ping/ClientMultiSelectSidebar";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { PageListHeader } from "../components/PageListHeader";
import { Switch } from "../components/ui/Switch";
import { useAllAdminClients } from "../hooks/useAllAdminClients";

type EventType = NotificationRule["event_type"];

const EVENT_TYPES: EventType[] = ["offline", "traffic", "traffic_exceeded", "expire", "login"];

const eventLabelKey: Record<EventType, string> = {
  offline: "admin.notification.eventOffline",
  traffic: "admin.notification.eventTraffic",
  traffic_exceeded: "admin.notification.eventTrafficExceeded",
  expire: "admin.notification.eventExpire",
  login: "admin.notification.eventLogin",
};

const thresholdLabelKey: Record<EventType, string> = {
  offline: "admin.notification.thresholdGrace",
  traffic: "admin.notification.thresholdTraffic",
  traffic_exceeded: "admin.notification.thresholdNone",
  expire: "admin.notification.thresholdExpire",
  login: "admin.notification.thresholdNone",
};

const thresholdHintKey: Record<EventType, string | null> = {
  offline: "admin.notification.thresholdHintOffline",
  traffic: "admin.notification.thresholdHintTraffic",
  traffic_exceeded: null,
  expire: "admin.notification.thresholdHintExpire",
  login: null,
};

const VARIABLE_HINTS: Record<EventType, string> = {
  offline: "{{node_name}} {{grace_period}} {{last_online}} {{time}}",
  traffic: "{{node_name}} {{traffic_used}} {{traffic_threshold}} {{time}}",
  traffic_exceeded:
    "{{node_name}} {{traffic_used}} {{traffic_threshold}} {{level}} {{time}}",
  expire: "{{node_name}} {{days_left}} {{expire_date}} {{time}}",
  login: "{{username}} {{ip}} {{ip_location}} {{time}}",
};

const defaultRule = (): Omit<NotificationRule, "id"> => ({
  name: "",
  event_type: "offline",
  threshold: 60,
  channels: [],
  clients: [],
  template_title: "",
  template_body: "",
});

export default function NotificationRulesPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { clients } = useAllAdminClients();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [instances, setInstances] = useState<NotificationInstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<NotificationRule, "id">>(defaultRule);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [saving, setSaving] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ruleList, instanceList] = await Promise.all([
        fetchNotificationRules(),
        fetchNotificationInstances(),
      ]);
      setRules(ruleList);
      setInstances(instanceList);
    } catch {
      toast.error(t("admin.notification.rulesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openAdd = () => {
    setEditId(null);
    setForm(defaultRule());
    setScope("all");
    setEditOpen(true);
  };

  const openEdit = (rule: NotificationRule) => {
    setEditId(rule.id);
    setForm({
      name: rule.name,
      event_type: rule.event_type,
      threshold: rule.threshold,
      channels: [...rule.channels],
      clients: [...rule.clients],
      template_title: rule.template_title,
      template_body: rule.template_body,
    });
    setScope(rule.clients.length === 0 ? "all" : "selected");
    setEditOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || form.channels.length === 0) {
      toast.error(t("admin.notification.ruleIncomplete"));
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<NotificationRule, "id"> = {
        ...form,
        name: form.name.trim(),
        clients:
          form.event_type === "login" || scope === "all"
            ? []
            : form.clients,
      };
      if (editId) {
        await updateNotificationRule(editId, payload);
      } else {
        await createNotificationRule(payload);
      }
      toast.success(t("common.success"));
      setEditOpen(false);
      await reload();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (rule: NotificationRule) => {
    confirm({
      title: t("admin.notification.ruleConfirmDelete", { name: rule.name }),
      danger: true,
      onConfirm: async () => {
        try {
          await deleteNotificationRule(rule.id);
          toast.success(t("common.deleted_successfully"));
          await reload();
        } catch {
          toast.error(t("common.error"));
        }
      },
    });
  };

  const toggleChannel = (id: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      channels: checked
        ? [...f.channels, id]
        : f.channels.filter((c) => c !== id),
    }));
  };

  const instanceName = (id: string) =>
    instances.find((i) => i.id === id)?.name ?? id;

  const clientName = (uuid: string) =>
    clients.find((c) => c.uuid === uuid)?.name ?? uuid;

  return (
    <section className="page-container page-container--entity-list">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.nav.notificationRules"
        actions={
          <Button type="button" size="sm" onClick={openAdd}>
            <Plus size={16} aria-hidden />
            {t("common.add")}
          </Button>
        }
      />

      {loading ? <p className="admin-muted">{t("common.loading")}</p> : null}

      {!loading && rules.length === 0 ? (
        <p className="admin-muted">{t("admin.notification.rulesEmpty")}</p>
      ) : null}

      {!loading && rules.length > 0 ? (
        <ul className="notify-instance-list">
          {rules.map((rule) => (
            <li key={rule.id} className="page-card notify-instance-row">
              <div className="notify-instance-main">
                <span className="notify-instance-name">{rule.name}</span>
                <span className="notify-instance-type">
                  {t(eventLabelKey[rule.event_type])}
                  {rule.event_type !== "login" && rule.event_type !== "traffic_exceeded"
                    ? ` ${rule.threshold}${
                        rule.event_type === "offline"
                          ? "s"
                          : rule.event_type === "expire"
                            ? ` ${t("time.day")}`
                            : "%"
                      }`
                    : ""}
                </span>
                <span className="notify-instance-meta">
                  {rule.channels.map(instanceName).join(" / ")}
                </span>
              </div>
              <div className="notify-instance-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(rule)}
                >
                  <Pencil size={16} aria-hidden />
                  {t("common.edit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void onDelete(rule)}
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
        open={editOpen}
        title={editId ? t("common.edit") : t("common.add")}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      >
        <div className="admin-sidebar-form">
          <label className="admin-sidebar-form__label">
            {t("common.name")}
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("admin.notification.ruleNamePlaceholder")}
            />
          </label>

          <div className="admin-sidebar-form__label">
            <span className="admin-sidebar-form__label-text">
              {t("admin.notification.ruleEvent")}
            </span>
            <ChoiceGroup
              ariaLabel={t("admin.notification.ruleEvent")}
              value={form.event_type}
              onChange={(v) => setForm((f) => ({ ...f, event_type: v as EventType }))}
              options={EVENT_TYPES.map((ev) => ({
                value: ev,
                title: t(eventLabelKey[ev]),
              }))}
            />
          </div>

          {form.event_type !== "login" && form.event_type !== "traffic_exceeded" ? (
            <label className="admin-sidebar-form__label">
              {t(thresholdLabelKey[form.event_type])}
              <Input
                type="number"
                min={0}
                value={String(form.threshold)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    threshold: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
              <span className="admin-sidebar-form__hint">
                {t(thresholdHintKey[form.event_type] ?? "")}
              </span>
            </label>
          ) : null}

          <div className="admin-sidebar-form__label">
            <span className="admin-sidebar-form__label-text">
              {t("admin.notification.ruleChannels")}
            </span>
            {instances.length === 0 ? (
              <span className="admin-sidebar-form__hint">
                {t("admin.notification.ruleNoChannels")}
              </span>
            ) : (
              <div className="notify-channel-picker">
                {instances.map((inst) => (
                  <div key={inst.id} className="notify-channel-option">
                    <span className="notify-channel-option__name">
                      {inst.name}
                      <span className="notify-channel-option__type">{inst.type_name}</span>
                    </span>
                    <Switch
                      checked={form.channels.includes(inst.id)}
                      label={inst.name}
                      onChange={(checked) => toggleChannel(inst.id, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {form.event_type !== "login" ? (
            <div className="admin-sidebar-form__label">
              <span className="admin-sidebar-form__label-text">
                {t("admin.notification.ruleScope")}
              </span>
              <ChoiceGroup
                ariaLabel={t("admin.notification.ruleScope")}
                value={scope}
                onChange={(v) => setScope(v === "selected" ? "selected" : "all")}
                options={[
                  { value: "all", title: t("admin.notification.scopeAll") },
                  { value: "selected", title: t("admin.notification.scopeSelected") },
                ]}
              />
              {scope === "selected" ? (
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setClientPickerOpen(true)}
                  >
                    {t("common.select_nodes")}
                  </Button>
                  <p className="admin-sidebar-form__hint">
                    {form.clients.length === 0
                      ? t("admin.notification.scopeNoneSelected")
                      : form.clients.map(clientName).join(" / ")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="admin-sidebar-form__label">
            {t("admin.notification.templateTitle")}
            <Input
              value={form.template_title}
              onChange={(e) =>
                setForm((f) => ({ ...f, template_title: e.target.value }))
              }
              placeholder={t("admin.notification.templateTitlePlaceholder")}
            />
          </label>
          <div className="admin-sidebar-form__label">
            <span className="admin-sidebar-form__label-text">
              {t("admin.notification.templateBody")}
            </span>
            <Textarea
              value={form.template_body}
              onChange={(e) =>
                setForm((f) => ({ ...f, template_body: e.target.value }))
              }
              placeholder={t("admin.notification.templateBodyPlaceholder")}
              rows={5}
            />
            <span className="admin-sidebar-form__hint">
              {t("admin.notification.templateVars")}: {VARIABLE_HINTS[form.event_type]}
            </span>
          </div>
        </div>
      </GenericSidebar>

      <ClientMultiSelectSidebar
        open={clientPickerOpen}
        title={t("common.select_nodes")}
        clients={clients}
        value={form.clients}
        onClose={() => setClientPickerOpen(false)}
        onSave={(next) => {
          setForm((f) => ({ ...f, clients: next.map(String) }));
          setClientPickerOpen(false);
        }}
      />
    </section>
  );
}
