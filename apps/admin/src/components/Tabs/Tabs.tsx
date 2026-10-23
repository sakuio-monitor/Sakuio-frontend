import type { ReactNode } from "react";
import "./Tabs.css";

export type TabItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
};

type Props = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
  stretch?: boolean;
};

/** Shared segmented tab control for every admin page. */
export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
  stretch = false,
}: Props) {
  if (items.length === 0) return null;
  return (
    <div
      className={`ui-tabs${stretch ? " ui-tabs--stretch" : ""} ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          disabled={item.disabled}
          className={`ui-tabs__tab${item.id === value ? " is-active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
