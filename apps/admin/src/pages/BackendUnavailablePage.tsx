import { Button } from "@sakuio/ui";
import { RefreshCw, ServerCrash } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useInstall } from "../install/InstallProvider";

export default function BackendUnavailablePage() {
  const { t } = useTranslation();
  const { refresh } = useInstall();
  const [retrying, setRetrying] = useState(false);

  async function onRetry() {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-shell backend-unavailable">
        <div className="backend-unavailable__icon" aria-hidden>
          <ServerCrash size={40} strokeWidth={1.5} />
        </div>
        <h1 className="setup-title">{t("admin.backend.unavailableTitle")}</h1>
        <p className="setup-subtitle backend-unavailable__body">
          {t("admin.backend.unavailableBody")}
        </p>
        <p className="setup-hint backend-unavailable__hint">{t("admin.backend.notInstallHint")}</p>
        <Button
          type="button"
          loading={retrying}
          icon={retrying ? undefined : <RefreshCw size={16} aria-hidden />}
          onClick={() => void onRetry()}
        >
          {t("admin.backend.retry")}
        </Button>
      </div>
    </main>
  );
}
