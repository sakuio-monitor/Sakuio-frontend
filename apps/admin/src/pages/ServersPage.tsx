import { Button, Input, toast } from "@sakuio/ui";
import { Plus, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Column } from "../components/DataTable/DataTable";
import { DataTable } from "../components/DataTable/DataTable";
import {
  AgentServerDualIpCell,
  AgentServerNameCell,
} from "../components/EntityListLeadingCells";
import { PageListHeader } from "../components/PageListHeader";
import { useConfirmDialog } from "../components/ConfirmDialog/ConfirmDialog";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { ServerRowActions } from "../components/ServerRowActions";
import { TagSelectInput } from "../components/ui/TagSelectInput";

type ClientRow = {
  uuid: string;
  name: string;
  region?: string;
  region6?: string;
  ipv4: string;
  ipv6: string;
  agent_version?: string | null;
  group_name?: string;
  private_remark?: string;
  price?: number;
  billing_cycle?: number;
  currency?: string;
  expired_at?: string | null;
  auto_renewal?: boolean;
  traffic_threshold?: number;
  traffic_stat_mode?: string;
  traffic_used_up?: number;
  traffic_used_down?: number;
  traffic_reset_mode?: string;
  bandwidth?: number;
  bandwidth_unit?: string;
};

type ClientsPayload = {
  items?: ClientRow[];
  next_cursor?: string | null;
  total?: number;
};

