import { Button, ChoiceGroup, Input, Select, Textarea, toast } from "@sakuio/ui";
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createNotificationRule,
  deleteNotificationRule,
  fetchNotificationInstances,
  fetchNotificationRules,
  setNotificationRuleEnabled,
  updateNotificationRule,
  type NotificationInstanceSummary,
  type NotificationRule,
} from "../api/notification";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { DataTable, type Column } from "../components/DataTable/DataTable";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { PageListHeader } from "../components/PageListHeader";
import { SearchableMultiSelect } from "../components/ui/SearchableMultiSelect";
import { FieldLabel } from "../components/ui/FieldLabel";
import { fetchClientOptions } from "../api/ddns";

type EventType = NotificationRule["event_type"];

const EVENT_TYPES: EventType[] = [
  "offline", "online", "ip_change", "cpu_high", "memory_high", "disk_high",
  "swap_high", "load_high", "bandwidth_high", "gpu_high", "process_high",
  "traffic", "traffic_exceeded", "expire", "login",
];

const eventLabelKey: Record<EventType, string> = {
  offline: "admin.notification.eventOffline",
  online: "admin.notification.eventOnline",
  ip_change: "admin.notification.eventIpChange",
  cpu_high: "admin.notification.eventCpuHigh",
  memory_high: "admin.notification.eventMemoryHigh",
  disk_high: "admin.notification.eventDiskHigh",
  swap_high: "admin.notification.eventSwapHigh",
  load_high: "admin.notification.eventLoadHigh",
  bandwidth_high: "admin.notification.eventBandwidthHigh",
  gpu_high: "admin.notification.eventGpuHigh",
  process_high: "admin.notification.eventProcessHigh",
  traffic: "admin.notification.eventTraffic",
  traffic_exceeded: "admin.notification.eventTrafficExceeded",
  expire: "admin.notification.eventExpire",
  login: "admin.notification.eventLogin",
};

const METRIC_EVENTS: EventType[] = [
  "cpu_high", "memory_high", "disk_high", "swap_high", "load_high",
  "bandwidth_high", "gpu_high", "process_high",
];

const thresholdLabelKey: Record<EventType, string> = {
  offline: "admin.notification.thresholdGrace",
  traffic: "admin.notification.thresholdTraffic",
  traffic_exceeded: "admin.notification.thresholdNone",
  expire: "admin.notification.thresholdExpire",
  login: "admin.notification.thresholdNone",
  online: "admin.notification.thresholdNone",
  ip_change: "admin.notification.thresholdNone",
  cpu_high: "admin.notification.metricThreshold",
  memory_high: "admin.notification.metricThreshold",
  disk_high: "admin.notification.metricThreshold",
  swap_high: "admin.notification.metricThreshold",
  load_high: "admin.notification.metricThreshold",
  bandwidth_high: "admin.notification.metricThreshold",
  gpu_high: "admin.notification.metricThreshold",
  process_high: "admin.notification.metricThreshold",
};

const thresholdHintKey: Record<EventType, string | null> = {
  offline: "admin.notification.thresholdHintOffline",
  traffic: "admin.notification.thresholdHintTraffic",
  traffic_exceeded: null,
  expire: "admin.notification.thresholdHintExpire",
  login: null,
  online: null,
  ip_change: null,
  cpu_high: "admin.notification.metricHint",
  memory_high: "admin.notification.metricHint",
  disk_high: "admin.notification.metricHint",
  swap_high: "admin.notification.metricHint",
  load_high: "admin.notification.metricHint",
  bandwidth_high: "admin.notification.metricHint",
  gpu_high: "admin.notification.metricHint",
  process_high: "admin.notification.metricHint",
};

const VARIABLE_HINTS: Record<EventType, string> = {
  offline: "{{node_name}} {{grace_period}} {{last_online}} {{time}}",
  online: "{{node_name}} {{time}}",
  ip_change: "{{node_name}} {{old_ip}} {{new_ip}} {{time}}",
  cpu_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  memory_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  disk_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  swap_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  load_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  bandwidth_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  gpu_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  process_high: "{{node_name}} {{metric_value}} {{threshold}} {{duration}} {{time}}",
  traffic: "{{node_name}} {{traffic_used}} {{traffic_threshold}} {{time}}",
  traffic_exceeded: "{{node_name}} {{traffic_used}} {{traffic_threshold}} {{level}} {{time}}",
  expire: "{{node_name}} {{days_left}} {{expire_date}} {{time}}",
  login: "{{username}} {{ip}} {{ip_location}} {{time}}",
};

