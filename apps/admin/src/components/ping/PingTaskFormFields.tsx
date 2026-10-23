import { Input, Select } from "@sakuio/ui";
import { useTranslation } from "react-i18next";
import type { AdminClientSummary, PingTaskDraft } from "../../types/ping";
import { Switch } from "../ui/Switch";
import { SearchableServerMultiSelect } from "./SearchableServerMultiSelect";

type Props = {
  form: PingTaskDraft;
  clients: AdminClientSummary[];
  onChange: (next: PingTaskDraft) => void;
};

export function PingTaskFormFields({ form, clients, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="admin-sidebar-form">
      <label className="admin-sidebar-form__label">
        {t("common.name")}
        <Input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          required
        />
      </label>
      <label className="admin-sidebar-form__label">
        {t("common.type")}
        <Select
          value={form.type}
          onChange={(v) => onChange({ ...form, type: v as PingTaskDraft["type"] })}
          options={[
            { value: "icmp", label: "ICMP" },
            { value: "tcp", label: "TCP" },
            { value: "http", label: "HTTP" },
          ]}
        />
      </label>
      <label className="admin-sidebar-form__label">
        {t("admin.ping.target")}
        <Input
          value={form.target}
          onChange={(e) => onChange({ ...form, target: e.target.value })}
          placeholder={t("admin.ping.targetPlaceholder")}
          required
        />
      </label>
      <div className="ddns-form__switch">
        <span>
          <strong>{t("admin.ping.defaultOn")}</strong>
          <small>{t("admin.ping.defaultOnHint")}</small>
        </span>
        <Switch
          checked={form.default_on}
          label={t("admin.ping.defaultOn")}
          onChange={(checked) => onChange({ ...form, default_on: checked })}
        />
      </div>
      <div className="admin-sidebar-form__label">
        <span>{t("common.selectClients")}</span>
        <SearchableServerMultiSelect
          clients={clients}
          values={form.clients}
          onChange={(next) => onChange({ ...form, clients: next })}
          placeholder={t("common.selectPlaceholder")}
        />
        <p className="admin-sidebar-form__hint">
          {t("common.selectedCount", { n: form.clients.length })}
        </p>
      </div>
      <label className="admin-sidebar-form__label">
        {t("admin.ping.interval")} ({t("time.second")})
        <Input
          type="number"
          min={1}
          value={String(form.interval)}
          onChange={(e) =>
            onChange({ ...form, interval: Math.max(1, Number(e.target.value) || 0) })
          }
          required
        />
      </label>
    </div>
  );
}
