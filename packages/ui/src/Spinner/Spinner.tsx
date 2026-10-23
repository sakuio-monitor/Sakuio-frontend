import "./Spinner.css";

export type SpinnerProps = {
  size?: number;
  className?: string;
  label?: string;
};

/**
 * Dual-ring spinner shared by buttons, tables and page-level loading states.
 * 双环加载指示器，供按钮、表格与页面加载统一使用。
 */
export function Spinner({ size = 20, className = "", label }: SpinnerProps) {
  return (
    <span
      className={`sakuio-spinner ${className}`.trim()}
      style={{ width: size, height: size }}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="sakuio-spinner__outer" />
      <span className="sakuio-spinner__inner" />
    </span>
  );
}
