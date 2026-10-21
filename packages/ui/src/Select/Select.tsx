import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./Select.css";

export type SelectOption = {
  label: ReactNode;
  value: string | number;
  searchText?: string;
};

export type SelectProps = {
  value: string | number | undefined;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  onChange: (value: string | number) => void;
};

export function Select({
  value,
  options,
  placeholder = "…",
  disabled = false,
  emptyText,
  onChange,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({
    position: "fixed",
    visibility: "hidden",
  });

  const selected = options.find((o) => o.value === value);

  const filteredOptions = useMemo(() => options.slice(0, 100), [options]);

  const updatePosition = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const maxHeight = 320;
    const gap = 4;
    const measured = dropdownRef.current?.offsetHeight ?? 0;
    const dropdownHeight = Math.min(measured > 0 ? measured : 220, maxHeight);
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUpward = spaceBelow < Math.min(dropdownHeight, 200) && spaceAbove > spaceBelow;
    const width = Math.max(rect.width, 160);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
    if (left < 8) left = 8;
    const top = openUpward
      ? Math.max(gap, rect.top - gap - dropdownHeight)
      : Math.min(rect.bottom + gap, window.innerHeight - gap - Math.min(dropdownHeight, spaceBelow || dropdownHeight));
    setDropdownStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: 99999,
      visibility: "visible",
    });
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setDropdownStyle((current) => ({ ...current, visibility: "hidden" }));
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
  }, [disabled, updatePosition]);

  const toggleDropdown = useCallback(() => {
    if (disabled) return;
    if (open) closeDropdown();
    else openDropdown();
  }, [closeDropdown, disabled, open, openDropdown]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(raf);
  }, [open, filteredOptions.length, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      closeDropdown();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  return (
    <div
      ref={ref}
      className={`select${open ? " select--open" : ""}${disabled ? " select--disabled" : ""}`}
    >
      <button
        type="button"
        className="select__trigger"
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "select__value" : "select__placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} className={`select__arrow${open ? " select__arrow--up" : ""}`} />
      </button>

      {open &&
        createPortal(
          <div ref={dropdownRef} className="select__dropdown" role="listbox" style={dropdownStyle}>
            <div className="select__list">
              {filteredOptions.length === 0 ? (
                <div className="select__empty">{emptyText ?? "—"}</div>
              ) : (
                filteredOptions.map((opt) => (
                  <div
                    key={String(opt.value)}
                    role="option"
                    aria-selected={value === opt.value}
                    className={`select__option${value === opt.value ? " select__option--active" : ""}`}
                    onClick={() => {
                      onChange(opt.value);
                      closeDropdown();
                    }}
                  >
                    <span>{opt.label}</span>
                    {value === opt.value ? <Check size={16} /> : null}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
