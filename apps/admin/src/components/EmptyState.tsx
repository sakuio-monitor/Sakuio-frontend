import { Inbox, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

type EmptyStateProps = {
  icon?: LucideIcon;
  textKey: string;
  hintKey?: string;
};

export function EmptyState({ icon: Icon = Inbox, textKey, hintKey }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <Icon size={56} strokeWidth={1.5} aria-hidden />
      <p className="empty-state__title">{t(textKey)}</p>
      {hintKey ? <p className="empty-state__hint">{t(hintKey)}</p> : null}
    </div>
  );
}
