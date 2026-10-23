import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SearchableMultiSelect.css";

export type MultiOption = { value: string; label: string; hint?: string };

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  options?: MultiOption[];
  fetchOptions?: (search: string, page: number) => Promise<{ items: MultiOption[]; total: number; page: number; limit: number }>;
  placeholder?: string;
  ariaLabel?: string;
  max?: number;
};

export function SearchableMultiSelect({ values, onChange, options = [], fetchOptions, placeholder, ariaLabel, max }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<MultiOption[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const limit = 10;

  const selected = useMemo(() => {
    const map = new Map([...options, ...items].map((item) => [item.value, item]));
    return values.map((value) => map.get(value) ?? { value, label: value });
  }, [items, options, values]);

  const updatePosition = useCallback(() => {
    const rect = root.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const maxHeight = Math.min(320, Math.max(120, below));
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight,
      zIndex: 2000,
      visibility: "visible",
    });
  }, []);

  const load = useCallback(async (search: string, nextPage: number) => {
    if (fetchOptions) {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const result = await fetchOptions(search.trim(), nextPage);
        if (id === requestId.current) {
          setItems(result.items);
          setTotal(result.total);
          setPage(result.page);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
      return;
    }
    const q = search.trim().toLowerCase();
    const filtered = options.filter((item) => !q || item.label.toLowerCase().includes(q));
    setItems(filtered.slice(0, 100));
    setTotal(filtered.length);
    setPage(1);
  }, [fetchOptions, options]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const timer = window.setTimeout(() => void load(query, 1), 180);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [load, open, query, updatePosition]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pages = Math.max(1, Math.ceil(total / limit));
  const toggle = (value: string) => {
    if (max === 1) {
      onChange([value]);
      setOpen(false);
      return;
    }
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className="search-multi" ref={root}>
      <div className="search-multi__control">
        {selected.map((item) => (
          <span className="search-multi__chip" key={item.value}>
            {item.label}
            <button type="button" aria-label={`移除 ${item.label}`} onClick={() => toggle(item.value)}><X size={11} /></button>
          </span>
        ))}
        <Search size={14} aria-hidden />
        <input
          value={query}
          placeholder={selected.length ? "" : placeholder}
          aria-label={ariaLabel ?? placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        />
      </div>
      {open ? createPortal(
        <div ref={menu} className="search-multi__menu" style={menuStyle}>
          {loading ? <div className="search-multi__empty">搜索中...</div> : null}
          {!loading && items.length === 0 ? <div className="search-multi__empty">没有匹配项</div> : null}
          {!loading ? items.map((item) => (
            <button type="button" key={item.value} className={`search-multi__item${values.includes(item.value) ? " is-selected" : ""}`} onClick={() => toggle(item.value)}>
              <span>{item.label}</span>
              {item.hint ? <small>{item.hint}</small> : null}
              <span className="search-multi__check">{values.includes(item.value) ? "✓" : ""}</span>
            </button>
          )) : null}
          {fetchOptions ? (
            <div className="search-multi__footer">
              <span>共 {total} 项</span>
              <div>
                <button type="button" disabled={page <= 1 || loading} onClick={() => void load(query, page - 1)} aria-label="上一页"><ChevronLeft size={14} /></button>
                <span>{page} / {pages}</span>
                <button type="button" disabled={page >= pages || loading} onClick={() => void load(query, page + 1)} aria-label="下一页"><ChevronRight size={14} /></button>
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
