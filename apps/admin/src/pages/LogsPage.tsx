import { Button, Input, Select } from "@sakuio/ui";
import { Eye } from "lucide-react";
import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AUDIT_CATEGORIES,
  auditActionLabel,
  fetchAuditLogs,
  type AuditLogRow,
} from "../api/auditLogs";
import type { Column } from "../components/DataTable/DataTable";
import { EntityListPage } from "../components/EntityListPage/EntityListPage";
import { GenericSidebar } from "../components/GenericSidebar/GenericSidebar";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import "../styles/logs.css";
import { reservedIpKind } from "../utils/ipAddress";

const EMPTY_FILTERS = { actor: "", category: "", ip: "", q: "" };

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (number: number) => String(number).padStart(2, "0");
  return [
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
}

function actionTagClass(action: string): string {
  const value = action.toUpperCase();
  if (
    /(DELETE|FAILED|OFFLINE|DISABLE|CHMOD|TRASH_EMPTY|TRASH_DELETE|EMPTY)/.test(value)
  ) {
    return "data-table-tag--red";
  }
  if (/(ONLINE|CREATE|APPLY|ENABLE|LOGIN$|INSTALL$|RESTORE|REGENERATE)/.test(value)) {
    return "data-table-tag--green";
  }
  if (/(MIGRATE|SWITCH|BACKUP|DOWNLOAD|UPLOAD|MOVE|RENAME)/.test(value)) {
    return "data-table-tag--orange";
  }
  if (/(UPDATE|EDIT|FILE_|COMMAND|TERMINAL|CONFIG|VIEW)/.test(value)) {
    return "data-table-tag--blue";
  }
  return "data-table-tag--neutral";
}

function prettyDetail(value: string): string {
  if (!value) return "-";
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function AuditIpCell({ ip, location }: { ip: string; location: string }) {
  const { t } = useTranslation();
  const reserved = reservedIpKind(ip);
  const label = reserved
    ? t(`admin.logs.reservedIp.${reserved}`)
    : location;
  return (
    <span className="audit-ip-cell" title={label || ip}>
      <code className="audit-ip">{ip || "-"}</code>
      {label ? <small className="audit-ip-geo">{label}</small> : null}
    </span>
  );
}

function LogDetail({ row, language }: { row: AuditLogRow; language: string }) {
  const { t } = useTranslation();
  const reserved = reservedIpKind(row.ip);
  const ipLocation = reserved
    ? t(`admin.logs.reservedIp.${reserved}`)
    : row.geo_location;

  return (
    <div className="audit-detail-panel">
      <dl className="audit-detail-grid">
        <div>
          <dt>{t("admin.logs.time")}</dt>
          <dd>{formatTime(row.created_at)}</dd>
        </div>
        <div>
          <dt>{t("admin.logs.actor")}</dt>
          <dd>
            {row.actor === "system" ? t("admin.logs.systemActor") : row.actor || "-"}
            {row.actor_id ? <small>{row.actor_id}</small> : null}
          </dd>
        </div>
        <div>
          <dt>{t("admin.logs.action")}</dt>
          <dd>
            <span className={`data-table-tag ${actionTagClass(row.action)}`}>
              {auditActionLabel(row.action, language)}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("admin.logs.target")}</dt>
          <dd>{row.target || "-"}</dd>
        </div>
        <div>
          <dt>{t("admin.logs.status")}</dt>
          <dd>
            <span
              className={`data-table-tag ${
                row.status >= 400 ? "data-table-tag--red" : "data-table-tag--green"
              }`}
            >
              {row.status}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t("admin.logs.ip")}</dt>
          <dd>
            {row.ip || "-"}
            {row.ip ? (
              <small className="audit-ip-geo">
                {ipLocation || t("admin.logs.geoUnknown")}
              </small>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t("admin.logs.path")}</dt>
          <dd className="audit-detail-mono">{row.path || "-"}</dd>
        </div>
        <div>
          <dt>{t("admin.logs.userAgent")}</dt>
          <dd>{row.user_agent || "-"}</dd>
        </div>
      </dl>
      <section className="audit-detail-content">
        <h4>{t("admin.logs.detail")}</h4>
        <pre>{prettyDetail(row.detail)}</pre>
      </section>
    </div>
  );
}

