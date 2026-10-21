import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { pageLabelKeyForPath } from "../admin/menu";
import { PageShell } from "../components/PageShell";

export default function PlaceholderPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const title = useMemo(() => t(pageLabelKeyForPath(location.pathname)), [location.pathname, t]);

  return (
    <PageShell title={title}>
      <div className="page-card admin-placeholder-card">
        <p className="admin-placeholder-text">{t("admin.placeholder")}</p>
      </div>
    </PageShell>
  );
}
