import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminClientSummary } from "../../types/ping";

type Props = {
  values: string[];
  clients: AdminClientSummary[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function SearchableServerMultiSelect({ values, clients, onChange, placeholder }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const selected = useMemo(() => new Set(values), [values]);
  const byUuid = useMemo(() => new Map(clients.map((c) => [c.uuid, c])), [clients]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.uuid.toLowerCase().includes(q));
  }, [clients, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggle = (uuid: string) => {
    const next = new Set(values);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    onChange([...next]);
  };

  return (
    <div className="server-search-select" ref={wrapper}>
      <div className="server-search-select__input">
        <Search size={14} aria-hidden />
        <input
          value={query}
          placeholder={placeholder ?? t("common.selectPlaceholder")}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          aria-label={placeholder ?? t("common.selectPlaceholder")}
        />
      </div>
      {values.length > 0 ? (
        <div className="server-search-select__chips">
          {values.map((uuid) => (
            <span className="server-search-select__chip" key={uuid}>
              {byUuid.get(uuid)?.name ?? uuid}
              <button
                type="button"
                aria-label={t("common.delete")}
                onClick={() => toggle(uuid)}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="server-search-select__menu">
          {filtered.length === 0 ? (
            <div className="server-search-select__empty">{t("common.empty")}</div>
          ) : (
            filtered.map((client) => (
              <button
                type="button"
                key={client.uuid}
                className={`server-search-select__item${selected.has(client.uuid) ? " is-selected" : ""}`}
                onClick={() => toggle(client.uuid)}
              >
                <span>{client.name}</span>
                <small>{selected.has(client.uuid) ? <Check size={13} aria-hidden /> : client.uuid.slice(0, 8)}</small>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
