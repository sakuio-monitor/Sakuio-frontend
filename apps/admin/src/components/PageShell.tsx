import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  variant?: "default" | "entity-list";
};

export function PageShell({ title, actions, children, variant = "default" }: PageShellProps) {
  const containerClass =
    variant === "entity-list" ? "page-container page-container--entity-list" : "page-container";

  return (
    <div className={containerClass}>
      <header className="page-header">
        <h1 className="page-header__title">{title}</h1>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
