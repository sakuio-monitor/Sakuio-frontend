import { Button, toast } from "@sakuio/ui";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addPingTask, deletePingTasks, fetchAllPingTasks } from "../api/pingTasks";
import { PageListHeader } from "../components/PageListHeader";
import { PingTaskView } from "../components/ping/PingTaskView";
import { ClientMultiSelectSidebar } from "../components/ping/ClientMultiSelectSidebar";
import { PingTaskFormFields } from "../components/ping/PingTaskFormFields";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { useAllAdminClients } from "../hooks/useAllAdminClients";
import type { PingTask, PingTaskDraft } from "../types/ping";

const defaultDraft = (): PingTaskDraft => ({
  name: "",
  type: "icmp",
  target: "",
  interval: 60,
  default_on: false,
  clients: [],
});

export default function PingPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const { clients, loading: clientsLoading, error: clientsError } = useAllAdminClients();
  const [tasks, setTasks] = useState<PingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<PingTaskDraft>(defaultDraft);
  const [addSaving, setAddSaving] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);

  const reloadTasks = useCallback(async () => {
    setTasksError(null);
    setTasksLoading(true);
    try {
      setTasks(await fetchAllPingTasks());
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : t("common.error"));
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reloadTasks();
  }, [reloadTasks]);

  const loading = tasksLoading || clientsLoading;
  const error = tasksError ?? clientsError;

  async function submitAdd() {
    if (!addForm.default_on && addForm.clients.length === 0) {
      toast.error(t("admin.ping.defaultOnHint"));
      return;
    }
    setAddSaving(true);
    try {
      await addPingTask(addForm);
      toast.success(t("common.success"));
      setAddOpen(false);
      setAddForm(defaultDraft());
      await reloadTasks();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setAddSaving(false);
    }
  }

  function bulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) {
      return;
    }
    confirm({
      title: t("admin.ping.bulkDeleteConfirm", { n: ids.length }),
      danger: true,
      onConfirm: async () => {
        try {
          await deletePingTasks(ids);
          toast.success(t("admin.ping.bulkDeleteSuccess", { n: ids.length }));
          setSelectedIds(new Set());
          await reloadTasks();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("common.error"));
        }
      },
    });
  }

  return (
    <section className="page-container page-container--entity-list">
      {confirmDialog}
      <PageListHeader
        titleKey="admin.ping.title"
        actions={
          <>
            <span
              className="admin-bulk-actions"
              data-active={selectedIds.size > 0 || undefined}
            >
              <Button type="button" size="sm" variant="secondary" onClick={() => void bulkDelete()}>
                <Trash2 size={14} aria-hidden />
                {t("common.delete")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setSelectedIds(new Set())}
              >
                {t("common.cancel")}
              </Button>
            </span>
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={16} aria-hidden />
              {t("common.add")}
            </Button>
          </>
        }
      />

      {loading ? <p className="admin-muted">{t("common.loading")}</p> : null}
      {error ? (
        <p className="page-card p-5 text-sm text-apple-red" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error ? (
        <PingTaskView
          tasks={tasks}
          clients={clients}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onChanged={() => void reloadTasks()}
        />
      ) : null}

      <GenericSidebar
        open={addOpen}
        title={t("admin.ping.addTask")}
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={addSaving} onClick={() => void submitAdd()}>
              {t("common.add")}
            </Button>
          </>
        }
      >
        <PingTaskFormFields
          form={addForm}
          onChange={setAddForm}
          onPickClients={() => setClientPickerOpen(true)}
        />
      </GenericSidebar>

      <ClientMultiSelectSidebar
        open={clientPickerOpen}
        title={t("common.selectClients")}
        clients={clients}
        value={addForm.clients}
        onClose={() => setClientPickerOpen(false)}
        onSave={(next) => {
          setAddForm((f) => ({ ...f, clients: next }));
          setClientPickerOpen(false);
        }}
      />
    </section>
  );
}
