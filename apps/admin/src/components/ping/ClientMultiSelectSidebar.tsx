import { Button, Input } from "@sakuio/ui";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminClientSummary } from "../../types/ping";
import { DataTable } from "../DataTable/DataTable";
import { GenericSidebar } from "../GenericSidebar/GenericSidebar";

type Props = {
  open: boolean;
  title: string;
  clients: AdminClientSummary[];
  value: string[];
  onClose: () => void;
  onSave: (next: string[]) => void;
  saving?: boolean;
};

export function ClientMultiSelectSidebar({
  open,
  title,
  clients,
  value,
  onClose,
  onSave,
  saving = false,
}: Props) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string | number>>(() => new Set(value));

  useEffect(() => {
    if (open) {
      setSelectedKeys(new Set(value));
      setKeyword("");
    }
  }, [open, value]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) {
      return clients;
    }
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.uuid.toLowerCase().includes(q),
    );
  }, [clients, keyword]);

  return (
    <GenericSidebar
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => onSave(Array.from(selectedKeys, String))}
          >
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="admin-sidebar-form">
        <label className="admin-sidebar-form__label">
          {t("common.search")}
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("fields.name")}
          />
        </label>
        <p className="admin-sidebar-form__hint">
          {t("common.selectedCount", { count: selectedKeys.size })}
        </p>
        <DataTable
          tableClassName="data-table--entity-list"
          columns={[
            {
              key: "name",
              title: t("common.name"),
              render: (row) => <span className="data-table-cell">{row.name}</span>,
            },
          ]}
          data={filtered}
          rowKey={(row) => row.uuid}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          emptyText={t("common.empty")}
        />
      </div>
    </GenericSidebar>
  );
}
