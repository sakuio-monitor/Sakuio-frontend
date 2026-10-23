import { Button, toast } from "@sakuio/ui";
import { CheckCircle2, Clock, Copy, Play, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBlock } from "../components/LoadingBlock";
import { PageListHeader } from "../components/PageListHeader";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { ClientMultiSelectSidebar } from "../components/ping/ClientMultiSelectSidebar";
import { useAllAdminClients } from "../hooks/useAllAdminClients";

type TaskResult = {
  task_id: string;
  client: string;
  client_info: { uuid: string; name: string };
  result: string;
  exit_code: number | null;
  finished_at: string | null;
  offline?: boolean;
};

function wsBase() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
}

function tryParseExit(data: ArrayBuffer): number | null {
  try {
    const text = new TextDecoder().decode(data).trim();
    if (!text.startsWith("{")) {
      return null;
    }
    const v = JSON.parse(text) as { op?: string; code?: number };
    if (v.op === "exit" && typeof v.code === "number") {
      return v.code;
    }
  } catch {
    return null;
  }
  return null;
}

export default function ExecPage() {
  const { t } = useTranslation();
  const [command, setCommand] = useState("");
  const { clients, loading: clientsLoading } = useAllAdminClients();
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TaskResult>>({});
  const socketsRef = useRef<WebSocket[]>([]);
  const streamGenRef = useRef(0);

  const closeStreams = () => {
    streamGenRef.current += 1;
    for (const ws of socketsRef.current) {
      ws.close();
    }
    socketsRef.current = [];
  };

  useEffect(() => () => closeStreams(), []);

  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.uuid, c.name]));
    return (uuid: string) => map.get(uuid) ?? uuid;
  }, [clients]);

  const selectedLabel = useMemo(() => {
    if (selected.length === 0) {
      return t("exec.noNodesSelected");
    }
    return selected.map((id) => clientName(id)).join(", ");
  }, [selected, clientName, t]);

  const openStreams = (id: string, uuids: string[]) => {
    closeStreams();
    const gen = streamGenRef.current;
    for (const uuid of uuids) {
      const ws = new WebSocket(
        `${wsBase()}/api/admin/task/${encodeURIComponent(id)}/clients/${encodeURIComponent(uuid)}/stream`,
      );
      ws.binaryType = "arraybuffer";
      ws.onmessage = (event) => {
        if (gen !== streamGenRef.current) {
          return;
        }
        if (!(event.data instanceof ArrayBuffer)) {
          return;
        }
        const exit = tryParseExit(event.data);
        if (exit !== null) {
          setResults((prev) => {
            const row = prev[uuid];
            if (!row) {
              return prev;
            }
            return {
              ...prev,
              [uuid]: {
                ...row,
                exit_code: exit,
                finished_at: new Date().toISOString(),
              },
            };
          });
          return;
        }
        const chunk = new TextDecoder().decode(event.data);
        setResults((prev) => {
          const row = prev[uuid] ?? {
            task_id: id,
            client: uuid,
            client_info: { uuid, name: clientName(uuid) },
            result: "",
            exit_code: null,
            finished_at: null,
          };
          return {
            ...prev,
            [uuid]: { ...row, result: row.result + chunk },
          };
        });
      };
      socketsRef.current.push(ws);
    }
  };

  const runExec = async () => {
    if (!command.trim()) {
      toast.error(t("exec.errors.emptyCommand"));
      return;
    }
    if (selected.length === 0) {
      toast.error(t("exec.errors.noNodes"));
      return;
    }
    setExecuting(true);
    closeStreams();
    setResults({});
    setTaskId(null);
    try {
      const res = await fetch("/api/admin/task/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, clients: selected }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        success?: boolean;
        task_id?: string;
        clients?: string[];
        undispatched?: string[];
      };
      if (!data.success || !data.task_id) {
        throw new Error("exec failed");
      }
      const id = data.task_id;
      const dispatched = data.clients ?? selected;
      const undisp = data.undispatched ?? [];
      setTaskId(id);
      const now = new Date().toISOString();
      const initial: Record<string, TaskResult> = {};
      for (const uuid of dispatched) {
        initial[uuid] = {
          task_id: id,
          client: uuid,
          client_info: { uuid, name: clientName(uuid) },
          result: "",
          exit_code: null,
          finished_at: null,
        };
      }
      for (const uuid of undisp) {
        if (initial[uuid]) {
          continue;
        }
        initial[uuid] = {
          task_id: id,
          client: uuid,
          client_info: { uuid, name: clientName(uuid) },
          result: "",
          exit_code: -1,
          finished_at: now,
          offline: true,
        };
      }
      setResults(initial);
      openStreams(id, dispatched);
      toast.success(t("exec.taskStarted"));
    } catch {
      toast.error(t("exec.errors.executionFailed"));
    } finally {
      setExecuting(false);
    }
  };

  const resultRows = Object.values(results);

  return (
    <section className="page-container page-container--entity-list">
      <PageListHeader
        titleKey="exec.title"
        actions={
          <Button type="button" size="sm" disabled={executing} onClick={() => void runExec()}>
            <Play size={16} aria-hidden />
            {executing ? t("exec.executing") : t("exec.execute")}
          </Button>
        }
      />

      <div className="page-card exec-page-card">
        <label className="admin-sidebar-form__label" htmlFor="exec-command">
          {t("exec.command")}
        </label>
        <textarea
          id="exec-command"
          className="exec-command-input"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={t("exec.commandPlaceholder")}
          rows={5}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (!executing) {
                void runExec();
              }
            }
          }}
        />

        <div className="exec-page-meta">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
            {t("exec.selectNodes")}
          </Button>
          <span className="admin-muted exec-page-selected">{selectedLabel}</span>
        </div>
        {taskId ? (
          <p className="admin-muted exec-page-task">
            {t("exec.taskId", { id: taskId.slice(0, 8) })}
          </p>
        ) : null}
      </div>

      {clientsLoading ? <LoadingBlock label={t("common.loading")} /> : null}

      {resultRows.length > 0 ? (
        <div className="page-card exec-page-card exec-results-block">
          <h2 className="exec-results-title">{t("exec.results")}</h2>
          <div className="exec-result-grid">
            {resultRows.map((row) => {
              const running = row.finished_at === null;
              const ok = row.exit_code === 0;
              const statusClass = row.offline
                ? "exec-result-status--error"
                : running
                  ? ""
                  : ok
                    ? "exec-result-status--success"
                    : "exec-result-status--error";
              return (
                <article key={row.client} className="exec-result-panel">
                  <header className="exec-result-header">
                    <strong>{row.client_info.name}</strong>
                    <span
                      className={
                        statusClass ? `exec-result-status ${statusClass}` : "exec-result-status"
                      }
                    >
                      {row.offline ? (
                        <>
                          <XCircle size={14} aria-hidden /> {t("exec.status.offline")}
                        </>
                      ) : running ? (
                        <>
                          <Clock size={14} aria-hidden /> {t("exec.status.running")}
                        </>
                      ) : ok ? (
                        <>
                          <CheckCircle2 size={14} aria-hidden /> {t("common.success")}
                        </>
                      ) : (
                        <>
                          <XCircle size={14} aria-hidden /> {t("common.error")} ({row.exit_code})
                        </>
                      )}
                    </span>
                    {!row.offline ? (
                      <CellTooltip tip={t("common.copy")}>
                        <button
                          type="button"
                          className="exec-copy"
                          onClick={() => {
                            void navigator.clipboard.writeText(row.result);
                            toast.success(t("common.success"));
                          }}
                          aria-label={t("common.copy")}
                        >
                          <Copy size={14} aria-hidden />
                        </button>
                      </CellTooltip>
                    ) : null}
                  </header>
                  <pre className="exec-output">
                    {row.offline ? t("exec.offlineOutput") : row.result || (running ? "…" : "")}
                  </pre>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <ClientMultiSelectSidebar
        open={pickerOpen}
        title={t("exec.selectNodes")}
        clients={clients}
        value={selected}
        onClose={() => setPickerOpen(false)}
        onSave={(next) => {
          setSelected(next);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
