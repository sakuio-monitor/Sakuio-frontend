import { Button, toast } from "@sakuio/ui";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { deletePingTasks, editPingTasks, orderPingTasks } from "../../api/pingTasks";
import type { AdminClientSummary, PingTask, PingTaskDraft } from "../../types/ping";
import { DataTable, type Column } from "../DataTable/DataTable";
import { CellTooltip } from "../CellTooltip/CellTooltip";
import { GenericSidebar } from "../GenericSidebar/GenericSidebar";
import { ClientMultiSelectSidebar } from "./ClientMultiSelectSidebar";
import { PingTaskFormFields } from "./PingTaskFormFields";
import { useConfirmDialog } from "../ConfirmDialog/ConfirmDialog";

type Props = {
  tasks: PingTask[];
  clients: AdminClientSummary[];
  onChanged: () => void;
};

function clientLabel(clients: AdminClientSummary[], uuid: string): string {
  return clients.find((c) => c.uuid === uuid)?.name ?? uuid;
}

function summarizeClients(task: PingTask, clients: AdminClientSummary[]): string {
  if (!task.clients.length) {
    return "";
  }
  const names = task.clients.map((id) => clientLabel(clients, id));
  const joined = names.join(", ");
  return joined.length > 40 ? `${joined.slice(0, 40)}…` : joined;
}

const emptyDraft = (): PingTaskDraft => ({
  name: "",
  type: "icmp",
  target: "",
  interval: 60,
  default_on: false,
  clients: [],
});

