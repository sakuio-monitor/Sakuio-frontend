import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fetchClientOptions, type ClientOption } from "../../api/ddns";

export function SearchableServerSelect({
  value,
  selectedLabel,
  onChange,
  placeholder = "搜索服务器名称或 UUID",
}: {
  value: string;
  selectedLabel?: string;
  onChange: (uuid: string, client: ClientOption) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });
  const [query, setQuery] = useState(selectedLabel ?? "");
  const [items, setItems] = useState<ClientOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;
  const wrapper = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const requestID = useRef(0);

  const updatePosition = useCallback(() => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return;
    const gap = 4;
    const margin = 10;
    const below = Math.max(0, window.innerHeight - rect.bottom - margin);
    const above = Math.max(0, rect.top - margin);
    const openUp = below < 180 && above > below;
    const maxHeight = Math.min(360, openUp ? above : below);
    const top = openUp
      ? Math.max(margin, rect.top - maxHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - margin);
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    setMenuStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: 2000,
      visibility: "visible",
    });
  }, []);

  const load = useCallback(async (search: string, nextPage: number) => {
    const id = ++requestID.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchClientOptions({ search, page: nextPage, limit });
      if (id !== requestID.current) return;
      setItems(result.items);
      setTotal(result.total);
      setPage(result.page);
    } catch (cause) {
      if (id !== requestID.current) return;
      setItems([]);
      setTotal(0);
      setError(cause instanceof Error ? cause.message : "加载服务器失败");
    } finally {
      if (id === requestID.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void load(query.trim(), 1), 220);
    return () => window.clearTimeout(timer);
  }, [load, open, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!wrapper.current?.contains(target) && !menu.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = window.setTimeout(() => setMounted(false), 150);
    return () => window.clearTimeout(timer);
  }, [mounted, open]);

  useEffect(() => {
    if (selectedLabel) setQuery(selectedLabel);
    else if (!value) setQuery("");
  }, [selectedLabel, value]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const address = (client: ClientOption) => {
    if (client.ipv4?.trim()) return client.ipv4.trim();
    const ipv6 = client.ipv6?.trim();
    if (ipv6) {
      return ipv6.length > 26 ? `${ipv6.slice(0, 11)}...${ipv6.slice(-9)}` : ipv6;
    }
    return "未上报 IP";
  };

  return (
    <div className="server-search-select" ref={wrapper}>
      <div className="server-search-select__input">
        <Search size={14} aria-hidden />
        <input
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          aria-label={placeholder}
        />
        {value ? (
          <button
            type="button"
            className="server-search-select__clear"
            aria-label="清除选择"
            onClick={() => {
              setQuery("");
              onChange("", { uuid: "", name: "" });
              void load("", 1);
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {mounted ? createPortal(
        <div ref={menu} className={`server-search-select__menu ${open ? "is-open" : "is-closing"}`} style={menuStyle}>
          {loading ? <div className="server-search-select__empty">搜索中...</div> : null}
          {!loading && error ? <div className="server-search-select__empty server-search-select__error">{error}</div> : null}
          {!loading && !error && items.length === 0 ? <div className="server-search-select__empty">没有匹配的服务器</div> : null}
          {!loading && !error ? items.map((client) => (
            <button
              type="button"
              key={client.uuid}
              className={`server-search-select__item${client.uuid === value ? " is-selected" : ""}`}
              onClick={() => {
                onChange(client.uuid, client);
                setQuery(client.name);
                setOpen(false);
              }}
            >
              <span>{client.name}</span>
              <small>{address(client)}</small>
            </button>
          )) : null}
          <div className="server-search-select__footer">
            <span>共 {total} 台</span>
            <div>
              <button type="button" disabled={page <= 1 || loading} onClick={() => void load(query.trim(), page - 1)} aria-label="上一页">
                <ChevronLeft size={14} />
              </button>
              <span>{page} / {pages}</span>
              <button type="button" disabled={page >= pages || loading} onClick={() => void load(query.trim(), page + 1)} aria-label="下一页">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
