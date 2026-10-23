import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { CellTooltip } from "../CellTooltip/CellTooltip";

export function FieldLabel({ children, tip }: { children: ReactNode; tip?: string }) {
  return (
    <span className="admin-sidebar-form__label-text">
      {children}
      {tip ? (
        <CellTooltip tip={tip} className="admin-field-info">
          <Info size={14} aria-hidden />
        </CellTooltip>
      ) : null}
    </span>
  );
}