export function PingTaskView({ tasks, clients, onChanged }: Props) {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const clientIds = useMemo(() => new Set(clients.map((c) => c.uuid)), [clients]);

  const processed = useMemo(() => {
    return tasks.map((task) => ({
      ...task,
      clients: task.clients.filter((id) => clientIds.has(id)),
    }));
  }, [tasks, clientIds]);

  const [localTasks, setLocalTasks] = useState(processed);

  const [editOpen, setEditOpen] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PingTaskDraft>(emptyDraft());
  const [editSaving, setEditSaving] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientPickerMode, setClientPickerMode] = useState<"edit" | "inline">("edit");
  const [inlineTaskId, setInlineTaskId] = useState<number | null>(null);

  useEffect(() => {
    setLocalTasks(processed);
  }, [processed]);

  const persistOrder = useCallback(
    async (reordered: PingTask[]) => {
      const orderData: Record<string, number> = {};
      reordered.forEach((task, index) => {
        orderData[String(task.id)] = index;
      });
      const previous = localTasks;
      setLocalTasks(reordered);
      try {
        await orderPingTasks(orderData);
      } catch (e) {
        setLocalTasks(previous);
        toast.error(e instanceof Error ? e.message : t("common.error"));
        onChanged();
      }
    },
    [localTasks, onChanged, t],
  );

  const moveTask = useCallback(
    async (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= localTasks.length) {
        return;
      }
      const reordered = [...localTasks];
      const tmp = reordered[index];
      reordered[index] = reordered[target];
      reordered[target] = tmp;
      await persistOrder(reordered);
    },
    [localTasks, persistOrder],
  );

  function validateDraft(form: PingTaskDraft): boolean {
    if (!form.default_on && form.clients.length === 0) {
      toast.error(t("admin.ping.defaultOnHint"));
      return false;
    }
    return true;
  }

  function openEdit(task: PingTask) {
    setEditTaskId(task.id);
    setEditForm({
      name: task.name,
      type: (task.type as PingTaskDraft["type"]) || "icmp",
      target: task.target,
      interval: task.interval,
      default_on: task.default_on,
      clients: [...task.clients],
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (editTaskId === null || !validateDraft(editForm)) {
      return;
    }
    setEditSaving(true);
    try {
      await editPingTasks([{ ...editForm, id: editTaskId }]);
      toast.success(t("common.saved"));
      setEditOpen(false);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setEditSaving(false);
    }
  }

  async function saveInlineClients(task: PingTask, nextClients: string[]) {
    const draft: PingTaskDraft = {
      name: task.name,
      type: (task.type as PingTaskDraft["type"]) || "icmp",
      target: task.target,
      interval: task.interval,
      default_on: task.default_on,
      clients: nextClients,
    };
    if (!validateDraft(draft)) {
      return;
    }
    try {
      await editPingTasks([{ ...draft, id: task.id }]);
      toast.success(t("common.saved"));
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  function removeTask(task: PingTask) {
    confirm({
      title: t("admin.ping.deleteConfirm", { name: task.name }),
      danger: true,
      onConfirm: async () => {
        try {
          await deletePingTasks([task.id]);
          toast.success(t("common.deleted"));
          onChanged();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t("common.error"));
        }
      },
    });
  }

  const inlineTask = inlineTaskId !== null ? localTasks.find((x) => x.id === inlineTaskId) : null;

  const columns: Column<PingTask>[] = useMemo(
    () => [
      {
        key: "order",
        title: t("common.sort"),
        width: 88,
        fixedWidth: true,
        render: (_row, index) => (
          <div className="data-table-actions data-table-actions--icons">
            <CellTooltip tip={t("common.moveUp")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="data-table-icon-btn"
                disabled={index === 0}
                aria-label={t("common.moveUp")}
                icon={<ChevronUp size={16} aria-hidden />}
                onClick={() => void moveTask(index, -1)}
              />
            </CellTooltip>
            <CellTooltip tip={t("common.moveDown")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="data-table-icon-btn"
                disabled={index === localTasks.length - 1}
                aria-label={t("common.moveDown")}
                icon={<ChevronDown size={16} aria-hidden />}
                onClick={() => void moveTask(index, 1)}
              />
            </CellTooltip>
          </div>
        ),
      },
      {
        key: "name",
        title: t("common.name"),
        render: (row) => <span className="data-table-cell">{row.name}</span>,
      },
      {
        key: "servers",
        title: t("common.server"),
        render: (row) => (
          <div className="data-table-actions data-table-actions--icons admin-table-vcenter">
            <CellTooltip
              tip={summarizeClients(row, clients)}
              className="data-table-cell admin-table-cell-clip"
            >
              {row.clients.length > 0 ? summarizeClients(row, clients) : t("common.none")}
            </CellTooltip>
            {row.default_on ? (
              <span className="admin-status admin-status--online">{t("admin.ping.defaultOnShort")}</span>
            ) : null}
            <CellTooltip tip={t("common.selectClients")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="data-table-icon-btn"
                aria-label={t("common.selectClients")}
                icon={<MoreHorizontal size={16} aria-hidden />}
                onClick={() => {
                  setInlineTaskId(row.id);
                  setClientPickerMode("inline");
                  setClientPickerOpen(true);
                }}
              />
            </CellTooltip>
          </div>
        ),
      },
      {
        key: "target",
        title: t("admin.ping.target"),
        render: (row) => <span className="data-table-cell">{row.target}</span>,
      },
      {
        key: "type",
        title: t("common.type"),
        width: 88,
        fixedWidth: true,
        render: (row) => <span className="data-table-cell">{row.type}</span>,
      },
      {
        key: "interval",
        title: t("admin.ping.interval"),
        width: 88,
        fixedWidth: true,
        render: (row) => (
          <span className="data-table-cell admin-font-number">{row.interval}</span>
        ),
      },
      {
        key: "actions",
        title: t("common.action"),
        width: 88,
        fixedWidth: true,
        render: (row) => (
          <div className="data-table-actions data-table-actions--icons">
            <CellTooltip tip={t("common.edit")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="data-table-icon-btn"
                aria-label={t("common.edit")}
                icon={<Pencil size={16} aria-hidden />}
                onClick={() => openEdit(row)}
              />
            </CellTooltip>
            <CellTooltip tip={t("common.delete")}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="data-table-icon-btn data-table-icon-btn--danger"
                aria-label={t("common.delete")}
                icon={<Trash2 size={16} aria-hidden />}
                onClick={() => void removeTask(row)}
              />
            </CellTooltip>
          </div>
        ),
      },
    ],
    [clients, localTasks.length, moveTask, t],
  );

  return (
    <>
      {confirmDialog}
      <DataTable
        tableClassName="data-table--entity-list"
        columns={columns}
        data={localTasks}
        rowKey={(row) => row.id}
        emptyText={t("admin.ping.emptyTasks")}
      />

      <GenericSidebar
        open={editOpen}
        title={t("admin.ping.editTask")}
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={editSaving} onClick={() => void saveEdit()}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <PingTaskFormFields
          form={editForm}
          onChange={setEditForm}
          onPickClients={() => {
            setClientPickerMode("edit");
            setClientPickerOpen(true);
          }}
        />
      </GenericSidebar>

      <ClientMultiSelectSidebar
        open={clientPickerOpen}
        title={t("common.selectClients")}
        clients={clients}
        value={
          clientPickerMode === "edit" ? editForm.clients : (inlineTask?.clients ?? [])
        }
        onClose={() => setClientPickerOpen(false)}
        saving={editSaving}
        onSave={(next) => {
          if (clientPickerMode === "edit") {
            setEditForm((f) => ({ ...f, clients: next }));
            setClientPickerOpen(false);
            return;
          }
          if (inlineTask) {
            setClientPickerOpen(false);
            void saveInlineClients(inlineTask, next);
          }
        }}
      />
    </>
  );
}
