import { Button, Input, toast } from "@sakuio/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { LoginError } from "../api/adminFetch";
import { useAuth } from "../auth/AuthProvider";

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loggedIn, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFa, setTwoFa] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username.trim(), password, needs2fa ? twoFa.trim() : undefined);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof LoginError && err.needs2fa) {
        setNeeds2fa(true);
        toast.error(t("admin.login.twoFaRequired"));
      } else {
        const message = err instanceof Error ? err.message : t("common.error");
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-page">
      <form className="setup-shell page-card admin-login" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="setup-title">{t("admin.login.title")}</h1>
        <label className="admin-sidebar-form__field">
          <span className="admin-sidebar-form__label">{t("admin.login.username")}</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>
        <label className="admin-sidebar-form__field">
          <span className="admin-sidebar-form__label">{t("admin.login.password")}</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {needs2fa ? (
          <label className="admin-sidebar-form__field">
            <span className="admin-sidebar-form__label">{t("admin.login.twoFa")}</span>
            <Input
              value={twoFa}
              onChange={(e) => setTwoFa(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {t("admin.login.submit")}
        </Button>
      </form>
    </main>
  );
}
