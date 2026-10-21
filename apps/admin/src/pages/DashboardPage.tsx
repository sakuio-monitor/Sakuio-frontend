import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageShell } from "../components/PageShell";

type NodeRow = {
  uuid: string;
  name: string;
  online?: boolean;
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/nodes");
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { nodes?: NodeRow[] };
        if (!cancelled) setNodes(data.nodes ?? []);
      } catch {
        if (!cancelled) setNodes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onlineCount = useMemo(() => nodes.filter((n) => n.online).length, [nodes]);

  return (
    <PageShell title={t("admin.nav.dashboard")}>
      <div className="admin-dashboard-grid">
        <section className="page-card admin-stat-card">
          <p className="admin-stat-label">{t("admin.dashboard.overview")}</p>
          {loading ? (
            <p className="admin-muted">{t("common.loading")}</p>
          ) : (
            <p className="admin-stat-value">
              {t("admin.dashboard.onlineNodes", { online: onlineCount, total: nodes.length })}
            </p>
          )}
          <Link to="/servers" className="admin-stat-link">
            {t("admin.nav.serverList")}
          </Link>
        </section>
        <section className="page-card admin-stat-card">
          <p className="admin-stat-label">{t("admin.dashboard.hintTitle")}</p>
          <p className="admin-muted">{t("admin.dashboard.hintBody")}</p>
        </section>
      </div>
    </PageShell>
  );
}
