import { Button, Input, toast } from "@sakuio/ui";
import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router-dom";
import { changeLocale } from "@sakuio/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { applyThemeTransition } from "../utils/themeTransition";
import { CellTooltip } from "../components/CellTooltip/CellTooltip";
import { LoginError } from "../api/adminFetch";
import { useAuth } from "../auth/AuthProvider";
import "../styles/ambient.css";
import "../styles/admin-tokens.css";
import "../layouts/AppLayout.css";
import "../styles/login.css";

type ThemeMode = "light" | "dark" | "system";
const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];
const THEME_KEY = "sakuio-admin-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as string[]).includes(value);
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveDark(mode: ThemeMode, systemDark: boolean): boolean {
  return mode === "system" ? systemDark : mode === "dark";
}

function initialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (isThemeMode(stored)) return stored;
    return systemPrefersDark() ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { loggedIn, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState<string[]>(() => Array(6).fill(""));
  const [needs2fa, setNeeds2fa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [totpState, setTotpState] = useState<"idle" | "success" | "error">("idle");
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const totpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const autoSubmittedRef = useRef(false);
  const dark = resolveDark(theme, systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore private-mode storage failures.
    }
  }, [dark, theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    if (needs2fa) {
      requestAnimationFrame(() => totpRefs.current[0]?.focus());
    }
  }, [needs2fa]);

  const twoFaCode = totp.join("");

  useEffect(() => {
    if (!needs2fa) {
      autoSubmittedRef.current = false;
      return;
    }
    if (twoFaCode.length < 6) {
      autoSubmittedRef.current = false;
      return;
    }
    if (!autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      void submitLogin();
    }
    // submitLogin is intentionally tied to the current six digits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs2fa, twoFaCode]);

  if (loggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  const setDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setTotpState("idle");
    setTotp((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      totpRefs.current[index + 1]?.focus();
    }
  };

  const pasteCode = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6).split("");
    if (digits.length === 0) return;
    setTotp(Array.from({ length: 6 }, (_, index) => digits[index] ?? ""));
    requestAnimationFrame(() => totpRefs.current[Math.min(digits.length, 5)]?.focus());
  };

  async function submitLogin() {
    if (submitting) return;
    const code = totp.join("");
    if (needs2fa && code.length !== 6) return;
    setSubmitting(true);
    try {
      await login(username.trim(), password, needs2fa ? code : undefined);
      if (needs2fa) {
        setTotpState("success");
        await new Promise((resolve) => window.setTimeout(resolve, 320));
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof LoginError && err.needs2fa) {
        setNeeds2fa(true);
        setTotp(Array(6).fill(""));
        setTotpState("idle");
        autoSubmittedRef.current = false;
        toast.error(t("admin.login.twoFaRequired"));
      } else if (needs2fa) {
        toast.error(err instanceof Error ? err.message : t("common.error"));
        setTotpState("error");
        window.setTimeout(() => {
          setTotpState("idle");
          setTotp(Array(6).fill(""));
          autoSubmittedRef.current = false;
          totpRefs.current[0]?.focus();
        }, 650);
      } else {
        const message = err instanceof Error ? err.message : t("common.error");
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitLogin();
  }

  return (
    <main className="admin-login-page ambient-surface">
      <div className="login-toolbar">
        <CellTooltip tip={t("common.language")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="topbar-action-btn" aria-label={t("common.language")}>
                <Languages size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32" themeAppearance={dark ? "dark" : "light"}>
              <DropdownMenuItem onSelect={() => void changeLocale(i18n, "zh-CN")}>简体中文</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void changeLocale(i18n, "en")}>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CellTooltip>
        <CellTooltip
          tip={
            theme === "light"
              ? t("admin.nav.themeLight")
              : theme === "dark"
                ? t("admin.nav.themeDark")
                : t("admin.nav.themeSystem")
          }
        >
          <button
            type="button"
            className="topbar-action-btn"
            onClick={(event) => {
              const next = THEME_MODES[(THEME_MODES.indexOf(theme) + 1) % THEME_MODES.length];
              applyThemeTransition(() => setTheme(next), { x: event.clientX, y: event.clientY });
            }}
            aria-label={
              theme === "light"
                ? t("admin.nav.themeLight")
                : theme === "dark"
                  ? t("admin.nav.themeDark")
                  : t("admin.nav.themeSystem")
            }
          >
            {theme === "light" ? <Sun size={18} /> : theme === "dark" ? <Moon size={18} /> : <Monitor size={18} />}
          </button>
        </CellTooltip>
      </div>

      <form className="setup-shell page-card admin-login" onSubmit={(e) => void onSubmit(e)}>
        <div className="admin-login__brand">
          <h1 className="setup-title admin-login__title">{t("admin.login.title")}</h1>
          <p className="admin-login__subtitle">Sakuio Monitor</p>
        </div>

        <label className="admin-sidebar-form__field">
          <span className="admin-sidebar-form__label">{t("admin.login.username")}</span>
          <Input
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="admin-sidebar-form__field">
          <span className="admin-sidebar-form__label">{t("admin.login.password")}</span>
          <Input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {needs2fa ? (
          <div className="admin-sidebar-form__field">
            <span className="admin-sidebar-form__label">{t("admin.login.twoFa")}</span>
            <div className={`totp-inputs${totpState === "success" ? " is-success" : totpState === "error" ? " is-error" : ""}`} onPaste={(event) => {
              event.preventDefault();
              pasteCode(event.clipboardData.getData("text"));
            }}>
              {totp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { totpRefs.current[index] = element; }}
                  className="totp-input"
                  value={digit}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  aria-label={`${t("admin.login.twoFa")} ${index + 1}`}
                  onChange={(event) => setDigit(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Backspace" && !totp[index] && index > 0) {
                      totpRefs.current[index - 1]?.focus();
                    } else if (event.key === "ArrowLeft" && index > 0) {
                      event.preventDefault();
                      totpRefs.current[index - 1]?.focus();
                    } else if (event.key === "ArrowRight" && index < 5) {
                      event.preventDefault();
                      totpRefs.current[index + 1]?.focus();
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        <Button type="submit" className="admin-login__submit" disabled={submitting}>
          {submitting ? t("common.loading") : t("admin.login.submit")}
        </Button>
      </form>
    </main>
  );
}