const defaultRule = (): Omit<NotificationRule, "id"> => ({
  name: "",
  event_type: "offline",
  threshold: 60,
  duration_secs: 300,
  enabled: true,
  channels: [],
  clients: [],
  template_title: "",
  template_body: "",
});

export default function NotificationRulesPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [instances, setInstances] = useState<NotificationInstanceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<NotificationRule, "id">>(defaultRule);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [saving, setSaving] = useState(false);

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
      duration_secs: rule.duration_secs ?? 300,
      enabled: rule.enabled ?? true,
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


  const toggleEnabled = async (rule: NotificationRule) => {
    try {
      await setNotificationRuleEnabled(rule.id, !rule.enabled);
      await reload();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const instanceName = (id: string) =>
    instances.find((i) => i.id === id)?.name ?? id;


  const thresholdText = (rule: NotificationRule) => {
    if (rule.event_type === "offline") return `${rule.threshold}s`;
    if (rule.event_type === "expire") return `${rule.threshold} ${t("time.day")}`;
    if (rule.event_type === "traffic") return `${rule.threshold}%`;
    if (rule.event_type === "bandwidth_high") return `${rule.threshold} Mbps`;
    if (rule.event_type === "load_high" || rule.event_type === "process_high") return `${rule.threshold}`;
    if (METRIC_EVENTS.includes(rule.event_type)) return `${rule.threshold}%`;
    return "—";
  };

  const columns: Column<NotificationRule>[] = useMemo(() => [
    {
      key: "name",
      title: t("common.name"),
      render: (rule) => <span className={`data-table-cell${rule.enabled ? "" : " is-disabled"}`}>{rule.name}</span>,
    },
    {
      key: "event",
      title: t("admin.notification.ruleEvent"),
      render: (rule) => <span className="data-table-tag data-table-tag--blue">{t(eventLabelKey[rule.event_type])}</span>,
    },
    {
      key: "threshold",
      title: t("admin.notification.ruleThreshold"),
      render: (rule) => <span className="data-table-cell admin-font-number">{thresholdText(rule)}</span>,
    },
    {
      key: "channels",
      title: t("admin.notification.ruleChannels"),
      render: (rule) => (
        <span className="data-table-cell" title={rule.channels.map(instanceName).join(" / ")}>
          {rule.channels.length ? rule.channels.map(instanceName).join(" / ") : "—"}
        </span>
      ),
    },
    {
      key: "clients",
      title: t("admin.notification.ruleScope"),
      render: (rule) => <span className="data-table-cell">{rule.clients.length ? `${rule.clients.length} 台` : "全部服务器"}</span>,
    },
    {
      key: "actions",
      title: t("common.action"),
      render: (rule) => (
        <div className="data-table-actions data-table-actions--icons">
          <CellTooltip tip={rule.enabled ? t("common.disable") : t("common.enable")}>
            <button type="button" className="data-table-icon-btn" aria-label={rule.enabled ? t("common.disable") : t("common.enable")} onClick={() => void toggleEnabled(rule)}>
              {rule.enabled ? <Power size={18} aria-hidden /> : <PowerOff size={18} aria-hidden />}
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.edit")}>
            <button type="button" className="data-table-icon-btn" aria-label={t("common.edit")} onClick={() => openEdit(rule)}>
              <Pencil size={18} aria-hidden />
            </button>
          </CellTooltip>
          <CellTooltip tip={t("common.delete")}>
            <button type="button" className="data-table-icon-btn data-table-icon-btn--danger" aria-label={t("common.delete")} onClick={() => void onDelete(rule)}>
              <Trash2 size={18} aria-hidden />
            </button>
          </CellTooltip>
        </div>
      ),
    },
  ], [t, instances]);

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

      <DataTable
        tableClassName="data-table--entity-list"
        listLayoutId="notification_rules"
        columns={columns}
        data={rules}
        rowKey={(rule) => rule.id}
        loading={loading}
        emptyText={t("admin.notification.rulesEmpty")}
      />

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
            <FieldLabel tip={t("admin.notification.ruleNameHint")}>{t("common.name")}</FieldLabel>
            <Input
              value={form.name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("admin.notification.ruleNamePlaceholder")}
            />
          </label>

          <div className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.ruleEventHint")}>
              {t("admin.notification.ruleEvent")}
            </FieldLabel>
            <SearchableMultiSelect
              values={[form.event_type]}
              options={EVENT_TYPES.map((ev) => ({ value: ev, label: t(eventLabelKey[ev]) }))}
              onChange={(values) => {
                const next = values[0] as EventType | undefined;
                if (next) setForm((f) => ({ ...f, event_type: next }));
              }}
              placeholder={t("admin.notification.ruleEvent")}
              ariaLabel={t("admin.notification.ruleEvent")}
              max={1}
            />
          </div>

          {!["login", "traffic_exceeded", "online", "ip_change"].includes(form.event_type) ? (
            <label className="admin-sidebar-form__label">
              <FieldLabel tip={t(thresholdHintKey[form.event_type] ?? "admin.notification.metricHint")}>
                {t(thresholdLabelKey[form.event_type])}
              </FieldLabel>
              <Input
                type="number"
                min={0}
                value={String(form.threshold)}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({
                    ...f,
                    threshold: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          ) : null}

          {METRIC_EVENTS.includes(form.event_type) ? (
            <label className="admin-sidebar-form__label">
              <FieldLabel tip={t("admin.notification.metricDurationHint")}>
                {t("admin.notification.metricDuration")}
              </FieldLabel>
              <Input
                type="number"
                min={0}
                value={String(form.duration_secs)}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setForm((f) => ({
                    ...f,
                    duration_secs: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          ) : null}

          <div className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.ruleChannelsHint")}>
              {t("admin.notification.ruleChannels")}
            </FieldLabel>
            {instances.length === 0 ? (
              <span className="admin-sidebar-form__hint">{t("admin.notification.ruleNoChannels")}</span>
            ) : (
              <SearchableMultiSelect
                values={form.channels}
                options={instances.map((inst) => ({ value: inst.id, label: inst.name, hint: inst.type_name }))}
                onChange={(channels) => setForm((f) => ({ ...f, channels }))}
                placeholder={t("admin.notification.ruleChannelsPlaceholder")}
                ariaLabel={t("admin.notification.ruleChannels")}
              />
            )}
          </div>

          {form.event_type !== "login" ? (
            <div className="admin-sidebar-form__label">
              <FieldLabel tip={t("admin.notification.ruleScopeHint")}>
                {t("admin.notification.ruleScope")}
              </FieldLabel>
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
                <SearchableMultiSelect
                  values={form.clients}
                  fetchOptions={async (search, page) => {
                    const result = await fetchClientOptions({ search, page, limit: 10 });
                    return {
                      items: result.items.map((client) => ({
                        value: client.uuid,
                        label: client.name,
                        hint: client.ipv4 || client.ipv6 || "",
                      })),
                      total: result.total,
                      page: result.page,
                      limit: result.limit,
                    };
                  }}
                  onChange={(clients) => setForm((f) => ({ ...f, clients }))}
                  placeholder={t("common.select_nodes")}
                  ariaLabel={t("admin.notification.ruleScope")}
                />
              ) : null}
            </div>
          ) : null}

          <label className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.templateTitleHint")}>{t("admin.notification.templateTitle")}</FieldLabel>
            <Input
              value={form.template_title}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, template_title: e.target.value }))
              }
              placeholder={t("admin.notification.templateTitlePlaceholder")}
            />
          </label>
          <div className="admin-sidebar-form__label">
            <FieldLabel tip={t("admin.notification.templateBodyHint")}>
              {t("admin.notification.templateBody")}
            </FieldLabel>
            <Textarea
              value={form.template_body}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
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

    </section>
  );
}
