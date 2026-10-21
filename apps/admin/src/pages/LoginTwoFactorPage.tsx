import { Button, Input, toast } from "@sakuio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoginError } from "../api/adminFetch";
import { useAuth } from "../auth/AuthProvider";

type LoginPending = {
  username: string;
  password: string;
};

function readPending(state: unknown): LoginPending | null {
  if (!state || typeof state !== "object") return null;
  const s = state as Record<string, unknown>;
  const username = typeof s.username === "string" ? s.username.trim() : "";
  const password = typeof s.password === "string" ? s.password : "";
  if (!username || !password) return null;
  return { username, password };
}

export default function LoginTwoFactorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { loggedIn, login } = useAuth();
  const pending = readPending(location.state);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!pending) {
    return <Navigate to="/login" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.replace(/\s/g, "");
    if (trimmed.length < 6) {
      toast.error(t("admin.login.twoFaCodeShort"));
      return;
    }
    setSubmitting(true);
    try {
      await login(pending.username, pending.password, trimmed);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message =
        err instanceof LoginError || err instanceof Error ? err.message : t("common.error");
      toast.error(message);
      if (err instanceof LoginError && !err.needs2fa) {
        setCode("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-page">
      <form className="setup-shell page-card admin-login admin-login-2fa" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="setup-title">{t("admin.login.twoFaPageTitle")}</h1>
        <p className="admin-login-2fa__hint">{t("admin.login.twoFaPageHint")}</p>
        <label className="admin-sidebar-form__field">
          <span className="admin-sidebar-form__label">{t("admin.login.twoFa")}</span>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="admin-login-2fa__code"
          />
        </label>
        <div className="admin-login-2fa__actions">
          <Link to="/login" replace className="admin-login-2fa__back">
            {t("admin.login.twoFaBack")}
          </Link>
          <Button type="submit" disabled={submitting}>
            {t("admin.login.twoFaVerify")}
          </Button>
        </div>
      </form>
    </main>
  );
}
