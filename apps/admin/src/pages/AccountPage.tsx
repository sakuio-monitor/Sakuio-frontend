import { Button, Input, toast } from "@sakuio/ui";
import { Check, Copy, KeyRound, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import {
  changePassword,
  changeUsername,
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
} from "../api/account";
import { PageListHeader } from "../components/PageListHeader";
import { copyTextToClipboard } from "./terminal/fileManagerApi";
import "../styles/site-settings.css";
import "../styles/account.css";

export default function AccountPage() {
  const { t } = useTranslation();
  const { me, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string; qr_svg?: string } | null>(null);
  const [code, setCode] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const twoFactorEnabled = Boolean(me?.["2fa_enabled"]);

  useEffect(() => {
    setUsername(me?.username ?? "");
  }, [me?.username]);

  const saveUsername = async () => {
    const value = username.trim();
    if (!value) {
      toast.error(t("account.usernameRequired"));
      return;
    }
    setSavingUser(true);
    try {
      const result = await changeUsername(value);
      setUsername(result.username);
      await refresh();
      toast.success(t("account.usernameSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSavingUser(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      toast.error(t("account.passwordTooShort"));
      return;
    }
    if (newPassword !== repeatPassword) {
      toast.error(t("account.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(newPassword, repeatPassword);
      setNewPassword("");
      setRepeatPassword("");
      toast.success(t("account.passwordSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSavingPassword(false);
    }
  };

  const beginSetup = async () => {
    setSettingUp(true);
    setCode("");
    try {
      setSetup(await setupTwoFactor());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSettingUp(false);
    }
  };

  const confirmEnable = async () => {
    if (!setup || code.trim().length !== 6) {
      toast.error(t("account.codeInvalid"));
      return;
    }
    setEnabling(true);
    try {
      await enableTwoFactor(code.trim());
      setSetup(null);
      setCode("");
      await refresh();
      toast.success(t("account.twoFactorEnabled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setEnabling(false);
    }
  };

  const confirmDisable = async () => {
    if (code.trim().length !== 6) {
      toast.error(t("account.codeInvalid"));
      return;
    }
    setDisabling(true);
    try {
      await disableTwoFactor(code.trim());
      setCode("");
      await refresh();
      toast.success(t("account.twoFactorDisabled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    if (await copyTextToClipboard(setup.secret)) {
      toast.success(t("account.secretCopied"));
    } else {
      toast.error(t("account.copyFailed"));
    }
  };

  return (
    <section className="page-container account-page">
      <PageListHeader titleKey="admin.nav.account" />

      <section className="page-card site-settings-card account-card">
        <h3 className="site-settings-card__title">
          <UserRound size={16} aria-hidden />
          {t("account.usernameTitle")}
        </h3>
        <p className="account-description">{t("account.usernameDescription")}</p>
        <div className="account-inline">
          <Input
            value={username}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUsername(event.target.value)}
            placeholder={t("account.usernamePlaceholder")}
            autoComplete="username"
          />
          <Button type="button" disabled={savingUser || !username.trim()} onClick={() => void saveUsername()}>
            <Check size={15} aria-hidden />
            {savingUser ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </section>

      <section className="page-card site-settings-card account-card">
        <h3 className="site-settings-card__title">
          <KeyRound size={16} aria-hidden />
          {t("account.passwordTitle")}
        </h3>
        <p className="account-description">{t("account.passwordDescription")}</p>
        <label className="account-field">
          <span>{t("account.newPassword")}</span>
          <Input
            type="password"
            value={newPassword}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="account-field">
          <span>{t("account.repeatPassword")}</span>
          <Input
            type="password"
            value={repeatPassword}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setRepeatPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <Button
          type="button"
          disabled={savingPassword || !newPassword || !repeatPassword}
          onClick={() => void savePassword()}
        >
          <Check size={15} aria-hidden />
          {savingPassword ? t("common.saving") : t("account.updatePassword")}
        </Button>
      </section>

      <section className="page-card site-settings-card account-card">
        <h3 className="site-settings-card__title">
          {twoFactorEnabled ? <ShieldCheck size={16} aria-hidden /> : <ShieldOff size={16} aria-hidden />}
          {t("account.twoFactorTitle")}
        </h3>
        <p className="account-description">
          {twoFactorEnabled ? t("account.twoFactorEnabledDescription") : t("account.twoFactorDisabledDescription")}
        </p>

        {!twoFactorEnabled && !setup ? (
          <Button type="button" disabled={settingUp} onClick={() => void beginSetup()}>
            <ShieldCheck size={15} aria-hidden />
            {settingUp ? t("common.loading") : t("account.enableTwoFactor")}
          </Button>
        ) : null}

        {!twoFactorEnabled && setup ? (
          <div className="account-twofa-setup">
            <p className="account-description">{t("account.scanOrEnterSecret")}</p>
            {setup.qr_svg ? (
              <div
                className="account-qr"
                aria-label={t("account.qrCode")}
                dangerouslySetInnerHTML={{ __html: setup.qr_svg }}
              />
            ) : null}
            <div className="account-secret">
              <code>{setup.secret}</code>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copySecret()}>
                <Copy size={14} aria-hidden />
                {t("account.copySecret")}
              </Button>
            </div>
            <p className="account-hint">{setup.otpauth_url}</p>
            <label className="account-field">
              <span>{t("account.authenticatorCode")}</span>
              <Input
                value={code}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
              />
            </label>
            <Button type="button" disabled={enabling || code.length !== 6} onClick={() => void confirmEnable()}>
              <Check size={15} aria-hidden />
              {enabling ? t("common.saving") : t("account.confirmEnable")}
            </Button>
          </div>
        ) : null}

        {twoFactorEnabled ? (
          <div className="account-twofa-disable">
            <p className="account-description">{t("account.enterCodeToDisable")}</p>
            <div className="account-inline">
              <Input
                value={code}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
              />
              <Button type="button" variant="secondary" disabled={disabling || code.length !== 6} onClick={() => void confirmDisable()}>
                <ShieldOff size={15} aria-hidden />
                {disabling ? t("common.saving") : t("account.disableTwoFactor")}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
