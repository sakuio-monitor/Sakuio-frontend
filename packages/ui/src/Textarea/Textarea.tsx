import type { TextareaHTMLAttributes } from "react";
import "./Textarea.css";

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  label?: string;
  className?: string;
};

export function Textarea({ label, className = "", ...props }: TextareaProps) {
  return (
    <label className={`ui-textarea ${className}`.trim()}>
      {label ? <span className="ui-textarea__label">{label}</span> : null}
      <textarea className="ui-textarea__field" {...props} />
    </label>
  );
}