function cellText(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

/** 分组/备注列超过 maxLen 字省略，完整内容走 title */
function tableCellEllipsis(value: string | null | undefined, maxLen = 10): string {
  const text = value?.trim() ?? "";
  if (!text) return "—";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

/** 价格语义：-1 = 免费（徽标），0/空 = 未设置（—），其余按 货币+价格/周期 显示 */
const PRESET_CYCLE_KEYS: [number, string][] = [
  [30, "admin.servers.cycleMonthly"],
  [92, "admin.servers.cycleQuarterly"],
  [183, "admin.servers.cycleSemiAnnual"],
  [365, "admin.servers.cycleYearly"],
  [730, "admin.servers.cycleBiennial"],
];

function cycleLabel(cycle: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (cycle < 0) return t("admin.servers.cycleOnce");
  const preset = PRESET_CYCLE_KEYS.find(([days]) => days === cycle);
  if (preset) return t(preset[1]);
  return t("admin.servers.cycleCustomDays", { n: cycle });
}

function billingPriceNode(row: ClientRow, t: (key: string, opts?: Record<string, unknown>) => string): ReactNode {
  const price = row.price ?? 0;
  const cycle = row.billing_cycle ?? 0;
  const currency = row.currency?.trim() || "$";
  if (price < 0) {
    return <span className="data-table-tag data-table-tag--green">{t("admin.servers.free")}</span>;
  }
  if (price === 0) return null;
  const text = cycle !== 0 ? `${currency}${price}/${cycleLabel(cycle, t)}` : `${currency}${price}`;
  return (
    <span className="data-table-tag data-table-tag--yellow" title={text}>
      {text}
    </span>
  );
}

/** 到期标签颜色：过期红、30 天内橙、其余绿 */
function expiryTagClass(expiredAt: string | null | undefined): string {
  if (!expiredAt) return "";
  const day = expiredAt.slice(0, 10);
  const d = day ? new Date(`${day}T23:59:59Z`).getTime() : Number.NaN;
  if (Number.isNaN(d)) return "";
  const daysLeft = (d - Date.now()) / 86400000;
  if (daysLeft < 0) return " data-table-tag--red";
  if (daysLeft <= 30) return " data-table-tag--orange";
  return " data-table-tag--green";
}

function formatBilling(row: ClientRow, t: (key: string) => string): ReactNode {
  const priceNode = billingPriceNode(row, t);
  const day = row.expired_at?.slice(0, 10) ?? "";
  const parts: ReactNode[] = [];
  if (priceNode !== null) parts.push(priceNode);
  if (day) {
    parts.push(
      <span key="expiry" className={`data-table-tag${expiryTagClass(row.expired_at)}`}>
        {day}
      </span>,
    );
  }
  if (parts.length === 0) return "—";
  return (
    <div className="admin-billing-tags">
      {parts.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </div>
  );
}

export default function ServersPage() {
  const { t } = useTranslation();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [listEpoch, setListEpoch] = useState(0);

  // SSE/降级轮询共用的页面数据；items 按行复用对象，行内容不变不重渲染
  const [pageData, setPageData] = useState<{ items: ClientRow[]; nextCursor: string | null }>({
    items: [],
    nextCursor: null,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // 行选择（批量操作）与批量分组侧栏
  const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkGroups, setBulkGroups] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);

  const activeCursor = cursorStack[cursorIndex];

  // 增删改后回到第一页，并触发 SSE 重连即时拿最新快照
  useEffect(() => {
    setCursorStack([undefined]);
    setCursorIndex(0);
  }, [listEpoch]);

  const applyPayload = useCallback((payload: ClientsPayload) => {
    const incoming = payload.items ?? [];
    setPageData((prev) => {
      const prevByKey = new Map(prev.items.map((r) => [r.uuid, r]));
      const next = incoming.map((item) => {
        const old = prevByKey.get(item.uuid);
        // 内容完全一致的行沿用旧对象，配合 TableRow memo 实现局部更新
        return old && JSON.stringify(old) === JSON.stringify(item) ? old : item;
      });
      const unchanged =
        next.length === prev.items.length &&
        next.every((row, i) => row === prev.items[i]);
      if (!unchanged) {
        // 同步清理已不存在的选中项（批量删除 / 行内删除后）
        const alive = new Set(next.map((r) => r.uuid));
        setSelectedUuids((sel) => {
          const filtered = new Set([...sel].filter((u) => alive.has(u)));
          return filtered.size === sel.size ? sel : filtered;
        });
      }
      if (unchanged) return prev;
      return { items: next, nextCursor: payload.next_cursor ?? null };
    });
    setInitialLoading(false);
  }, []);

  // SSE 订阅当前页；onerror 切 POST 轮询降级
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: number | undefined;

    const startPolling = () => {
      const poll = async () => {
        try {
          const res = await fetch("/api/admin/clients/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cursor: activeCursor ?? null, limit: pageSize }),
          });
          if (res.ok && !cancelled) applyPayload(await res.json());
        } catch {
          // 保留上一次数据，等待下一轮
        }
        if (!cancelled) pollTimer = window.setTimeout(poll, 15_000);
      };
      void poll();
    };

    try {
      const qs = new URLSearchParams({ limit: String(pageSize) });
      if (activeCursor) qs.set("cursor", activeCursor);
      es = new EventSource(`/api/admin/clients/stream?${qs.toString()}`);
      es.addEventListener("clients", (event) => {
        if (cancelled) return;
        try {
          applyPayload(JSON.parse((event as MessageEvent).data));
        } catch {
          // 忽略坏帧
        }
      });
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [activeCursor, pageSize, listEpoch, applyPayload]);

  const groupOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of pageData.items) {
      for (const g of (r.group_name ?? "").split(",")) {
        const t = g.trim();
        if (t) set.add(t);
      }
    }
    return [...set];
  }, [pageData.items]);

  const columns: Column<ClientRow>[] = useMemo(
    () => [
      {
        key: "name",
        title: t("admin.servers.name"),
        render: (row) => (
          <AgentServerNameCell
            name={row.name}
            region={row.region}
          />
        ),
      },
      {
        key: "public_ip",
        title: t("admin.servers.ipAddress"),
        render: (row) => <AgentServerDualIpCell ipv4={row.ipv4} ipv6={row.ipv6} />,
      },
      {
        key: "agent_version",
        title: t("admin.servers.clientVersion"),
        render: (row) => (
          <span className="data-table-cell">{cellText(row.agent_version ?? undefined)}</span>
        ),
      },
      {
        key: "group_name",
        title: t("admin.servers.group"),
        render: (row) => {
          const groups = (row.group_name ?? "")
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean);
          if (groups.length === 0) return <span className="data-table-cell">—</span>;
          return (
            <div className="admin-billing-tags" title={groups.join(", ")}>
              {groups.map((g) => (
                <span key={g} className="data-table-tag data-table-tag--blue">
                  {g}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        key: "private_remark",
        title: t("admin.servers.privateRemark"),
        render: (row) => {
          const full = row.private_remark?.trim() ?? "";
          return (
            <span className="data-table-cell" title={full || undefined}>
              {tableCellEllipsis(row.private_remark)}
            </span>
          );
        },
      },
      {
        key: "billing",
        title: t("admin.servers.billing"),
        render: (row) => (
          <span className="data-table-cell admin-font-number">{formatBilling(row, t)}</span>
        ),
      },
      {
        key: "actions",
        title: t("common.action"),
        render: (row) => (
          <ServerRowActions
            row={row}
            groupOptions={groupOptions}
            onChanged={() => setListEpoch((n) => n + 1)}
          />
        ),
      },
    ],
    [t, groupOptions],
  );

  function openCreateSidebar() {
    setNewName("");
    setSidebarOpen(true);
  }

  /** 拖拽排序：本地乐观重排，PUT 后端全量重写序号（SSE 随后校准） */
  async function reorderServer(from: number, to: number) {
    const moved = items[from];
    if (!moved || from === to) return;
    const rest = items.filter((_, i) => i !== from);
    const next = [...rest.slice(0, to), moved, ...rest.slice(to)];
    setPageData((prev) => ({ ...prev, items: next }));
    const before = next[to + 1]?.uuid ?? null;
    try {
      const res = await fetch("/api/admin/clients/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid: moved.uuid, before }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? t("common.error"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
      setListEpoch((n) => n + 1);
    }
  }

  function bulkDelete() {
    const uuids = [...selectedUuids];
    if (uuids.length === 0) return;
    confirm({
      title: t("admin.servers.bulkDeleteConfirm", { n: uuids.length }),
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetch("/api/admin/clients/batch-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uuids }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { message?: string };
            throw new Error(data.message ?? t("common.error"));
          }
          toast.success(t("admin.servers.bulkDeleteSuccess", { n: uuids.length }));
          setSelectedUuids(new Set());
          setListEpoch((n) => n + 1);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : t("common.error"));
        }
      },
    });
  }

  async function bulkSaveGroup() {
    const uuids = [...selectedUuids];
    if (uuids.length === 0) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/admin/clients/batch-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids, group_name: bulkGroups.join(",") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? t("common.error"));
      }
      toast.success(t("admin.servers.bulkGroupSuccess", { n: uuids.length }));
      setBulkGroupOpen(false);
      setSelectedUuids(new Set());
      setListEpoch((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBulkSaving(false);
    }
  }

  async function createClient() {
    setCreating(true);
    try {
      const payload: { name?: string } = {};
      const trimmed = newName.trim();
      if (trimmed) {
        payload.name = trimmed;
      }
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok) {
        toast.error(data.message ?? t("common.error"));
        return;
      }
      if (data.token) {
        setLastToken(data.token);
        toast.success(t("admin.servers.tokenCreated"));
      }
      setSidebarOpen(false);
      setNewName("");
      setListEpoch((n) => n + 1);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  const items = pageData.items;
  const hasPrev = cursorIndex > 0;
  const hasNext = Boolean(pageData.nextCursor);
  const from = items.length === 0 ? 0 : cursorIndex * pageSize + 1;
  const to = items.length === 0 ? 0 : from + items.length - 1;

  return (
    <>
      {confirmDialog}
      {lastToken ? (
        <div className="page-container">
          <div className="page-card admin-stat-card admin-token-card">
            <p className="admin-stat-label">{t("admin.servers.tokenLabel")}</p>
            <code className="admin-token-value">{lastToken}</code>
            <p className="admin-muted">{t("admin.servers.tokenHint")}</p>
          </div>
        </div>
      ) : null}

      <section className="page-container page-container--entity-list">
        <PageListHeader
          titleKey="admin.nav.serverList"
          actions={
            <>
              <span
                className="admin-bulk-actions"
                data-active={selectedUuids.size > 0 || undefined}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setBulkGroups([]);
                    setBulkGroupOpen(true);
                  }}
                >
                  {t("admin.servers.bulkSetGroup")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void bulkDelete()}
                >
                  <Trash2 size={14} aria-hidden />
                  {t("common.delete")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedUuids(new Set())}
                >
                  {t("common.cancel")}
                </Button>
              </span>
              <Button type="button" size="sm" onClick={openCreateSidebar}>
                <Plus size={16} aria-hidden />
                {t("admin.servers.add")}
              </Button>
            </>
          }
        />
        <DataTable
          tableClassName="data-table--entity-list"
          listLayoutId="agent_servers"
          columns={columns}
          data={items}
          rowKey={(row) => row.uuid}
          loading={initialLoading}
          emptyText={t("admin.emptyNodes")}
          selectable
          selectedKeys={selectedUuids}
          onSelectionChange={(keys) => setSelectedUuids(new Set([...keys] as Set<string>))}
          rowDrag={{
            onReorder: (from, to) => void reorderServer(from, to),
            handleLabel: t("admin.servers.dragToSort"),
          }}
          pagination={{
            mode: "cursor",
            page: cursorIndex + 1,
            size: pageSize,
            hasPrev,
            hasNext,
            rangeFrom: from,
            rangeTo: to,
          }}
          onCursorPrev={() => {
            if (hasPrev) setCursorIndex((i) => i - 1);
          }}
          onCursorNext={() => {
            if (!hasNext) return;
            setCursorStack((stack) => {
              const trimmed = stack.slice(0, cursorIndex + 1);
              return [...trimmed, pageData.nextCursor ?? undefined];
            });
            setCursorIndex((i) => i + 1);
          }}
          onSizeChange={(size) => {
            setPageSize(size);
            setCursorStack([undefined]);
            setCursorIndex(0);
          }}
        />
      </section>

      <GenericSidebar
        open={sidebarOpen}
        title={t("admin.servers.add")}
        onClose={() => setSidebarOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setSidebarOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={creating} onClick={() => void createClient()}>
              {t("admin.servers.create")}
            </Button>
          </>
        }
      >
        <div className="admin-sidebar-form">
          <label className="admin-sidebar-form__label">
            {t("admin.servers.name")}
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("admin.servers.namePlaceholder")}
              aria-label={t("admin.servers.name")}
            />
            <p className="admin-sidebar-form__hint">{t("admin.servers.nameOptionalHint")}</p>
          </label>
        </div>
      </GenericSidebar>

      <GenericSidebar
        open={bulkGroupOpen}
        title={t("admin.servers.bulkSetGroup")}
        onClose={() => setBulkGroupOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setBulkGroupOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" disabled={bulkSaving} onClick={() => void bulkSaveGroup()}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="admin-sidebar-form">
          <label className="admin-sidebar-form__label">
            {t("admin.servers.group")}
            <TagSelectInput
              value={bulkGroups}
              onChange={setBulkGroups}
              suggestions={groupOptions}
              placeholder={t("admin.servers.groupPlaceholder")}
              inputAriaLabel={t("admin.servers.group")}
            />
            <p className="admin-sidebar-form__hint">{t("admin.servers.bulkGroupHint")}</p>
          </label>
        </div>
      </GenericSidebar>
    </>
  );
}