export default function LogsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "en";
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("admin.logs.allCategories") },
      ...AUDIT_CATEGORIES.map((category) => ({
        value: category,
        label: t(`admin.logs.categories.${category}`),
      })),
    ],
    [t],
  );

  const fetchPage = useCallback(
    async ({ cursor, limit }: { cursor?: string; limit: number }) =>
      fetchAuditLogs({ cursor, limit, filters }),
    [filters],
  );

  const columns = useMemo<Column<AuditLogRow>[]>(
    () => [
      {
        key: "created_at",
        title: t("admin.logs.time"),
        width: 176,
        fixedWidth: true,
        render: (row) => <span className="audit-time">{formatTime(row.created_at)}</span>,
      },
      {
        key: "actor",
        title: t("admin.logs.actor"),
        width: 150,
        render: (row) => (
          <span className="audit-actor" title={row.actor_id || undefined}>
            {row.actor === "system" ? t("admin.logs.systemActor") : row.actor || "-"}
          </span>
        ),
      },
      {
        key: "operation",
        title: t("admin.logs.action"),
        width: 150,
        fixedWidth: true,
        render: (row) => (
          <span className="data-table-cell">
            <span className={`data-table-tag audit-action-tag ${actionTagClass(row.action)}`}>
              {auditActionLabel(row.action, language)}
            </span>
          </span>
        ),
      },
      {
        key: "target",
        title: t("admin.logs.target"),
        width: 280,
        render: (row) => (
          <code className="audit-target" title={row.path}>
            {row.target}
          </code>
        ),
      },
      {
        key: "detail",
        title: t("admin.logs.detail"),
        render: (row) => (
          <span className="audit-detail" title={row.detail}>
            {row.detail || "-"}
          </span>
        ),
      },
      {
        key: "ip",
        title: t("admin.logs.ip"),
        width: 140,
        fixedWidth: true,
        render: (row) => <AuditIpCell ip={row.ip} location={row.geo_location} />,
      },
      {
        key: "status",
        title: t("admin.logs.status"),
        width: 80,
        fixedWidth: true,
        render: (row) => (
          <span className="data-table-cell">
            <span
              className={`data-table-tag ${
                row.status >= 400 ? "data-table-tag--red" : "data-table-tag--green"
              }`}
            >
              {row.status}
            </span>
          </span>
        ),
      },
      {
        key: "actions",
        title: t("common.action"),
        render: (row) => (
          <div className="data-table-actions data-table-actions--icons">
            <CellTooltip tip={t("admin.logs.viewDetail")}>
              <button
                type="button"
                className="data-table-icon-btn"
                aria-label={t("admin.logs.viewDetail")}
                onClick={() => setDetail(row)}
              >
                <Eye size={18} aria-hidden />
              </button>
            </CellTooltip>
          </div>
        ),
      },
    ],
    [language, t],
  );

  return (
    <>
    <EntityListPage
      titleKey="admin.nav.logs"
      columns={columns}
      queryKey={[filters, refresh]}
      fetchPage={fetchPage}
      rowKey={(row) => String(row.id)}
      emptyText={t("admin.logs.empty")}
      tableClassName="data-table--entity-list data-table--audit-logs"
      actions={
        <div className="audit-toolbar">
          <Input
            value={draft.actor}
            placeholder={t("admin.logs.actorPlaceholder")}
            aria-label={t("admin.logs.actor")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((prev) => ({ ...prev, actor: event.target.value }))}
          />
          <Select
            value={draft.category}
            options={categoryOptions}
            onChange={(value) => setDraft((prev) => ({ ...prev, category: String(value) }))}
          />
          <Input
            value={draft.ip}
            placeholder={t("admin.logs.ipPlaceholder")}
            aria-label={t("admin.logs.ip")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((prev) => ({ ...prev, ip: event.target.value }))}
          />
          <Input
            value={draft.q}
            className="audit-toolbar__wide"
            placeholder={t("admin.logs.keywordPlaceholder")}
            aria-label={t("admin.logs.keyword")}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                setFilters(draft);
                setRefresh((value) => value + 1);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFilters(draft);
              setRefresh((value) => value + 1);
            }}
          >
            {t("admin.logs.search")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setFilters(EMPTY_FILTERS);
              setRefresh((value) => value + 1);
            }}
          >
            {t("admin.logs.reset")}
          </Button>
        </div>
      }
    />
    <GenericSidebar
      open={detail !== null}
      title={t("admin.logs.detailTitle")}
      onClose={() => setDetail(null)}
      minWidth={420}
      maxWidth={760}
      initialWidth={560}
    >
      {detail ? <LogDetail row={detail} language={language} /> : null}
    </GenericSidebar>
    </>
  );
}
