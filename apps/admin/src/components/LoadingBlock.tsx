import { Spinner } from "@sakuio/ui";
import "./LoadingBlock.css";

/** Page/section loading state using the shared dual-ring spinner. */
export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="admin-loading-block" role="status">
      <Spinner size={30} />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
