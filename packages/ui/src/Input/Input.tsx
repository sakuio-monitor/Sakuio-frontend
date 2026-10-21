import type { InputHTMLAttributes } from "react";
import "./Input.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label?: string;
  className?: string;
};

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <label className={`ui-input ${className}`.trim()}>
      {label ? <span className="ui-input__label">{label}</span> : null}
      <input className="ui-input__field" {...props} />
    </label>
  );
}
