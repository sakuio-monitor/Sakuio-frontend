import { Button, ChoiceGroup, Input, Select } from "@sakuio/ui";
import { useTranslation } from "react-i18next";
import type { PingTaskDraft } from "../../types/ping";

type Props = {
  form: PingTaskDraft;
  onChange: (next: PingTaskDraft) => void;
  onPickClients: () => void;
};

export function PingTaskFormFields({ form, onChange, onPickClients }: Props) {
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
      <ChoiceGroup
        ariaLabel={t("admin.ping.defaultOn")}
        value={form.default_on ? "default" : "manual"}
        onChange={(v) => onChange({ ...form, default_on: v === "default" })}
        options={[
          {
            value: "manual",
            title: t("admin.ping.bindServers"),
            hint: t("common.selectClients"),
          },
          {
            value: "default",
            title: t("admin.ping.defaultOn"),
            hint: t("admin.ping.defaultOnHint"),
          },
        ]}
      />
      {!form.default_on ? (
        <div className="admin-sidebar-form__label">
          <Button type="button" variant="secondary" size="sm" onClick={onPickClients}>
            {t("common.selectClients")}
          </Button>
          <p className="admin-sidebar-form__hint">
            {t("common.selectedCount", { count: form.clients.length })}
          </p>
        </div>
      ) : null}
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
